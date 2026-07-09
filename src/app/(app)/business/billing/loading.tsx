import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-28" />

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    </div>
  );
}
