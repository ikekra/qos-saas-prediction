import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

type DeductTokensResult = {
  success: boolean;
  error?: string;
  balance?: number;
  required?: number;
  deducted?: number;
  idempotent?: boolean;
};

type TokenCheckContext = {
  user: User;
  supabase: ReturnType<typeof createClient>;
  tokenResult: DeductTokensResult;
};

type TokenCheckedHandler = (ctx: TokenCheckContext) => Promise<Response>;

export async function withTokenCheck(
  req: Request,
  estimatedTokens: number,
  description: string,
  handler: TokenCheckedHandler,
): Promise<Response> {
  if (!Number.isFinite(estimatedTokens) || estimatedTokens <= 0) {
    return jsonResponse({ error: "Invalid estimated token amount" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authorization },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const endpoint = new URL(req.url).pathname;
  const requestId = crypto.randomUUID();

  const { data, error } = await supabase.rpc("deduct_tokens", {
    p_user_id: user.id,
    p_amount: estimatedTokens,
    p_description: description,
    p_endpoint: endpoint,
    p_request_id: requestId,
  });

  if (error) {
    return jsonResponse(
      {
        error: "Failed to deduct tokens",
        details: error.message,
      },
      500,
    );
  }

  const tokenResult = (data ?? {}) as DeductTokensResult;

  if (!tokenResult.success) {
    return jsonResponse(
      {
        error: tokenResult.error ?? "Insufficient tokens",
        balance: tokenResult.balance ?? 0,
        required: tokenResult.required ?? estimatedTokens,
      },
      402,
    );
  }

  return handler({
    user,
    supabase,
    tokenResult,
  });
}
