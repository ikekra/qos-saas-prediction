import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type PackName = "starter" | "growth" | "pro" | "custom";

type CreateOrderBody = {
  pack?: PackName;
  customAmount?: number;
};

type PackConfig = {
  amountInRupees: number;
  tokens: number;
};

const PACKS: Record<Exclude<PackName, "custom">, PackConfig> = {
  starter: { amountInRupees: 199, tokens: 50000 },
  growth: { amountInRupees: 499, tokens: 150000 },
  pro: { amountInRupees: 999, tokens: 400000 },
};

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

const normalizeCustomAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  }

  if (!razorpayKeyId || !razorpayKeySecret) {
    return jsonResponse({ error: "Razorpay keys are not configured." }, 500);
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as CreateOrderBody;
    const pack = body.pack;

    if (!pack || !["starter", "growth", "pro", "custom"].includes(pack)) {
      return jsonResponse({ error: "Invalid pack value." }, 400);
    }

    let amountInRupees: number;
    let tokensPurchased: number;
    let packName: PackName = pack;

    if (pack === "custom") {
      const customAmount = normalizeCustomAmount(body.customAmount);
      if (!customAmount || customAmount <= 0) {
        return jsonResponse({ error: "customAmount must be a positive number." }, 400);
      }
      amountInRupees = customAmount;
      tokensPurchased = customAmount * 25;
      packName = "custom";
    } else {
      const selected = PACKS[pack];
      amountInRupees = selected.amountInRupees;
      tokensPurchased = selected.tokens;
    }

    const amountInPaise = amountInRupees * 100;
    const idempotencyKey = crypto.randomUUID();

    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const receipt = `pay_${idempotencyKey}`;

    const razorpayRes = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${razorpayAuth}`,
      },
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
      return jsonResponse(
        {
          error: "Failed to create Razorpay order",
          details: errText || razorpayRes.statusText,
        },
        502,
      );
    }

    const razorpayOrder = await razorpayRes.json();
    const gatewayOrderId = razorpayOrder?.id as string | undefined;

    if (!gatewayOrderId) {
      return jsonResponse({ error: "Razorpay did not return an order ID." }, 502);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: insertError } = await adminClient.from("payments").insert({
      user_id: user.id,
      gateway_order_id: gatewayOrderId,
      amount_in_paise: amountInPaise,
      tokens_purchased: tokensPurchased,
      status: "pending",
      idempotency_key: idempotencyKey,
      pack_name: packName,
    });

    if (insertError) {
      return jsonResponse(
        {
          error: "Failed to save payment record",
          details: insertError.message,
        },
        500,
      );
    }

    return jsonResponse({
      orderId: gatewayOrderId,
      amount: amountInPaise,
      currency: "INR",
      key: razorpayKeyId,
      pack: packName,
      tokensPurchased,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
