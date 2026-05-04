import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOrderDocumentData } from "@/lib/order/order-document-data";
import { renderOrderInvoicePdfBuffer } from "@/lib/pdf/invoice";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INVOICE_STATUSES = new Set(["paid", "in_production", "shipped", "delivered"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return new Response("Ungültige Bestell-ID", { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
  const isAdmin = Boolean(adminRow);

  const data = await loadOrderDocumentData(supabase, id);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const isOwner = data.order.customer_id === user.id;
  if (!isAdmin && !isOwner) {
    return new Response("Not found", { status: 404 });
  }

  if (!INVOICE_STATUSES.has(data.order.status)) {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await renderOrderInvoicePdfBuffer(data);
  const orderNo = data.order.order_number ?? id.slice(0, 8).toUpperCase();
  const filename = `Rechnung-${orderNo}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
