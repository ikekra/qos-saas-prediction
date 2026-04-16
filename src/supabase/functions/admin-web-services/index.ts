import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdminContext } from "../_shared/admin-rbac.ts";
import { insertAdminAuditLog } from "../_shared/admin-audit.ts";

type WebServiceRow = {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  provider: string;
  description: string;
  base_latency_estimate: number | null;
  availability_score: number | null;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type UpsertBody = {
  id?: string;
  name?: string;
  category?: string;
  logo_url?: string | null;
  provider?: string;
  description?: string;
  base_latency_estimate?: number | null;
  availability_score?: number | null;
  is_active?: boolean;
  tags?: string[] | null;
};

const asNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean)
    .slice(0, 30);
};

const isMissingWebServicesSchema = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("web_services") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
};

const toLegacyStatus = (isActive: boolean) => (isActive ? "stable" : "critical");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (!["GET", "POST"].includes(req.method)) {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405, req);
  }

  const auth = await requireAdminContext(req);
  if (auth.response) return auth.response;
  if (!auth.context) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const { user, adminClient } = auth.context;
  const requestId = req.headers.get("x-idempotency-key")?.trim() || crypto.randomUUID();
  const ipAddress = req.headers.get("x-forwarded-for")?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.trim() ?? null;

  try {
    if (req.method === "GET") {
      const primary = await adminClient
        .from("web_services")
        .select("id, name, category, logo_url, provider, description, base_latency_estimate, availability_score, is_active, tags, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (!primary.error) {
        return jsonResponse({ success: true, services: (primary.data ?? []) as WebServiceRow[] }, 200, req);
      }

      if (!isMissingWebServicesSchema(primary.error)) {
        return jsonResponse({ error: "Failed to load services", details: primary.error.message }, 500, req);
      }

      const legacy = await adminClient
        .from("services")
        .select("id, name, category, description, avg_latency, tags, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (legacy.error) {
        return jsonResponse({ error: "Failed to load services", details: legacy.error.message }, 500, req);
      }

      const mapped = (legacy.data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        category: String(row.category ?? "other"),
        logo_url: null,
        provider: "legacy-services",
        description: String(row.description ?? ""),
        base_latency_estimate: typeof row.avg_latency === "number" ? row.avg_latency : 0,
        availability_score: 99,
        is_active: String(row.status ?? "stable") !== "critical",
        tags: Array.isArray(row.tags) ? row.tags : [],
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      })) as WebServiceRow[];

      return jsonResponse({ success: true, services: mapped }, 200, req);
    }

    const body = (await req.json().catch(() => ({}))) as UpsertBody;

    const id = String(body.id ?? "").trim() || null;
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const provider = String(body.provider ?? "").trim();
    const description = String(body.description ?? "").trim();
    const logoUrl = body.logo_url ? String(body.logo_url).trim() : null;
    const baseLatencyEstimate = asNumberOrNull(body.base_latency_estimate) ?? 0;
    const availabilityScore = asNumberOrNull(body.availability_score) ?? 0;
    const isActive = Boolean(body.is_active);
    const tags = normalizeTags(body.tags);

    if (!name || !provider || !description || !category) {
      return jsonResponse({ error: "name, provider, description, and category are required." }, 400, req);
    }
    if (baseLatencyEstimate < 0) {
      return jsonResponse({ error: "base_latency_estimate must be >= 0" }, 400, req);
    }
    if (availabilityScore < 0 || availabilityScore > 100) {
      return jsonResponse({ error: "availability_score must be between 0 and 100" }, 400, req);
    }

    const payload = {
      name,
      category,
      logo_url: logoUrl,
      provider,
      description,
      base_latency_estimate: baseLatencyEstimate,
      availability_score: availabilityScore,
      is_active: isActive,
      tags,
    };

    if (id) {
      const primaryUpdate = await adminClient
        .from("web_services")
        .update(payload)
        .eq("id", id);

      if (primaryUpdate.error && !isMissingWebServicesSchema(primaryUpdate.error)) {
        return jsonResponse({ error: "Failed to update service", details: primaryUpdate.error.message }, 500, req);
      }

      if (primaryUpdate.error && isMissingWebServicesSchema(primaryUpdate.error)) {
        const legacyUpdate = await adminClient
          .from("services")
          .update({
            name,
            category,
            description,
            avg_latency: baseLatencyEstimate,
            tags,
            status: toLegacyStatus(isActive),
          })
          .eq("id", id);

        if (legacyUpdate.error) {
          return jsonResponse({ error: "Failed to update legacy service", details: legacyUpdate.error.message }, 500, req);
        }
      }

      await insertAdminAuditLog(adminClient, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "web_service_update",
        resource: "web_services",
        status: "success",
        target_user_id: user.id,
        target_email: user.email ?? null,
        request_id: requestId,
        ip_address: ipAddress,
        user_agent: userAgent,
        reason: `Updated service ${id}`,
        metadata: { service_id: id, payload },
      });

      return jsonResponse({ success: true, action: "updated", service_id: id }, 200, req);
    }

    const primaryInsert = await adminClient
      .from("web_services")
      .insert(payload)
      .select("id")
      .single();

    let createdServiceId = String(primaryInsert.data?.id ?? "");

    if (primaryInsert.error && !isMissingWebServicesSchema(primaryInsert.error)) {
      return jsonResponse({ error: "Failed to create service", details: primaryInsert.error.message }, 500, req);
    }

    if (primaryInsert.error && isMissingWebServicesSchema(primaryInsert.error)) {
      const legacyInsert = await adminClient
        .from("services")
        .insert({
          name,
          category,
          description,
          base_url: null,
          avg_latency: baseLatencyEstimate,
          tags,
          status: toLegacyStatus(isActive),
          created_by: user.id,
        })
        .select("id")
        .single();

      if (legacyInsert.error) {
        return jsonResponse({ error: "Failed to create legacy service", details: legacyInsert.error.message }, 500, req);
      }
      createdServiceId = String(legacyInsert.data?.id ?? "");
    }

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "web_service_create",
      resource: "web_services",
      status: "success",
      target_user_id: user.id,
      target_email: user.email ?? null,
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason: `Created service ${createdServiceId}`,
      metadata: { service_id: createdServiceId, payload },
    });

    return jsonResponse({ success: true, action: "created", service_id: createdServiceId }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
