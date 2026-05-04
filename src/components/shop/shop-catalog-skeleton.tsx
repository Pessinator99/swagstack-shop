import { Skeleton } from "@/components/ui/skeleton";

export function ShopCatalogSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-40 rounded-md bg-muted" />
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md bg-muted" />
            <Skeleton className="h-8 w-24 rounded-md bg-muted" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48 bg-muted" />
          <Skeleton className="h-4 w-full max-w-lg bg-muted" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius)] border bg-surface"
            >
              <Skeleton className="aspect-square w-full rounded-none bg-muted" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-[85%] bg-muted" />
                <Skeleton className="h-3 w-1/3 bg-muted" />
                <Skeleton className="h-4 w-2/3 bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
