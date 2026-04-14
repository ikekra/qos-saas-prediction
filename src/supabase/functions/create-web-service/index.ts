import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

const normalizeString = (value: unknown) => String(value ?? "").trim();

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Supabase environment is not configured." }, 500, req);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const body = await req.json().catch(() => ({}));
    const name = normalizeString((body as Record<string, unknown>).name);
    const provider = normalizeString((body as Record<string, unknown>).provider);
    const category = normalizeString((body as Record<string, unknown>).category);
    const baseUrl = normalizeString((body as Record<string, unknown>).base_url);
    const description = normalizeString((body as Record<string, unknown>).description);

    if (!name || !provider || !category || !baseUrl || !description) {
      return jsonResponse({ error: "Missing required fields" }, 400, req);
    }

    try {
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return jsonResponse({ error: "base_url must use http or https" }, 400, req);
      }
    } catch {
      return jsonResponse({ error: "base_url must be a valid URL" }, 400, req);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const existing = await serviceClient
      .from("web_services")
      .select("id")
      .eq("base_url", baseUrl)
      .maybeSingle();

    if (existing.error) {
      return jsonResponse({ error: "Failed to check existing services", details: existing.error.message }, 500, req);
    }

    if (existing.data?.id) {
      return jsonResponse({ error: "A service with this base URL already exists." }, 409, req);
    }

    const { data, error } = await serviceClient
      .from("web_services")
      .insert({
        name,
        service_name: name,
        provider,
        category,
        base_url: baseUrl,
        description,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 500, req);
    }

    return jsonResponse({ success: true, service: data }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonResponse({ error: message }, 500, req);
  }
});
