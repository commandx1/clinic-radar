import { z } from "zod";

import type { ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";

// bkz. docs/06-prompts.md Aşama 2 — çıktı şeması. Sağlayıcıdan bağımsız.

export interface CompetitorThemeInput {
  id: string;
  name: string;
  themes: ThemeItem[];
}

export const bilingualTextSchema = z.object({ tr: z.string(), en: z.string() });

export type BilingualText = z.infer<typeof bilingualTextSchema>;

// NOT: impact_score burada YOK — bkz. docs/10-roadmap.md "Impact score'un kod
// tarafında bileşenlerden hesaplanması". Model artık impact_score üretmiyor;
// skor Aşama 2 sonrası kod tarafında (`@/lib/task-engine/impact-score.ts`)
// rakip yaygınlığı + trend + own eksikliği kırılımından hesaplanır.
export interface TaskCandidate {
  title: BilingualText;
  description: BilingualText;
  source_type: "competitive_gap" | "absolute_quality";
  based_on_competitor_id: string | null;
  theme: string;
  effort_score: number;
  // bkz. docs/10-roadmap.md — "Checklist alt adımlar"; 3-5 somut, uygulanabilir
  // adım. UI'da tiklenebilir checklist olarak gösterilir.
  checklist: BilingualText[];
}

export interface GapAnalysisOutput {
  tasks: TaskCandidate[];
}

// docs/06-prompts.md'nin örneği serbest metin "based_on_competitor" (isim)
// döndürüyordu ama DB kolonu tekil bir uuid — bu yüzden şema, o cycle'da
// gerçekten başarılı olan rakip ID'lerinden dinamik bir enum'a kısıtlanıyor.
// Model var olmayan bir ID uyduramaz, fuzzy isim eşleştirmesi gerekmez.
export function buildTaskCandidateSchema(competitorIds: string[]) {
  const basedOnCompetitorId =
    competitorIds.length > 0 ? z.enum(competitorIds as [string, ...string[]]).nullable() : z.null();

  return z.object({
    tasks: z.array(
      z.object({
        title: bilingualTextSchema,
        description: bilingualTextSchema,
        source_type: z.enum(["competitive_gap", "absolute_quality"]),
        based_on_competitor_id: basedOnCompetitorId,
        theme: z.string(),
        effort_score: z.number().int().min(1).max(5),
        checklist: z.array(bilingualTextSchema).min(3).max(5),
      }),
    ),
  });
}

export function buildStage2SystemPrompt(hasCompetitors: boolean): string {
  const base =
    "Sen bir işletme danışmanısın. Sana bir kliniğin ve seçilmiş rakiplerinin " +
    "tema analizleri verilecek. İki tür fırsatı ayrı ayrı değerlendir: (1) " +
    "rakiplerin güçlü olduğu ama kliniğin zayıf/eksik olduğu alanlar, (2) " +
    "kliniğin kendi yorumlarında ciddi ve tekrar eden bir sorun — rakipler de " +
    "aynı sorunu yaşasa bile bunu atlama. Bulduğun TÜM anlamlı fırsatları aday " +
    "olarak döndür — önem ya da emin olma derecesine göre kendi içinde eleme " +
    "YAPMA; eşik filtreleme, önceliklendirme ve döngü başına görev limiti " +
    "uygulama kodunda ayrıca uygulanıyor, senin görevin kapsam (coverage). Her " +
    "anlamlı tema için en fazla bir aday üret; veride gerçekten az fırsat varsa " +
    "az aday da kabul, ama 2-3 adayla yetinmek için kendini kısıtlama. Her görev " +
    "için uygulama zorluğunu " +
    "(effort_score, 1-5) ve kaynağını (source_type) belirt — etki puanını " +
    "(impact_score) SEN üretmiyorsun, bu kod tarafında ayrıca hesaplanıyor. " +
    'title" ve "description" alanlarını hem "tr" hem "en" anahtarıyla, ' +
    "iki dilde de yaz (ör. {\"tr\": \"...\", \"en\": \"...\"}). \"title\" doğal, " +
    "somut bir eylem cümlesi olmalı — işletme sahibi okuduğu anda ne yapması " +
    "gerektiğini anlamalı (iyi örnek: \"Hastalara tedavi sürecini daha ayrıntılı " +
    "anlat\"; kötü örnek, kaçın: \"Şeffaf Bilgilendirme Süreçleri Oluştur\" gibi " +
    "soyut başlık kalıpları). Önerilerin sağlık sektörü reklam/pazarlama " +
    "mevzuatına aykırı olmamasına dikkat et: before/after hasta fotoğrafı, " +
    "teşvikli/ücretli yorum toplama ya da hasta referanslarının pazarlama " +
    "materyali olarak kullanılması önerme — sadece operasyonel/iletişimsel " +
    "iyileştirmeler öner. Her görev için ayrıca 3-5 somut, uygulanabilir alt " +
    'adımdan oluşan "checklist" üret (her adım {"tr": "...", "en": "..."} ' +
    "şeklinde, hem tr hem en). Alt adımlar sıralı, kısa ve doğrudan " +
    "yapılabilir eylemler olmalı (ör. \"Resepsiyon ekibine X konusunda kısa " +
    'bir bilgilendirme yap"), soyut tavsiye olmamalı. Sadece belirtilen JSON ' +
    "şemasında yanıt ver.";

  if (!hasCompetitors) {
    return `${base} Bu döngüde hiçbir rakip verisi yok — sadece "absolute_quality" fırsatlarını değerlendir, "competitive_gap" üretme.`;
  }

  return base;
}

export function buildStage2UserPrompt(params: {
  ownThemes: ThemeItem[];
  competitors: CompetitorThemeInput[];
}): string {
  return [
    "Klinik temaları:",
    JSON.stringify(params.ownThemes),
    "",
    "Rakip temaları (id, name, themes):",
    JSON.stringify(params.competitors),
    "",
    "Her fırsat için:",
    "- title: eylem odaklı, kısa başlık — hem tr hem en olarak {tr, en} şeklinde",
    "- description: neden önemli, ne yapılmalı (2-3 cümle, kendi cümlelerinle) — hem tr hem en olarak {tr, en} şeklinde",
    '- source_type: "competitive_gap" (rakip farkı) veya "absolute_quality" (mutlak sorun, rakip farkı olmasa da)',
    "- based_on_competitor_id: competitive_gap ise yukarıdaki rakip listesindeki id'lerden biri; absolute_quality ise null",
    "- theme: ilişkili tema adı",
    "- effort_score: 1-5 (1=kolay/hızlı, 5=zor/uzun soluklu)",
    "- checklist: 3-5 somut, uygulanabilir alt adımdan oluşan bir dizi — her biri hem tr hem en olarak {tr, en} şeklinde, sıralı ve doğrudan yapılabilir eylem cümleleri",
  ].join("\n");
}
