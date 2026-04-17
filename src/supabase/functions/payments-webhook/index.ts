import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",")[0].trim(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const textEncoder = new TextEncoder();
const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

const signaturesMatch = async (secret: string, payload: string, providedSignature?: string | null): Promise<boolean> => {
  if (!providedSignature) return false;
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toHex(signatureBuffer) === providedSignature;
};

type CreditTokensResponse = {
  success: boolean;
  balance?: number;
  credited?: number;
  idempotent?: boolean;
  error?: string;
};

const normalizeTeamEligiblePlan = (value: unknown): "pro" | "enterprise" | null => {
  const plan = String(value ?? "").trim().toLowerCase();
  if (plan === "pro" || plan === "enterprise") return plan;
  return null;
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) return jsonResponse({ error: "Supabase environment is not configured." }, 500);
  if (!webhookSecret) return jsonResponse({ error: "Razorpay webhook secret is not configured." }, 500);

  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const valid = await signaturesMatch(webhookSecret, bodyText, signature);
    if (!valid) return jsonResponse({ error: "Invalid webhook signature." }, 400);

    const payload = JSON.parse(bodyText) as RazorpayWebhookPayload;
    if (payload.event !== "payment.captured") {
      return jsonResponse({ received: true, skipped: true, reason: "Unhandled event type." });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    if (!orderId || !paymentId) return jsonResponse({ error: "Missing order_id or payment id in webhook payload." }, 400);

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, user_id, status, tokens_purchased, pack_name, plan_name")
      .eq("gateway_order_id", orderId)
      .maybeSingle();

    if (paymentError) return jsonResponse({ error: "Failed to load payment record", details: paymentError.message }, 500);
    if (!payment) return jsonResponse({ received: true, skipped: true, reason: "Payment not found." });
    if (payment.status === "success") return jsonResponse({ success: true, idempotent: true });

    let parsedCredit: CreditTokensResponse | null = null;
    let creditErrorMessage: string | null = null;

    const { data: creditWithPackData, error: creditWithPackError } = await adminClient.rpc("credit_tokens", {
      p_user_id: payment.user_id,
      p_amount: payment.tokens_purchased,
      p_payment_id: payment.id,
      p_pack_name: payment.pack_name ?? "custom",
    });

    if (!creditWithPackError) {
      parsedCredit = (creditWithPackData ?? {}) as CreditTokensResponse;
    } else {
      const { data: creditFallbackData, error: creditFallbackError } = await adminClient.rpc("credit_tokens", {
        p_user_id: payment.user_id,
        p_amount: payment.tokens_purchased,
        p_payment_id: payment.id,
      });
      if (creditFallbackError) {
        creditErrorMessage = `${creditWithPackError.message} | fallback: ${creditFallbackError.message}`;
      } else {
        parsedCredit = (creditFallbackData ?? {}) as CreditTokensResponse;
      }
    }

    if (!parsedCredit) {
      return jsonResponse({ error: "Failed to credit tokens", details: creditErrorMessage ?? "credit_tokens failed" }, 500);
    }

    if (!parsedCredit.success) return jsonResponse({ error: parsedCredit.error ?? "credit_tokens failed", details: parsedCredit }, 500);

    const { error: updateError } = await adminClient
      .from("payments")
      .update({ status: "success", gateway_payment_id: paymentId })
      .eq("id", payment.id);

    if (updateError) return jsonResponse({ error: "Failed to update payment status", details: updateError.message }, 500);

    const planFromPayment =
      normalizeTeamEligiblePlan(payment.plan_name) ??
      normalizeTeamEligiblePlan(payment.pack_name);

    if (planFromPayment) {
      const { data: authUserData } = await adminClient.auth.admin.getUserById(payment.user_id);
      await adminClient.from("user_profiles").upsert(
        {
          id: payment.user_id,
          email: authUserData?.user?.email ?? `${payment.user_id}@local.user`,
          performance_plan: planFromPayment,
        },
        { onConflict: "id" },
      );

      // Update or create subscription record with active status for team-eligible plans
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error: subscriptionError } = await adminClient
        .from("subscriptions")
        .upsert(
          {
            user_id: payment.user_id,
            plan: planFromPayment,
            status: "active",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
          },
          { onConflict: "user_id" },
        );

      if (subscriptionError) {
        console.error("Failed to update subscription status:", subscriptionError);
        // Don't fail the webhook if subscription update fails
        // The payment is already successful
      }
    }

    return jsonResponse({ success: true, credited: parsedCredit.credited ?? payment.tokens_purchased });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});

