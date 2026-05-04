"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { MapPinned, Package, Truck, LayoutDashboard, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

const links: {
  href: string;
  label: string;
  icon: LucideIcon;
  stub?: boolean;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bestellungen", label: "Bestellungen", icon: ShoppingCart },
  { href: "/admin/produkte", label: "Produkte", icon: Package, stub: true },
  { href: "/admin/lieferanten", label: "Lieferanten", icon: Truck, stub: true },
  { href: "/admin/mapper", label: "Print-Mapper", icon: MapPinned },
];

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-4">
        <Link href="/admin" className="text-lg font-semibold tracking-tight">
          Admin
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {links.map(({ href, label, icon: Icon, stub }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {stub ? (
                <span className="text-[10px] font-normal text-muted-foreground">Bald</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <AdminLogoutButton />
      </div>
    </aside>
  );
}
