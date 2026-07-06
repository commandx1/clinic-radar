import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ThemesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-32" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
