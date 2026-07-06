import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-full max-w-lg" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-row items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
