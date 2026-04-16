import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

const resolveAllowedOrigin = (req?: Request) => {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080";
  const allowed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowed.includes("*")) return "*";
  const requestOrigin = req?.headers.get("origin")?.trim();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return requestOrigin ?? allowed[0] ?? "*";
};

const getSseHeaders = (req?: Request) => ({
  "Access-Control-Allow-Origin": resolveAllowedOrigin(req),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getSseHeaders(req) });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: getSseHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    return new Response("Missing environment", { status: 500, headers: getSseHeaders(req) });
  }

  const url = new URL(req.url);
  const accessToken = url.searchParams.get("access_token") ?? "";
  if (!accessToken) return new Response("Missing access token", { status: 401, headers: getSseHeaders(req) });

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: getSseHeaders(req) });

  const admin = createClient(supabaseUrl, serviceRole);

  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const sendComment = (text: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ${text}\n\n`));
      };

      send({ type: "CONNECTED", timestamp: new Date().toISOString() });

      let lastBalance: number | null = null;
      let lastTopupId: string | null = null;
      let lastTxId: string | null = null;
      let lastPaymentState: string | null = null;

      const heartbeat = setInterval(() => sendComment("ping"), 30000);

      const poll = async () => {
        while (!closed) {
          const [profileRes, topupRes, txRes, paymentRes] = await Promise.all([
            admin
              .from("user_profiles")
              .select("token_balance, lifetime_tokens_used")
              .eq("id", user.id)
              .limit(1),
            admin
              .from("topup_records")
              .select("id, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1),
            admin
              .from("token_transactions")
              .select("id, type, amount, balance_after, description, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1),
            admin
              .from("payments")
              .select("id, status, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);

          const profile = (profileRes.data?.[0] as { token_balance?: number; lifetime_tokens_used?: number } | undefined) ?? {};
          const currentBalance = Number(profile.token_balance ?? 0);
          const currentLifetime = Number(profile.lifetime_tokens_used ?? 0);
          const currentTopupId = (topupRes.data?.[0] as { id?: string } | undefined)?.id ?? null;
          const txRow =
            (txRes.data?.[0] as {
              id?: string;
              type?: "credit" | "debit";
              amount?: number;
              balance_after?: number;
              description?: string;
            } | undefined) ?? {};
          const currentTxId = txRow.id ?? null;
          const paymentRow = (paymentRes.data?.[0] as { id?: string; status?: string } | undefined) ?? {};
          const currentPaymentState = paymentRow.id ? `${paymentRow.id}:${paymentRow.status ?? "unknown"}` : null;

          if (lastBalance === null || currentBalance !== lastBalance) {
            lastBalance = currentBalance;
            send({
              type: "TOKEN_UPDATED",
              newBalance: currentBalance,
              lifetimeUsed: currentLifetime,
              timestamp: new Date().toISOString(),
            });
          }

          if (currentTopupId && currentTopupId !== lastTopupId) {
            lastTopupId = currentTopupId;
            send({
              type: "BILLING_UPDATED",
              transactionId: currentTopupId,
              timestamp: new Date().toISOString(),
            });
          }

          if (currentTxId && currentTxId !== lastTxId) {
            lastTxId = currentTxId;
            const txType = txRow.type ?? "debit";
            const txDescription = String(txRow.description ?? "").toLowerCase();
            const txEventType =
              txType === "debit"
                ? "TOKEN_DEDUCTED"
                : txDescription.includes("refund")
                  ? "TOKEN_REFUNDED"
                  : "TOKEN_TOPUP";
            const txBalance =
              typeof txRow.balance_after === "number" ? Number(txRow.balance_after) : currentBalance;
            send({
              type: txEventType,
              newBalance: txBalance,
              balance: txBalance,
              amount: Number(txRow.amount ?? 0),
              lifetimeUsed: currentLifetime,
              transactionId: currentTxId,
              timestamp: new Date().toISOString(),
            });
            send({
              type: "BILLING_UPDATED",
              transactionId: currentTxId,
              timestamp: new Date().toISOString(),
            });
          }

          if (currentPaymentState && currentPaymentState !== lastPaymentState) {
            lastPaymentState = currentPaymentState;
            send({
              type: "BILLING_UPDATED",
              transactionId: paymentRow.id ?? null,
              status: paymentRow.status ?? null,
              timestamp: new Date().toISOString(),
            });
          }

          await wait(2500);
        }
      };

      poll().catch((err) => {
        console.error("token-stream poll error", err);
      });

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: getSseHeaders(req) });
});

