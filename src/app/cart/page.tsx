import { redirect } from "next/navigation";

/** Alias: engl. `/cart` → deutscher Warenkorb (Auth dort). */
export default function CartAliasPage() {
  redirect("/warenkorb");
}
