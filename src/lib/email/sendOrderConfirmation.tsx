import { render } from "@react-email/render";
import OrderConfirmationEmail from "@/emails/order-confirmation";
import { getServerCompanyProfile } from "@/lib/brand/server-company";
import { createMailTransport } from "@/lib/email/create-transport";
import { loadOrderDocumentData } from "@/lib/order/order-document-data";
import { renderOrderInvoicePdfBuffer } from "@/lib/pdf/invoice";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const TEMPLATE = "order_confirmation";
const TEMPLATE_RESEND = "order_confirmation_resend";

const POST_PAYMENT_STATUSES = ["paid", "in_production", "shipped", "delivered"];

export type SendOrderConfirmationResult =
  | { ok: true; skipped?: boolean; template: string }
  | { ok: false; code: "invalid_order" | "smtp_missing" | "send_failed"; message?: string };

export async function sendOrderConfirmation(
  orderId: string,
  options?: { force?: boolean },
): Promise<SendOrderConfirmationResult> {
  const force = options?.force === true;
  const service = createSupabaseServiceRoleClient();

  if (!force) {
    const { data: existing } = await service
      .from("email_logs")
      .select("id")
      .eq("order_id", orderId)
      .eq("template", TEMPLATE)
      .eq("status", "sent")
      .maybeSingle();

    if (existing) {
      console.info("[sendOrderConfirmation] skip duplicate:", orderId);
      return { ok: true, skipped: true, template: TEMPLATE };
    }
  }

  const logTemplate = force ? TEMPLATE_RESEND : TEMPLATE;

  const data = await loadOrderDocumentData(service, orderId);
  if (!data || !POST_PAYMENT_STATUSES.includes(data.order.status)) {
    console.warn("[sendOrderConfirmation] order missing or not payable:", orderId);
    return { ok: false, code: "invalid_order" };
  }

  const from = process.env.SMTP_FROM;
  if (!from) {
    console.error("[sendOrderConfirmation] SMTP_FROM fehlt.");
    await service.from("email_logs").insert({
      order_id: orderId,
      template: logTemplate,
      status: "failed",
      error: { message: "SMTP_FROM fehlt" },
    });
    return { ok: false, code: "smtp_missing", message: "SMTP_FROM fehlt" };
  }

  const orderNo = data.order.order_number ?? data.order.id.slice(0, 8).toUpperCase();
  const company = getServerCompanyProfile();
  const subject = `Bestellbestätigung #${orderNo} – ${company.brandName}`;

  try {
    const element = <OrderConfirmationEmail data={data} company={company} />;
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const pdfBuffer = await renderOrderInvoicePdfBuffer(data);
    const transport = createMailTransport();

    await transport.sendMail({
      from,
      to: data.customer.email,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `Rechnung-${orderNo}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    const { error: logErr } = await service.from("email_logs").insert({
      order_id: orderId,
      template: logTemplate,
      status: "sent",
    });
    if (logErr) {
      console.error("[sendOrderConfirmation] email_logs insert failed", logErr);
    }
    return { ok: true, template: logTemplate };
  } catch (e) {
    console.error("[sendOrderConfirmation] send failed", e);
    await service.from("email_logs").insert({
      order_id: orderId,
      template: logTemplate,
      status: "failed",
      error: { message: e instanceof Error ? e.message : String(e) },
    });
    return {
      ok: false,
      code: "send_failed",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
