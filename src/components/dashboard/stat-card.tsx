import { icons, type IconName } from "@/components/dashboard/shell/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** KPI tile (app-1 reference): label and icon on top, the number, a short hint. */
export function StatCard({ label, value, hint, icon }: { label: string; value: string | number; hint?: string; icon: IconName }) {
  const Icon = icons[icon];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon aria-hidden="true" className="size-[1.1rem] text-muted-foreground" strokeWidth={1.75} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
