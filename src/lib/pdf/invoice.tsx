import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { getServerCompanyProfile } from "@/lib/brand/server-company";
import type { OrderDocumentData } from "@/lib/order/order-document-data";
import { addressesDiffer, vatPercentLabel } from "@/lib/order/order-document-data";
import { formatEurCents } from "@/lib/pdf/format-eur";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: "#1a1a1a",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#3F5C3A",
    justifyContent: "center",
    alignItems: "center",
  },
  logoLetter: { color: "#fff", fontSize: 18, fontWeight: 700 },
  companyBlock: { maxWidth: 220 },
  companyName: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  metaBlock: { alignItems: "flex-end" },
  metaTitle: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  metaLine: { fontSize: 9, marginBottom: 2 },
  addressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 16 },
  addressCol: { width: "48%" },
  addressTitle: { fontSize: 8, fontWeight: 700, marginBottom: 4, color: "#444" },
  addressText: { fontSize: 9, lineHeight: 1.35 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 4,
    marginTop: 8,
    fontWeight: 700,
    fontSize: 8,
  },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5" },
  colPos: { width: "6%" },
  colDesc: { width: "44%" },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "18%", textAlign: "right" },
  colLine: { width: "18%", textAlign: "right" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 220 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3, fontSize: 9 },
  totalBold: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 700 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#555",
    lineHeight: 1.35,
  },
  stripeNote: { fontSize: 9, fontWeight: 700, marginBottom: 4, color: "#3F5C3A" },
});

function formatAddressLines(raw: Record<string, unknown> | null): string {
  if (!raw) return "";
  const company = String(raw.companyName ?? raw.company_name ?? "");
  const contact = String(raw.contactPerson ?? raw.contact_person ?? "");
  const street = String(raw.street ?? "");
  const zip = String(raw.zip ?? "");
  const city = String(raw.city ?? "");
  const country = String(raw.country ?? "");
  const phone = String(raw.phone ?? "");
  return [company, contact, street, `${zip} ${city}`.trim(), country, phone].filter(Boolean).join("\n");
}

function itemDescription(snap: OrderDocumentData["items"][0]["product_snapshot"]): string {
  if (!snap) return "Position";
  const name = snap.productName ?? "Produkt";
  const parts = [name];
  if (snap.variant) parts.push(`Variante: ${snap.variant}`);
  const ver = [snap.printTechnique, snap.printArea].filter(Boolean).join(", ");
  if (ver) parts.push(`Veredelung: ${ver}`);
  return parts.join("\n");
}

function customerNumberShort(id: string): string {
  return id.replace(/-/g, "").slice(0, 10).toUpperCase();
}

export function OrderInvoicePdf({ data }: { data: OrderDocumentData }) {
  const company = getServerCompanyProfile();
  const { order, items, customer } = data;
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date();
  const dateStr = format(paidAt, "dd.MM.yyyy", { locale: de });
  const billing = order.billing_address;
  const shipping = order.shipping_address;
  const showShip = addressesDiffer(billing, shipping);
  const vatLabel = vatPercentLabel(order.subtotal_cents, order.vat_cents);

  return (
    <Document title={`Rechnung ${order.order_number ?? ""}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow} fixed>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>W</Text>
            </View>
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{company.companyName}</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.35 }}>
                {company.street}
                {"\n"}
                {company.zipCity}
                {"\n"}
                {company.country}
              </Text>
            </View>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>RECHNUNG</Text>
            <Text style={styles.metaLine}>Rechnungsnr.: {order.order_number ?? "—"}</Text>
            <Text style={styles.metaLine}>Rechnungsdatum: {dateStr}</Text>
            <Text style={styles.metaLine}>Leistungsdatum: {dateStr}</Text>
            <Text style={styles.metaLine}>Kundennr.: {customerNumberShort(customer.id)}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.addressCol}>
            <Text style={styles.addressTitle}>Rechnungsadresse</Text>
            <Text style={styles.addressText}>{formatAddressLines(billing)}</Text>
          </View>
          {showShip ? (
            <View style={styles.addressCol}>
              <Text style={styles.addressTitle}>Lieferadresse</Text>
              <Text style={styles.addressText}>{formatAddressLines(shipping)}</Text>
            </View>
          ) : (
            <View style={styles.addressCol} />
          )}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.colPos}>Pos</Text>
          <Text style={styles.colDesc}>Beschreibung</Text>
          <Text style={styles.colQty}>Menge</Text>
          <Text style={styles.colUnit}>Einzel netto</Text>
          <Text style={styles.colLine}>Gesamt netto</Text>
        </View>
        {items.map((row, idx) => {
          const unit = row.quantity > 0 ? Math.round(row.line_total_cents / row.quantity) : row.line_total_cents;
          return (
            <View key={row.id} style={styles.tableRow}>
              <Text style={styles.colPos}>{idx + 1}</Text>
              <Text style={styles.colDesc}>{itemDescription(row.product_snapshot)}</Text>
              <Text style={styles.colQty}>{row.quantity}</Text>
              <Text style={styles.colUnit}>{formatEurCents(unit)}</Text>
              <Text style={styles.colLine}>{formatEurCents(row.line_total_cents)}</Text>
            </View>
          );
        })}

        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <Text>Zwischensumme netto</Text>
            <Text>{formatEurCents(order.subtotal_cents)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text>Versandkosten netto</Text>
            <Text>{formatEurCents(order.shipping_cents)}</Text>
          </View>
          <View style={styles.totalLine}>
            <Text>MwSt. {vatLabel}%</Text>
            <Text>{formatEurCents(order.vat_cents)}</Text>
          </View>
          <View style={styles.totalBold}>
            <Text>Gesamtbetrag brutto</Text>
            <Text>{formatEurCents(order.total_cents)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {order.status === "paid" ? (
            <Text style={styles.stripeNote}>Zahlung bereits per Stripe erhalten. Vielen Dank!</Text>
          ) : null}
          <Text>
            {company.bankName} · IBAN {company.iban} · BIC {company.bic}
          </Text>
          <Text>
            USt-ID: {company.ustId} · GF: {company.managingDirector}
          </Text>
          <Text style={{ marginTop: 4 }}>
            Eigentumsvorbehalt: Die Ware bleibt bis zur vollständigen Bezahlung Eigentum von {company.companyName}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderOrderInvoicePdfBuffer(data: OrderDocumentData): Promise<Buffer> {
  return renderToBuffer(<OrderInvoicePdf data={data} />);
}
