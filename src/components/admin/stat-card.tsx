import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  change?: string;
  className?: string;
};

export function StatCard({ label, value, change, className }: Props) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {change ? <p className="mt-1 text-xs text-muted-foreground">{change}</p> : null}
      </CardContent>
    </Card>
  );
}
