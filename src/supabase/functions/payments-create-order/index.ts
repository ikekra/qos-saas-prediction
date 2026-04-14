import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type PackName = "student" | "basic" | "pro" | "enterprise" | "starter" | "growth" | "custom";

type CreateOrderBody = {
  pack?: PackName;
  customAmount?: number;
};

type PackConfig = {
  amountInRupees: number;
  tokens: number;
};

type CreditTokensResponse = {
  success: boolean;
  balance?: number;
  credited?: number;
  idempotent?: boolean;
  error?: string;
};

const PACKS: Record<Exclude<PackName, "custom">, PackConfig> = {
  student: { amountInRupees: 99, tokens: 5000 },
  basic: { amountInRupees: 299, tokens: 15000 },
  pro: { amountInRupees: 999, tokens: 50000 },
  enterprise: { amountInRupees: 2499, tokens: 150000 },
  starter: { amountInRupees: 99, tokens: 5000 },
  growth: { amountInRupees: 299, tokens: 15000 },
};

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

const normalizeCustomAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paymentModeRaw = (Deno.env.get("PAYMENT_MODE") ?? Deno.env.get("BILLING_MODE") ?? "sandbox").toLowerCase();
  const isMockMode = paymentModeRaw === "mock" || paymentModeRaw === "sandbox" || paymentModeRaw === "test";
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  }

  if (!isMockMode && (!razorpayKeyId || !razorpayKeySecret)) {
    return jsonResponse({ error: "Razorpay keys are not configured." }, 500);
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
    const pack = body.pack;
    if (!pack || !["student", "basic", "pro", "enterprise", "starter", "growth", "custom"].includes(pack)) {
      return jsonResponse({ error: "Invalid pack value." }, 400);
    }

    let amountInRupees: number;
    let tokensPurchased: number;
    const packName: PackName = pack;

    if (pack === "custom") {
      const customAmount = normalizeCustomAmount(body.customAmount);
      if (!customAmount || customAmount <= 0) {
        return jsonResponse({ error: "customAmount must be a positive number." }, 400);
      }
      amountInRupees = customAmount;
      tokensPurchased = customAmount * 25;
    } else {
      const selected = PACKS[pack];
      amountInRupees = selected.amountInRupees;
      tokensPurchased = selected.tokens;
    }

    const amountInPaise = amountInRupees * 100;
    const idempotencyKey = crypto.randomUUID();

    let gatewayOrderId: string | undefined;
    if (isMockMode) {
      gatewayOrderId = `mock_order_${idempotencyKey}`;
    } else {
      const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      const receipt = `pay_${idempotencyKey}`;

      const razorpayRes = await fetch(RAZORPAY_ORDERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${razorpayAuth}` },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt,
          notes: {
            user_id: user.id,
            pack_name: packName,
            tokens_purchased: String(tokensPurchased),
            idempotency_key: idempotencyKey,
          },
        }),
      });

      if (!razorpayRes.ok) {
        const errText = await razorpayRes.text().catch(() => "");
        return jsonResponse({ error: "Failed to create Razorpay order", details: errText || razorpayRes.statusText }, 502);
      }

      const razorpayOrder = await razorpayRes.json();
      gatewayOrderId = razorpayOrder?.id as string | undefined;
    }

    if (!gatewayOrderId) return jsonResponse({ error: "Payment order ID was not generated." }, 502);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    let paymentRow: { id: string } | null = null;

    const { data: fullInsertRow, error: insertError } = await adminClient
      .from("payments")
      .insert({
        user_id: user.id,
        gateway_order_id: gatewayOrderId,
        amount_in_paise: amountInPaise,
        tokens_purchased: tokensPurchased,
        status: "pending",
        idempotency_key: idempotencyKey,
        pack_name: packName,
      })
      .select("id")
      .single();

    if (!insertError) {
      paymentRow = fullInsertRow;
    } else {
      const insertMessage = insertError.message?.toLowerCase() ?? "";
      const isColumnMismatch = insertMessage.includes("column") && insertMessage.includes("does not exist");
      if (!isColumnMismatch) {
        return jsonResponse({ error: "Failed to save payment record", details: insertError.message }, 500);
      }

      const { data: minimalInsertRow, error: minimalInsertError } = await adminClient
        .from("payments")
        .insert({
          user_id: user.id,
          gateway_order_id: gatewayOrderId,
          amount_in_paise: amountInPaise,
          tokens_purchased: tokensPurchased,
          status: "pending",
        })
        .select("id")
        .single();

      if (minimalInsertError) {
        return jsonResponse({
          error: "Failed to save payment record",
          details: minimalInsertError.message,
          fallbackDetails: insertError.message,
        }, 500);
      }

      paymentRow = minimalInsertRow;
    }

    if (isMockMode) {
      let creditResult: CreditTokensResponse | null = null;
      let creditErrorMessage: string | null = null;

      const { data: creditWithPackData, error: creditWithPackError } = await adminClient.rpc("credit_tokens", {
        p_user_id: user.id,
        p_amount: tokensPurchased,
        p_payment_id: paymentRow!.id,
        p_pack_name: packName,
      });

      if (!creditWithPackError) {
        creditResult = (creditWithPackData ?? {}) as CreditTokensResponse;
      } else {
        const { data: creditFallbackData, error: creditFallbackError } = await adminClient.rpc("credit_tokens", {
          p_user_id: user.id,
          p_amount: tokensPurchased,
          p_payment_id: paymentRow!.id,
        });
        if (creditFallbackError) {
          creditErrorMessage = `${creditWithPackError.message} | fallback: ${creditFallbackError.message}`;
        } else {
          creditResult = (creditFallbackData ?? {}) as CreditTokensResponse;
        }
      }

      if (!creditResult) {
        return jsonResponse({
          error: "Failed to credit tokens in mock mode",
          details: creditErrorMessage ?? "credit_tokens failed",
        }, 500);
      }

      if (!creditResult.success) {
        return jsonResponse({ error: creditResult.error ?? "credit_tokens failed", details: creditResult }, 500);
      }

      const { error: updateError } = await adminClient
        .from("payments")
        .update({
          status: "success",
          gateway_payment_id: `mock_payment_${idempotencyKey}`,
        })
        .eq("id", paymentRow!.id);

      if (updateError) {
        return jsonResponse({ error: "Failed to mark mock payment as success", details: updateError.message }, 500);
      }

      return jsonResponse({
        orderId: gatewayOrderId,
        amount: amountInPaise,
        currency: "INR",
        key: "mock_key",
        pack: packName,
        tokensPurchased,
        billingMode: "mock",
        isMock: true,
        isMockAutoVerified: true,
        credited: creditResult.credited ?? tokensPurchased,
        newBalance: creditResult.balance ?? null,
      });
    }

    return jsonResponse({
      orderId: gatewayOrderId,
      amount: amountInPaise,
      currency: "INR",
      key: isMockMode ? "mock_key" : razorpayKeyId,
      pack: packName,
      tokensPurchased,
      billingMode: isMockMode ? "mock" : "real",
      isMock: isMockMode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});

