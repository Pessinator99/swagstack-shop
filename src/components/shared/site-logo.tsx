import Link from "next/link";
import { cn } from "@/lib/utils";
import { brandConfig } from "@/lib/brand/config";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-[10px] bg-brand-600 text-sm font-bold text-white shadow-[var(--shadow-raised)]">
        S
      </span>
      <span className="text-base">{brandConfig.name}</span>
    </Link>
  );
}
