import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { brandConfig, siteBaseUrl, type BrandConfig } from "@/lib/brand/config";
import type { OrderDocumentData } from "@/lib/order/order-document-data";
import { addressesDiffer, billingContactName, vatPercentLabel } from "@/lib/order/order-document-data";
import { formatEurCents } from "@/lib/pdf/format-eur";

const maxWidth = 600;

function formatAddressLines(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const company = String(raw.companyName ?? raw.company_name ?? "");
  const contact = String(raw.contactPerson ?? raw.contact_person ?? "");
  const street = String(raw.street ?? "");
  const zip = String(raw.zip ?? "");
  const city = String(raw.city ?? "");
  const country = String(raw.country ?? "");
  const phone = String(raw.phone ?? "");
  return [company, contact, street, `${zip} ${city}`.trim(), country, phone].filter((l) => l.length > 0);
}

function itemTitle(snap: OrderDocumentData["items"][0]["product_snapshot"]): string {
  if (!snap) return "Position";
  return snap.productName ?? "Produkt";
}

function itemSubtitle(snap: OrderDocumentData["items"][0]["product_snapshot"]): string {
  if (!snap) return "";
  const parts: string[] = [];
  if (snap.variant) parts.push(`Variante: ${snap.variant}`);
  const ver = [snap.printTechnique, snap.printArea].filter(Boolean).join(", ");
  if (ver) parts.push(`Veredelung: ${ver}`);
  return parts.join(" · ");
}

export type OrderConfirmationEmailProps = {
  data: OrderDocumentData;
  /** Server: `getServerCompanyProfile()`. Ohne Prop = öffentliche Defaults (z. B. `email dev`). */
  company?: BrandConfig;
};

export default function OrderConfirmationEmail({ data, company }: OrderConfirmationEmailProps) {
  const b = company ?? brandConfig;
  const { order, items, customer } = data;
  const base = siteBaseUrl();
  const orderNo = order.order_number ?? order.id.slice(0, 8).toUpperCase();
  const greeting = billingContactName(order.billing_address, customer.contact_person);
  const showShip = addressesDiffer(order.billing_address, order.shipping_address);
  const vatPct = vatPercentLabel(order.subtotal_cents, order.vat_cents);

  return (
    <Html lang="de">
      <Head />
      <Preview>Bestellbestätigung {orderNo} – Werbenest</Preview>
      <Body style={{ margin: 0, backgroundColor: "#faf6ee", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            maxWidth,
            margin: "0 auto",
            padding: "24px 16px 40px",
            backgroundColor: "#ffffff",
          }}
        >
          <Section style={{ paddingBottom: 12, borderBottom: `3px solid ${b.brandOlive}` }}>
            <Row>
              <Column style={{ width: 56, verticalAlign: "middle" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: b.brandOlive,
                    color: "#ffffff",
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: "48px",
                    textAlign: "center",
                  }}
                >
                  W
                </div>
              </Column>
              <Column style={{ verticalAlign: "middle", paddingLeft: 8 }}>
                <Text style={{ margin: 0, fontSize: 22, fontWeight: 700, color: b.brand900 }}>
                  {b.brandName}
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ paddingTop: 28 }}>
            <Heading as="h1" style={{ fontSize: 22, margin: "0 0 8px", color: b.brand900 }}>
              Bestellbestätigung #{orderNo}
            </Heading>
            <Text style={{ fontSize: 15, lineHeight: 1.5, color: "#333", margin: "0 0 8px" }}>Hallo {greeting},</Text>
            <Text style={{ fontSize: 15, lineHeight: 1.55, color: "#333", margin: 0 }}>
              vielen Dank für deine Bestellung bei Werbenest. Wir haben deine Zahlung erhalten und starten jetzt mit der Bearbeitung.
            </Text>
          </Section>

          <Section style={{ marginTop: 24 }}>
            <table cellPadding={0} cellSpacing={0} width="100%" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {items.map((row, idx) => {
                  const bg = idx % 2 === 1 ? b.brandOliveLight : "#ffffff";
                  const snap = row.product_snapshot;
                  const img = snap?.imageUrl;
                  const unit = row.quantity > 0 ? Math.round(row.line_total_cents / row.quantity) : row.line_total_cents;
                  return (
                    <tr key={row.id} style={{ backgroundColor: bg }}>
                      <td style={{ padding: 12, width: 72, verticalAlign: "top" }}>
                        {img ? (
                          <Img src={img} width={60} height={60} alt="" style={{ borderRadius: 6, objectFit: "cover" }} />
                        ) : (
                          <div
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 6,
                              backgroundColor: "#e8e8e0",
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                        <Text style={{ margin: 0, fontSize: 14, fontWeight: 600, color: b.brand900 }}>
                          {itemTitle(snap)}
                        </Text>
                        {itemSubtitle(snap) ? (
                          <Text style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>{itemSubtitle(snap)}</Text>
                        ) : null}
                        <Text style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>Menge: {row.quantity}</Text>
                      </td>
                      <td
                        style={{
                          padding: 12,
                          verticalAlign: "top",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          fontSize: 13,
                          color: "#444",
                        }}
                      >
                        {formatEurCents(unit)}
                        <br />
                        <Text style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600 }}>
                          {formatEurCents(row.line_total_cents)}
                        </Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <Section
            style={{
              marginTop: 20,
              padding: 16,
              border: "1px solid #e2e2dc",
              borderRadius: 8,
              backgroundColor: "#fafaf7",
            }}
          >
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: 14, color: "#444" }}>Zwischensumme netto</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={{ margin: 0, fontSize: 14 }}>{formatEurCents(order.subtotal_cents)}</Text>
              </Column>
            </Row>
            <Row style={{ marginTop: 8 }}>
              <Column>
                <Text style={{ margin: 0, fontSize: 14, color: "#444" }}>Versand</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={{ margin: 0, fontSize: 14 }}>
                  {order.shipping_cents > 0 ? formatEurCents(order.shipping_cents) : "Kostenlos"}
                </Text>
              </Column>
            </Row>
            <Row style={{ marginTop: 8 }}>
              <Column>
                <Text style={{ margin: 0, fontSize: 14, color: "#444" }}>MwSt. {vatPct}%</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={{ margin: 0, fontSize: 14 }}>{formatEurCents(order.vat_cents)}</Text>
              </Column>
            </Row>
            <Hr style={{ borderColor: "#ddd", margin: "12px 0" }} />
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: b.brand900 }}>
                  Gesamt brutto
                </Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: b.brand900 }}>
                  {formatEurCents(order.total_cents)}
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ marginTop: 24 }}>
            <Row>
              <Column style={{ width: "48%", verticalAlign: "top", paddingRight: 8 }}>
                <Text style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#444" }}>Rechnungsadresse</Text>
                <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "#333", whiteSpace: "pre-line" }}>
                  {formatAddressLines(order.billing_address).join("\n")}
                </Text>
              </Column>
              <Column style={{ width: "48%", verticalAlign: "top", paddingLeft: 8 }}>
                {showShip ? (
                  <>
                    <Text style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#444" }}>
                      Lieferadresse
                    </Text>
                    <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "#333", whiteSpace: "pre-line" }}>
                      {formatAddressLines(order.shipping_address).join("\n")}
                    </Text>
                  </>
                ) : null}
              </Column>
            </Row>
          </Section>

          <Section
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 8,
              backgroundColor: b.accent50,
            }}
          >
            <Text style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: b.brand900 }}>
              Was passiert als Nächstes?
            </Text>
            <Text style={{ margin: "0 0 6px", fontSize: 14, color: "#333" }}>✓ Wir bearbeiten deine Bestellung</Text>
            <Text style={{ margin: "0 0 6px", fontSize: 14, color: "#333" }}>
              ✓ Druckdaten-Upload-Link kommt in 1–2 Werktagen
            </Text>
            <Text style={{ margin: 0, fontSize: 14, color: "#333" }}>✓ Produktion + Versand: 7–12 Werktage</Text>
          </Section>

          <Hr style={{ borderColor: "#e5e5dc", margin: "28px 0 16px" }} />

          <Section>
            <Text style={{ fontSize: 12, color: "#555", lineHeight: 1.5, margin: "0 0 6px" }}>
              {b.companyName}
              <br />
              {b.street}, {b.zipCity}, {b.country}
            </Text>
            <Text style={{ fontSize: 12, margin: "0 0 8px" }}>
              Bei Fragen:{" "}
              <Link href={`mailto:${b.companyEmail}`} style={{ color: b.brandOlive }}>
                {b.companyEmail}
              </Link>
            </Text>
            <Text style={{ fontSize: 12, margin: "0 0 4px" }}>
              <Link href={`${base}/impressum`} style={{ color: b.brandOlive, marginRight: 12 }}>
                Impressum
              </Link>
              <Link href={`${base}/agb`} style={{ color: b.brandOlive }}>
                AGB
              </Link>
            </Text>
            <Text style={{ fontSize: 10, color: "#888", margin: "10px 0 0", lineHeight: 1.45 }}>
              USt-ID: {b.ustId} · Geschäftsführung: {b.managingDirector}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
