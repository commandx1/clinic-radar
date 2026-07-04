import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RatingFilter = "all" | "1" | "2" | "3" | "4" | "5";
export type RepliedFilter = "all" | "yes" | "no";
export type SortOrder = "newest" | "oldest";

export interface ReviewFilters {
  rating: RatingFilter;
  replied: RepliedFilter;
  sort: SortOrder;
}

function buildHref(filters: ReviewFilters, overrides: Partial<ReviewFilters>): string {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams({ rating: next.rating, replied: next.replied, sort: next.sort });
  return `/business/reviews?${params.toString()}`;
}

function FilterGroup({
  label,
  options,
  active,
  hrefFor,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            className={cn(buttonVariants({ variant: active === option.value ? "secondary" : "ghost", size: "sm" }))}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export async function ReviewsFilterBar({ filters }: { filters: ReviewFilters }) {
  const t = await getTranslations("business.reviews.filters");

  return (
    <div className="flex flex-wrap gap-4">
      <FilterGroup
        label={t("ratingLabel")}
        active={filters.rating}
        hrefFor={(value) => buildHref(filters, { rating: value as RatingFilter })}
        options={[
          { value: "all", label: t("all") },
          { value: "5", label: "5★" },
          { value: "4", label: "4★" },
          { value: "3", label: "3★" },
          { value: "2", label: "2★" },
          { value: "1", label: "1★" },
        ]}
      />
      <FilterGroup
        label={t("repliedLabel")}
        active={filters.replied}
        hrefFor={(value) => buildHref(filters, { replied: value as RepliedFilter })}
        options={[
          { value: "all", label: t("repliedAll") },
          { value: "yes", label: t("repliedYes") },
          { value: "no", label: t("repliedNo") },
        ]}
      />
      <FilterGroup
        label={t("sortLabel")}
        active={filters.sort}
        hrefFor={(value) => buildHref(filters, { sort: value as SortOrder })}
        options={[
          { value: "newest", label: t("sortNewest") },
          { value: "oldest", label: t("sortOldest") },
        ]}
      />
    </div>
  );
}
