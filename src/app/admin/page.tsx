import Link from "next/link";
import { startOfDay, startOfMonth } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { singleEmbedded } from "@/lib/supabase/relation";
import { StatCard } from "@/components/admin/stat-card";
import { formatEurCents } from "@/lib/pdf/format-eur";
import { formatOrderDateTime } from "@/lib/admin/format-order-datetime";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const dayStart = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const [{ count: ordersToday }, { data: monthPaidRows }, { count: openOrders }, { count: toShip }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString()),
      supabase
        .from("orders")
        .select("total_cents")
        .gte("paid_at", monthStart.toISOString())
        .not("paid_at", "is", null),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "in_production"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_production"),
    ]);

  const monthRevenueCents = (monthPaidRows ?? []).reduce((acc, row) => acc + Number(row.total_cents ?? 0), 0);

  const { data: recent } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      status,
      total_cents,
      created_at,
      customer:customers(company_name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Überblick über Bestellungen und Umsatz.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bestellungen heute" value={String(ordersToday ?? 0)} />
        <StatCard label="Umsatz Monat" value={formatEurCents(monthRevenueCents)} />
        <StatCard label="Offene Bestellungen" value={String(openOrders ?? 0)} />
        <StatCard label="Heute zu versenden" value={String(toShip ?? 0)} />
      </div>

      <Card className="mt-10">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Letzte Bestellungen</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/bestellungen">Alle anzeigen</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bestell-Nr</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gesamt brutto</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Noch keine Bestellungen.
                  </TableCell>
                </TableRow>
              ) : (
                (recent ?? []).map((row) => {
                  const cust = singleEmbedded(
                    row.customer as { company_name: string | null } | { company_name: string | null }[] | null,
                  );
                  const companyName = cust?.company_name;
                  return (
                    <TableRow key={row.id as string}>
                      <TableCell className="font-mono text-sm italic">
                        {(row.order_number as string | null) ?? (row.id as string).slice(0, 8)}
                      </TableCell>
                      <TableCell>{companyName ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status as string} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatEurCents(Number(row.total_cents))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatOrderDateTime(row.created_at as string)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
