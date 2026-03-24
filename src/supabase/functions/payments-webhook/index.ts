import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { signaturesMatch } from "../_shared/razorpay.ts";

type CreditTokensResponse = {
  success: boolean;
  balance?: number;
  credited?: number;
  idempotent?: boolean;
  error?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  }

  if (!webhookSecret) {
    return jsonResponse({ error: "Razorpay webhook secret is not configured." }, 500);
  }

  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const valid = await signaturesMatch(webhookSecret, bodyText, signature);

    if (!valid) {
      return jsonResponse({ error: "Invalid webhook signature." }, 400);
    }

    const payload = JSON.parse(bodyText) as RazorpayWebhookPayload;

    if (payload.event !== "payment.captured") {
      return jsonResponse({ received: true, skipped: true, reason: "Unhandled event type." });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId || !paymentId) {
      return jsonResponse({ error: "Missing order_id or payment id in webhook payload." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, user_id, status, tokens_purchased, pack_name")
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (paymentError) {
      return jsonResponse(
        { error: "Failed to load payment record", details: paymentError.message },
        500,
      );
    }

    if (!payment) {
      return jsonResponse({ received: true, skipped: true, reason: "Payment not found." });
    }

    if (payment.status === "success") {
      return jsonResponse({ success: true, idempotent: true });
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

    return jsonResponse({ success: true, credited: parsedCredit.credited ?? payment.tokens_purchased });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
