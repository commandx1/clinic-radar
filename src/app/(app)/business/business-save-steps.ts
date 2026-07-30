// Oluşturma (use-business-form.ts) ve düzenleme (use-business-edit-form.ts)
// akışlarının ikisi de aynı iki adımı paylaşır: kaydet → zenginleştir (bkz.
// src/app/api/business/[id]/enrich/route.ts). Ortak tip ve fetch mantığı
// burada tutulur — sonarjs/no-identical-functions'ı iki hook'ta aynı kodu
// tekrar yazarak ihlal etmemek için (CLAUDE.md "Kod tekrarı yok").
export type BusinessSaveStepKey = "saving" | "enriching";
export const BUSINESS_SAVE_STEP_KEYS: readonly BusinessSaveStepKey[] = ["saving", "enriching"];

// Apify zenginleştirmesi 100 saniyeye kadar sürebilir ve başarısız olması
// ölümcül değildir (bkz. enrich-from-apify.ts, hatayı kendi içinde yutar,
// business satırını olduğu gibi bırakır) — bu yüzden bu istek best-effort'tur:
// hata verse de çağıranın mutation'ı BAŞARISIZ SAYMASINA neden olmaz, sadece
// loglanır.
export async function triggerBusinessEnrichment(businessId: string): Promise<void> {
  try {
    const res = await fetch(`/api/business/${businessId}/enrich`, { method: "POST" });
    if (!res.ok) {
      console.error("Business enrichment request failed with status:", res.status);
    }
  } catch (enrichError) {
    console.error("Business enrichment request failed:", enrichError);
  }
}
