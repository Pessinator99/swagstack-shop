import { NextResponse } from "next/server";
import { assertAdminApi } from "@/lib/admin/assert-admin-api";
import { sendOrderConfirmation } from "@/lib/email/sendOrderConfirmation";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await assertAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Ungültige Bestell-ID." }, { status: 400 });
  }

  const result = await sendOrderConfirmation(id, { force: true });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message ?? result.code },
      { status: result.code === "invalid_order" ? 400 : 500 },
    );
  }

  return NextResponse.json({ sent: true });
}
