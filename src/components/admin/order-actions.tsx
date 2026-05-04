"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminSelectableOrderStatuses } from "@/lib/admin/order-status-transitions";
import type { OrderStatus } from "@/types/database";
import { ORDER_STATUS_LABELS } from "@/components/admin/status-badge";

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
  showInvoiceDownload?: boolean;
};

export function OrderActions({ orderId, currentStatus, showInvoiceDownload = true }: Props) {
  const router = useRouter();
  const [resendOpen, setResendOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const targets = adminSelectableOrderStatuses(currentStatus);

  async function setStatus(next: OrderStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Status konnte nicht geändert werden.");
        return;
      }
      toast.success("Status aktualisiert.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resend-email`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; sent?: boolean };
      if (!res.ok) {
        toast.error(body.error ?? "E-Mail konnte nicht gesendet werden.");
        return;
      }
      toast.success("Bestätigung erneut gesendet.");
      setResendOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy || targets.length === 0}>
              Status ändern
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Neuer Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {targets.map((s) => (
              <DropdownMenuItem key={s} onClick={() => void setStatus(s)}>
                {ORDER_STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {showInvoiceDownload ? (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/orders/${orderId}/invoice.pdf`} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              Rechnung herunterladen
            </a>
          </Button>
        ) : null}

        <Button variant="outline" size="sm" onClick={() => setResendOpen(true)} disabled={busy}>
          <Mail className="size-4" />
          Bestätigung erneut senden
        </Button>
      </div>

      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Bestätigung erneut senden?</DialogTitle>
            <DialogDescription>
              Die Bestellbestätigung inkl. Rechnung wird erneut an die Kunden-E-Mail gesendet. Dies erzeugt einen
              weiteren Eintrag in den E-Mail-Logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResendOpen(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button type="button" variant="accent" onClick={() => void resend()} disabled={busy}>
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
