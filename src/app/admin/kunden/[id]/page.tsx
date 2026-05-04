import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function AdminKundeStubPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6 lg:p-8">
      <Card className="mx-auto max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
            <Users className="size-7 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Kunde</CardTitle>
          <CardDescription>ID: {id}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
          <p>Kundenakte und Bestellhistorie folgen in einer späteren Ausbaustufe.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/bestellungen">Zu den Bestellungen</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
