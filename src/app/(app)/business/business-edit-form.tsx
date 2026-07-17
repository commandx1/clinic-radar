"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CategorySelect } from "./category-select";
import { PlaceSearchCombobox } from "./place-search-combobox";
import { useBusinessEditForm, type EditableBusiness } from "./use-business-edit-form";

export function BusinessEditForm({
  business,
  onCancel,
  onDone,
}: {
  business: EditableBusiness;
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const t = useTranslations("business.edit");
  const tForm = useTranslations("business.form");
  const {
    name,
    setName,
    selectedPlace,
    handlePlaceSelect,
    category,
    setCategory,
    errorMessage,
    isPending,
    handleSubmit,
  } = useBusinessEditForm(business, onDone);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-business-name">{tForm("name")}</Label>
        <Input
          id="edit-business-name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-business-place-search">{tForm("placeSearchLabel")}</Label>
        <PlaceSearchCombobox
          inputId="edit-business-place-search"
          selected={selectedPlace}
          onSelect={handlePlaceSelect}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-business-category">{tForm("category")}</Label>
        <CategorySelect id="edit-business-category" value={category} onChange={setCategory} />
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2Icon className="animate-spin" />}
          {isPending ? t("submitting") : t("submit")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
