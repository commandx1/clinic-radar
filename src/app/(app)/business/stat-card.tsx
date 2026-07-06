import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardTone = "primary" | "cta" | "gold" | "destructive" | "muted";

const TONE_CLASSES: Record<StatCardTone, string> = {
  primary: "bg-primary/10 text-primary",
  cta: "bg-cta/10 text-cta",
  gold: "bg-gold/15 text-gold",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatCardTone;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-4.5" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
