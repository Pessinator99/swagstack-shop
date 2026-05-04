import { redirect } from "next/navigation";

/** Root `/` — Shop-Katalog ist die Startseite. */
export default function RootPage() {
  redirect("/shop");
}
