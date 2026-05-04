import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeServerClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt.");
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY muss mit sk_test_ oder sk_live_ beginnen.");
  }
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
  });
  return stripeClient;
}
