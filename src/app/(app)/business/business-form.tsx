"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useBusinessForm } from "./use-business-form";

export function BusinessForm() {
  const t = useTranslations("business.form");
  const {
    name,
    setName,
    googlePlaceId,
    setGooglePlaceId,
    category,
    setCategory,
    errorMessage,
    isPending,
    handleSubmit,
  } = useBusinessForm();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-name">{t("name")}</Label>
        <Input
          id="business-name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-place-id">{t("googlePlaceId")}</Label>
        <Input
          id="business-place-id"
          required
          value={googlePlaceId}
          onChange={(e) => {
            setGooglePlaceId(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-category">{t("category")}</Label>
        <Input
          id="business-category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
          }}
        />
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
