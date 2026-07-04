"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useSignupForm } from "./use-signup-form";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isPending,
    isSuccess,
    handleSubmit,
  } = useSignupForm();

  if (isSuccess) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("checkEmailTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("checkEmailBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">{t("email")}</Label>
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-password">{t("password")}</Label>
        <Input
          id="signup-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </div>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>

      <p className="text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium underline">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
