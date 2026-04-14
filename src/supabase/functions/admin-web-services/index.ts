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
      const { data, error } = await adminClient
        .from("web_services")
        .select("id, name, category, logo_url, provider, description, base_latency_estimate, availability_score, is_active, tags, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) return jsonResponse({ error: "Failed to load services", details: error.message }, 500, req);

      return jsonResponse({ success: true, services: (data ?? []) as WebServiceRow[] }, 200, req);
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
      const { error: updateErr } = await adminClient
        .from("web_services")
        .update(payload)
        .eq("id", id);
      if (updateErr) return jsonResponse({ error: "Failed to update service", details: updateErr.message }, 500, req);

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

    const { data: inserted, error: insertErr } = await adminClient
      .from("web_services")
      .insert(payload)
      .select("id")
      .single();

    if (insertErr) return jsonResponse({ error: "Failed to create service", details: insertErr.message }, 500, req);

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
      reason: `Created service ${inserted.id}`,
      metadata: { service_id: inserted.id, payload },
    });

    return jsonResponse({ success: true, action: "created", service_id: inserted.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
