import type { OrderStatus } from "@/types/database";

const POST_PAYMENT: OrderStatus[] = ["paid", "in_production", "shipped", "delivered"];

export function isPostPaymentStatus(status: string): status is OrderStatus {
  return POST_PAYMENT.includes(status as OrderStatus);
}

export function canAdminSetOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "cancelled" || from === "delivered") return false;
  if (to === "cancelled") {
    return from === "paid" || from === "in_production";
  }
  if (from === "pending") return false;
  const next: Partial<Record<OrderStatus, OrderStatus>> = {
    paid: "in_production",
    in_production: "shipped",
    shipped: "delivered",
  };
  return next[from] === to;
}

export function adminSelectableOrderStatuses(from: OrderStatus): OrderStatus[] {
  const candidates: OrderStatus[] = ["paid", "in_production", "shipped", "delivered", "cancelled"];
  return candidates.filter((to) => canAdminSetOrderStatus(from, to) && to !== from);
}
