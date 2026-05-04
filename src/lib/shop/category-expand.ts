import type { CategoryRow } from "./fetch-shop-catalog";

function childrenOf(
  cats: CategoryRow[],
  parentId: string | null,
): CategoryRow[] {
  return cats
    .filter((c) => c.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

function collectDescendants(
  cats: CategoryRow[],
  rootId: string,
  acc: Set<string>,
) {
  acc.add(rootId);
  for (const ch of childrenOf(cats, rootId)) {
    collectDescendants(cats, ch.id, acc);
  }
}

/** All category IDs matching selected slugs (including descendants). */
export function expandCategorySelection(
  categories: CategoryRow[],
  slugs: string[],
): Set<string> {
  const ids = new Set<string>();
  if (!slugs.length) return ids;
  const slugSet = new Set(slugs.map((s) => s.toLowerCase()));
  for (const c of categories) {
    if (slugSet.has(c.slug.toLowerCase())) {
      collectDescendants(categories, c.id, ids);
    }
  }
  return ids;
}

export function categoryNavItems(categories: CategoryRow[]): CategoryRow[] {
  return childrenOf(categories, null);
}
