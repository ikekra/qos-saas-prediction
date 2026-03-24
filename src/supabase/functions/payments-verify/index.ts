import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { signaturesMatch } from "../_shared/razorpay.ts";

type VerifyBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

type CreditTokensResponse = {
  success: boolean;
  balance?: number;
  credited?: number;
  idempotent?: boolean;
  error?: string;
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
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  }

  if (!razorpayKeySecret) {
    return jsonResponse({ error: "Razorpay key secret is not configured." }, 500);
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

    const body = (await req.json().catch(() => ({}))) as VerifyBody;
    const orderId = body.razorpay_order_id?.trim();
    const paymentId = body.razorpay_payment_id?.trim();
    const signature = body.razorpay_signature?.trim();

    if (!orderId || !paymentId || !signature) {
      return jsonResponse(
        {
          error:
            "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.",
        },
        400,
      );
    }

    const signaturePayload = `${orderId}|${paymentId}`;
    const isValid = await signaturesMatch(razorpayKeySecret, signaturePayload, signature);

    if (!isValid) {
      return jsonResponse({ error: "Invalid Razorpay signature." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, user_id, status, tokens_purchased, pack_name, gateway_payment_id")
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (paymentError) {
      return jsonResponse(
        { error: "Failed to load payment record", details: paymentError.message },
        500,
      );
    }

    if (!payment) {
      return jsonResponse({ error: "Payment record not found." }, 404);
    }

    if (payment.user_id !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (payment.status === "success") {
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("token_balance")
        .eq("id", user.id)
        .maybeSingle();

      return jsonResponse({
        success: true,
        idempotent: true,
        newBalance: profile?.token_balance ?? null,
      });
    }

    const { data: creditResult, error: creditError } = await adminClient.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.tokens_purchased,
      p_payment_id: payment.id,
      p_pack_name: payment.pack_name ?? "custom",
    });

    if (creditError) {
      return jsonResponse(
        { error: "Failed to credit tokens", details: creditError.message },
        500,
      );
    }

    const parsedCredit = (creditResult ?? {}) as CreditTokensResponse;
    if (!parsedCredit.success) {
      return jsonResponse(
        { error: parsedCredit.error ?? "credit_tokens failed", details: parsedCredit },
        500,
      );
    }

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "success",
        gateway_payment_id: paymentId,
      })
      .eq("id", payment.id);

    if (updateError) {
      return jsonResponse(
        { error: "Failed to update payment status", details: updateError.message },
        500,
      );
    }

    return jsonResponse({
      success: true,
      newBalance: parsedCredit.balance ?? null,
      credited: parsedCredit.credited ?? payment.tokens_purchased,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
