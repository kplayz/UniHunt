import { fitLabel, type FitCategory } from "@/lib/candidate-fit";
import { Badge } from "@/components/ui/badge";

const FIT_CLASS: Record<FitCategory, string> = {
  dream: "bg-violet-100 text-violet-950 dark:bg-violet-900/40 dark:text-violet-100",
  reach: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100",
  target: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-100",
};

export function FitBadge({
  fit,
  reason,
}: {
  fit: FitCategory | null | undefined;
  reason?: string | null;
}) {
  if (!fit) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge className={FIT_CLASS[fit]} title={reason ?? undefined}>
      {fitLabel(fit)}
    </Badge>
  );
}
