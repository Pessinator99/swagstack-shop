import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { singleEmbedded } from "@/lib/supabase/relation";
import { AdminOrdersTable, type AdminOrderListRow } from "@/components/admin/admin-orders-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "paid", label: "Bezahlt" },
  { value: "in_production", label: "In Produktion" },
  { value: "shipped", label: "Versendet" },
  { value: "delivered", label: "Geliefert" },
  { value: "cancelled", label: "Storniert" },
  { value: "pending", label: "Pending" },
] as const;

type SearchParams = { page?: string; status?: string; q?: string };

export default async function AdminBestellungenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const status = sp.status && sp.status !== "all" ? sp.status : null;
  const qRaw = (sp.q ?? "").trim();
  const qSafe = qRaw.replace(/[^a-zA-Z0-9@._+\- ]/g, "").slice(0, 80);

  const supabase = await createSupabaseServerClient();

  let customerIds: string[] = [];
  if (qSafe.length > 0) {
    const pat = `%${qSafe}%`;
    const { data: custHits } = await supabase
      .from("customers")
      .select("id")
      .or(`company_name.ilike.${pat},email.ilike.${pat},contact_person.ilike.${pat}`);
    customerIds = (custHits ?? []).map((c) => c.id as string).slice(0, 200);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let listQuery = supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      created_at,
      status,
      total_cents,
      customer:customers(company_name, contact_person, email)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) {
    listQuery = listQuery.eq("status", status);
  }

  if (qSafe.length > 0) {
    const pat = `%${qSafe}%`;
    if (customerIds.length > 0) {
      listQuery = listQuery.or(`order_number.ilike.${pat},customer_id.in.(${customerIds.join(",")})`);
    } else {
      listQuery = listQuery.ilike("order_number", pat);
    }
  }

  const { data, error, count } = await listQuery;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Bestellungen konnten nicht geladen werden.</p>
      </div>
    );
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rows: AdminOrderListRow[] = (data ?? []).map((o) => {
    const c = singleEmbedded(
      o.customer as
        | { company_name: string | null; contact_person: string | null; email: string | null }
        | { company_name: string | null; contact_person: string | null; email: string | null }[]
        | null,
    );
    return {
      id: o.id as string,
      order_number: (o.order_number as string | null) ?? null,
      created_at: o.created_at as string,
      status: o.status as string,
      total_cents: Number(o.total_cents),
      company_name: c?.company_name ?? null,
      contact_person: c?.contact_person ?? null,
    };
  });

  function hrefFor(p: number, st: string | null, q: string) {
    const u = new URLSearchParams();
    if (p > 1) u.set("page", String(p));
    if (st && st !== "all") u.set("status", st);
    if (q) u.set("q", q);
    const s = u.toString();
    return s ? `/admin/bestellungen?${s}` : "/admin/bestellungen";
  }

  const currentStatus = status ?? "all";

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bestellungen</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} Treffer</p>
        </div>
        <form action="/admin/bestellungen" method="get" className="flex w-full max-w-md gap-2">
          {currentStatus !== "all" ? <input type="hidden" name="status" value={currentStatus} /> : null}
          <Input name="q" placeholder="Suche Nr., Firma, E-Mail…" defaultValue={qRaw} className="flex-1" />
          <Button type="submit" variant="secondary">
            Suchen
          </Button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = currentStatus === f.value;
          return (
            <Button key={f.value} asChild variant={active ? "default" : "outline"} size="sm">
              <Link href={hrefFor(1, f.value === "all" ? null : f.value, qRaw)}>{f.label}</Link>
            </Button>
          );
        })}
      </div>

      <div className="mt-6">
        <AdminOrdersTable rows={rows} />
      </div>

      {pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Zurück
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefFor(page - 1, currentStatus === "all" ? null : currentStatus, qRaw)}>Zurück</Link>
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Seite {page} / {pageCount}
          </span>
          {page >= pageCount ? (
            <Button variant="outline" size="sm" disabled>
              Weiter
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefFor(page + 1, currentStatus === "all" ? null : currentStatus, qRaw)}>Weiter</Link>
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
