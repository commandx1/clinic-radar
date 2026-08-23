// Tek doğruluk kaynağı: "Pro erişimi var mı?" sorusunun cevabı. Bkz.
// docs/02-business-rules.md Bölüm A "Pro erişimi".
//
// `subscriptions.plan` tek başına yeterli değildir — LemonSqueezy webhook'u
// (handle-webhook-event.ts mapPlan) plan'ı yalnızca variant_id'den türetir,
// abonelik iptal/dunning durumuna girdiğinde `plan` 'pro' olarak kalabilir.
// Erişim kararı her zaman plan + status + current_period_end üçlüsüyle
// verilmeli; aksi halde iptal edilmiş/süresi dolmuş bir Pro abonelik Pro
// özelliklerini (haftalık cooldown, Trustpilot, sınırsız yanıt taslağı)
// göstermeye devam eder.
export type PlanAccess = "free" | "pro";

export interface SubscriptionAccessRow {
  plan: string;
  status: string;
  current_period_end: string | null;
}

export function hasProAccess(
  sub: SubscriptionAccessRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) {
    return false;
  }

  if (sub.plan !== "pro" && sub.plan !== "agency") {
    return false;
  }

  switch (sub.status) {
    case "active":
      return true;
    // Dunning grace: ödeme başarısız olduğunda LemonSqueezy erişimi hemen
    // kesmez, birkaç kez yeniden dener — bu pencerede Pro erişimi sürer.
    case "past_due":
      return true;
    // LemonSqueezy'de iptal = dönem sonuna kadar erişim (satın alınan süre
    // kullanılmadan kesilmez). current_period_end geçmişse erişim biter.
    case "canceled":
      return sub.current_period_end !== null && new Date(sub.current_period_end).getTime() > now.getTime();
    default:
      return false;
  }
}

export function resolvePlanAccess(
  sub: SubscriptionAccessRow | null | undefined,
  now: Date = new Date(),
): PlanAccess {
  return hasProAccess(sub, now) ? "pro" : "free";
}
