import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <Icon className="size-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
