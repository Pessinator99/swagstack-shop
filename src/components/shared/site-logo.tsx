import Link from "next/link";
import Image from "next/image";
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
      <span className="grid size-8 place-items-center overflow-hidden rounded-[10px] bg-brand-600 shadow-[var(--shadow-raised)]">
        <Image src="/icon.png" alt={`${brandConfig.name} Icon`} width={32} height={32} className="size-full object-cover" />
      </span>
      <span className="text-base">{brandConfig.name}</span>
    </Link>
  );
}
