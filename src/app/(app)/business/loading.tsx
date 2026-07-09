import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-full max-w-sm" />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
