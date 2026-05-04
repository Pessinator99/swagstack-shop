/** Stripe Dashboard URL for a PaymentIntent (test vs live from secret key). */
export function stripePaymentIntentDashboardUrl(paymentIntentId: string): string {
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test");
  const base = isTest
    ? "https://dashboard.stripe.com/test/payments"
    : "https://dashboard.stripe.com/payments";
  return `${base}/${encodeURIComponent(paymentIntentId)}`;
}

export function stripeCheckoutSessionDashboardUrl(sessionId: string): string {
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test");
  const base = isTest ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";
  return `${base}/checkout/sessions/${encodeURIComponent(sessionId)}`;
}
