import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);

  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return jsonResponse({ success: true, skipped: true, mode: "demo", reason: "No webhook body provided." }, 200, req);
    }

    return jsonResponse(
      {
        success: true,
        skipped: true,
        mode: "demo",
        reason: "Live payment webhooks are disabled in demo billing mode.",
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
