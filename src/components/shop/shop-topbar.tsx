"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, Search, ShoppingCart, Sparkles } from "lucide-react";
import { SiteLogo } from "@/components/shared/site-logo";
import { AccountDropdown } from "@/components/shop/account-dropdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { CategoryRow } from "@/lib/shop/fetch-shop-catalog";
import { categoryNavItems } from "@/lib/shop/category-expand";
import { cn } from "@/lib/utils";

type Props = {
  categories: CategoryRow[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  activeCategorySlugs: string[];
  onNavCategory: (slug: string | null) => void;
  email: string | null;
  cartCount: number;
};

function AnimatedCartBadge({ count, className }: { count: number; className: string }) {
  const isFirst = useRef(true);
  const prevCount = useRef(count);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      prevCount.current = count;
      return;
    }
    if (prevCount.current !== count) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 300);
      prevCount.current = count;
      return () => window.clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <motion.span
      className={className}
      animate={pulse ? { scale: [1, 1.3, 1] } : { scale: 1 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 450, damping: 18 }}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

export function ShopTopbar({
  categories,
  searchQuery,
  onSearchQueryChange,
  activeCategorySlugs,
  onNavCategory,
  email,
  cartCount,
}: Props) {
  const navCats = categoryNavItems(categories);
  const [draft, setDraft] = useState(searchQuery);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // Sync local draft when URL/searchQuery changes (e.g. browser back).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled reset from URL
    setDraft(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (draft !== searchQuery) onSearchQueryChange(draft);
    }, 400);
    return () => window.clearTimeout(t);
  }, [draft, searchQuery, onSearchQueryChange]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchQueryChange(draft.trim());
  };

  const renderCategoryButton = (name: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 snap-start rounded-full px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {name}
    </button>
  );

  return (
    <header className="border-b bg-surface">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="grid gap-3">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(260px,380px)_minmax(0,1fr)_auto] lg:gap-4">
            <div className="flex items-center gap-2">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label="Kategorien öffnen"
                  >
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Kategorien</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-2" aria-label="Kategorien mobil">
                    {renderCategoryButton("Alle", activeCategorySlugs.length === 0, () => {
                      onNavCategory(null);
                      setMobileNavOpen(false);
                    })}
                    {navCats.map((c) => {
                      const active =
                        activeCategorySlugs.length === 1 &&
                        activeCategorySlugs[0].toLowerCase() === c.slug.toLowerCase();
                      return (
                        <div key={c.id}>
                          {renderCategoryButton(c.name, active, () => {
                            onNavCategory(c.slug);
                            setMobileNavOpen(false);
                          })}
                        </div>
                      );
                    })}
                  </nav>
                  <div className="mt-6 flex flex-col gap-2 border-t pt-4">
                    <Button variant="secondary" className="w-full" asChild>
                      <Link href="/colormatch" onClick={() => setMobileNavOpen(false)}>
                        🎨 Logo-Vorschau
                      </Link>
                    </Button>
                    <Button variant="secondary" className="w-full" asChild>
                      <Link href="/moodboard" onClick={() => setMobileNavOpen(false)}>
                        <Sparkles className="size-4" aria-hidden />
                        Marketing-Bild
                      </Link>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <SiteLogo />
            </div>

            <form onSubmit={onSubmit} className="w-full lg:max-w-none">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Suchen…"
                  className="h-10 w-full rounded-full border bg-background pl-10 pr-4"
                  aria-label="Suche"
                />
              </div>
            </form>

            <nav
              className="scrollbar-hide hidden min-w-0 gap-1 overflow-x-auto pb-1 snap-x snap-mandatory lg:flex"
              aria-label="Kategorien"
            >
              {renderCategoryButton("Alle", activeCategorySlugs.length === 0, () =>
                onNavCategory(null),
              )}
              {navCats.map((c) => {
                const active =
                  activeCategorySlugs.length === 1 &&
                  activeCategorySlugs[0].toLowerCase() === c.slug.toLowerCase();
                return (
                  <div key={c.id}>
                    {renderCategoryButton(c.name, active, () => onNavCategory(c.slug))}
                  </div>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon-sm" className="md:hidden shrink-0" asChild>
                <Link href="/colormatch" aria-label="Logo-Vorschau">
                  <span aria-hidden className="text-lg leading-none">
                    🎨
                  </span>
                </Link>
              </Button>
              <Button variant="secondary" size="icon-sm" className="md:hidden shrink-0" asChild>
                <Link href="/moodboard" aria-label="Marketing-Bild">
                  <Sparkles className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="hidden shrink-0 whitespace-nowrap md:inline-flex"
                asChild
              >
                <Link href="/colormatch">🎨 Logo-Vorschau</Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="hidden shrink-0 whitespace-nowrap md:inline-flex"
                asChild
              >
                <Link href="/moodboard" className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-4" aria-hidden />
                  Marketing-Bild
                </Link>
              </Button>
              <Button variant="outline" size="icon-sm" className="md:hidden" asChild>
                <Link href="/warenkorb" aria-label="Warenkorb" className="relative">
                  <ShoppingCart className="size-4" />
                  {cartCount > 0 ? (
                    <Badge
                      asChild
                      className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full p-0 text-[10px]"
                    >
                      <AnimatedCartBadge count={cartCount} className="flex size-full items-center justify-center" />
                    </Badge>
                  ) : null}
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
                <Link href="/warenkorb" className="relative gap-2">
                  <ShoppingCart className="size-4" />
                  Warenkorb
                  {cartCount > 0 ? (
                    <Badge asChild className="ml-1 rounded-full px-1.5 text-[10px] tabular-nums">
                      <AnimatedCartBadge count={cartCount} className="inline-flex items-center justify-center" />
                    </Badge>
                  ) : null}
                </Link>
              </Button>
              <AccountDropdown email={email} />
            </div>
          </div>

          <nav
            className="scrollbar-hide hidden gap-1 overflow-x-auto pb-1 snap-x snap-mandatory md:flex lg:hidden"
            aria-label="Kategorien"
          >
            {renderCategoryButton("Alle", activeCategorySlugs.length === 0, () =>
              onNavCategory(null),
            )}
            {navCats.map((c) => {
              const active =
                activeCategorySlugs.length === 1 &&
                activeCategorySlugs[0].toLowerCase() === c.slug.toLowerCase();
              return (
                <div key={c.id}>
                  {renderCategoryButton(c.name, active, () => onNavCategory(c.slug))}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
