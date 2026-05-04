import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Ausstehend",
  paid: "Bezahlt",
  in_production: "In Produktion",
  shipped: "Versendet",
  delivered: "Geliefert",
  cancelled: "Storniert",
};

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-slate-100 text-slate-800",
  paid: "bg-blue-100 text-blue-800",
  in_production: "bg-amber-100 text-amber-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

type Props = {
  status: OrderStatus | string;
  size?: "sm" | "md";
  className?: string;
};

export function StatusBadge({ status, size = "sm", className }: Props) {
  const s = status as OrderStatus;
  const label = ORDER_STATUS_LABELS[s] ?? status;
  const style = STYLES[s] ?? "bg-slate-100 text-slate-800";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        style,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className,
      )}
    >
      {label}
    </span>
  );
}
