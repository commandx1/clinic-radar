import { Skeleton } from "@/components/ui/skeleton";

export default function TrendLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}
