import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sendOrderConfirmation } from "@/lib/email/sendOrderConfirmation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStripeServerClient } from "@/lib/stripe/client";

export const runtime = "nodejs";

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi) return pi.id;
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET fehlt.");
    return new Response("Webhook not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[stripe-webhook] body read failed", e);
    return new Response("Bad body", { status: 400 });
  }

  const stripe = getStripeServerClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verify failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const service = createSupabaseServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.warn("[stripe-webhook] checkout.session.completed ohne metadata.order_id");
          break;
        }

        const { data: order, error: fetchErr } = await service
          .from("orders")
          .select("id, order_number, status, customer_id")
          .eq("id", orderId)
          .maybeSingle();

        if (fetchErr) {
          console.error("[stripe-webhook] order fetch", fetchErr);
          break;
        }
        if (!order) {
          console.warn("[stripe-webhook] order nicht gefunden:", orderId);
          break;
        }

        if (order.status === "paid") {
          console.info("[stripe-webhook] already processed:", order.order_number);
          break;
        }

        const piId = paymentIntentId(session);
        const { data: updatedRows, error: updateErr } = await service
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: piId,
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "pending")
          .select("id");

        if (updateErr) {
          console.error("[stripe-webhook] order update failed", updateErr);
          break;
        }
        if (!updatedRows?.length) {
          console.info("[stripe-webhook] already processed (race):", order.order_number);
          break;
        }

        const { error: cartErr } = await service.from("cart_items").delete().eq("customer_id", order.customer_id);
        if (cartErr) {
          console.error("[stripe-webhook] cart cleanup failed", cartErr);
        }

        const mailResult = await sendOrderConfirmation(orderId);
        if (!mailResult.ok) {
          console.warn("[stripe-webhook] order confirmation mail:", orderId, mailResult);
        }

        console.info("[stripe-webhook] paid:", order.order_number);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.warn("[stripe-webhook] checkout.session.expired ohne metadata.order_id");
          break;
        }
        const { data: order } = await service
          .from("orders")
          .select("id, order_number, status")
          .eq("id", orderId)
          .maybeSingle();
        if (!order) break;
        if (order.status !== "pending") break;
        await service.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
        console.info("[stripe-webhook] expired:", orderId, order.order_number);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.info("[stripe-webhook] payment_intent.payment_failed:", pi.id);
        break;
      }

      default:
        console.info("[stripe-webhook] unhandled:", event.type);
    }
  } catch (e) {
    console.error("[stripe-webhook] handler error", e);
  }

  return NextResponse.json({ received: true });
}
