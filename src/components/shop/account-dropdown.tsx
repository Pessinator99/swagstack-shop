"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountDropdown({ email }: { email: string | null }) {
  const router = useRouter();

  if (!email) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/login?redirect=/shop">Anmelden</Link>
      </Button>
    );
  }

  const onLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message || "Logout fehlgeschlagen.");
      return;
    }
    toast.success("Erfolgreich ausgeloggt.");
    router.replace("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCircle2 className="size-4" />
          Konto
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">{email}</div>
        <DropdownMenuItem asChild>
          <Link href="/konto">Profil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
