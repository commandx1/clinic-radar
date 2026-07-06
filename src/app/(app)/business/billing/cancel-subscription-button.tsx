"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useCancelSubscription } from "./use-cancel-subscription";

export function CancelSubscriptionButton() {
  const t = useTranslations("business.billing.cancel");
  const { isDialogOpen, setIsDialogOpen, isPending, errorMessage, confirm } = useCancelSubscription();

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-fit text-destructive" />}>
        {t("trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsDialogOpen(false);
            }}
            disabled={isPending}
          >
            {t("dialog.dismiss")}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending && <Loader2Icon className="size-4 animate-spin" />}
            {t("dialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
