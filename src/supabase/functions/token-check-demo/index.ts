import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { withTokenCheck } from "../_shared/token-check.ts";

const TOKENS_PER_CALL = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  return withTokenCheck(
    req,
    TOKENS_PER_CALL,
    "Dummy protected API call",
    async ({ user, tokenResult }) =>
      jsonResponse({
        success: true,
        message: `Token check passed. ${TOKENS_PER_CALL} tokens deducted.`,
        userId: user.id,
        deducted: tokenResult.deducted ?? TOKENS_PER_CALL,
        balance: tokenResult.balance ?? null,
      }),
  );
});
