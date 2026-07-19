"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Google Places API "Health and Wellness" place types (Table A).
// https://developers.google.com/maps/documentation/places/web-service/place-types
export const BUSINESS_CATEGORIES = [
  "chiropractor",
  "dental_clinic",
  "dentist",
  "doctor",
  "drugstore",
  "general_hospital",
  "hospital",
  "massage",
  "massage_spa",
  "medical_center",
  "medical_clinic",
  "medical_lab",
  "pharmacy",
  "physiotherapist",
  "sauna",
  "skin_care_clinic",
  "spa",
  "tanning_studio",
  "wellness_center",
  "yoga_studio",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

const NONE_VALUE = "__none__";

export function isKnownCategory(value: string): value is BusinessCategory {
  return (BUSINESS_CATEGORIES as readonly string[]).includes(value);
}

export function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("business.form");

  const items = useMemo(() => {
    const record: Record<string, string> = { [NONE_VALUE]: t("categoryNone") };
    for (const category of BUSINESS_CATEGORIES) {
      record[category] = t(`categoryOptions.${category}`);
    }
    return record;
  }, [t]);

  return (
    <Select
      items={items}
      value={isKnownCategory(value) ? (value) : null}
      onValueChange={(next) => {
        onChange(next ?? "");
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("categoryPlaceholder")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{t("categoryNone")}</SelectItem>
        {BUSINESS_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {t(`categoryOptions.${category}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
