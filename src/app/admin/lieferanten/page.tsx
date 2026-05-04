import { Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLieferantenStubPage() {
  return (
    <div className="p-6 lg:p-8">
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
            <Truck className="size-7 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Lieferanten</CardTitle>
          <CardDescription>
            Anbindung Stricker, PF Concept, Makito und Sync-Jobs. Geplant für Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">Bald verfügbar.</CardContent>
      </Card>
    </div>
  );
}
