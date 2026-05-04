"use client";

import { useRouter } from "next/navigation";
import { formatEurCents } from "@/lib/pdf/format-eur";
import { formatOrderDateTime } from "@/lib/admin/format-order-datetime";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminOrderRowMenu } from "@/components/admin/admin-order-row-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type AdminOrderListRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  status: string;
  total_cents: number;
  company_name: string | null;
  contact_person: string | null;
};

type Props = {
  rows: AdminOrderListRow[];
};

export function AdminOrdersTable({ rows }: Props) {
  const router = useRouter();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bestell-Nr</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Kunde</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Gesamt brutto</TableHead>
            <TableHead className="w-12 text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => router.push(`/admin/bestellungen/${row.id}`)}
            >
              <TableCell className="font-mono text-sm italic text-foreground/90">
                {row.order_number ?? row.id.slice(0, 8)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatOrderDateTime(row.created_at)}</TableCell>
              <TableCell>
                <div className="font-medium">{row.company_name ?? "—"}</div>
                {row.contact_person ? (
                  <div className="text-xs text-muted-foreground">{row.contact_person}</div>
                ) : null}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{formatEurCents(row.total_cents)}</TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <AdminOrderRowMenu orderId={row.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
