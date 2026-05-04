import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminApi } from "@/lib/admin/assert-admin-api";
import { canAdminSetOrderStatus } from "@/lib/admin/order-status-transitions";
import type { OrderStatus } from "@/types/database";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  status: z.enum(["paid", "in_production", "shipped", "delivered", "cancelled"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { supabase } = gate.ctx;

  const { data: order, error: loadErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !order) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 });
  }

  const from = order.status as OrderStatus;
  const to = body.status as OrderStatus;

  if (!canAdminSetOrderStatus(from, to)) {
    return NextResponse.json({ error: "Status-Übergang nicht erlaubt." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status: to };
  if (to === "shipped") {
    updates.shipped_at = new Date().toISOString();
  }

  const { data: updated, error: upErr } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select("id, status, order_number")
    .maybeSingle();

  if (upErr || !updated) {
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ order: updated });
}
