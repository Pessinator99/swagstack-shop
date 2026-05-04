/** Supabase embedded FK selects may return T or T[] depending on relationship. */
export function singleEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
