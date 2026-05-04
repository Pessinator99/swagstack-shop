import { format } from "date-fns";
import { de } from "date-fns/locale";

export function formatOrderDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd.MM.yy HH:mm", { locale: de });
  } catch {
    return "—";
  }
}
