import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TasksHistoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-row items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-3 w-20 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
