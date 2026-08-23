import { z } from "zod";

// bkz. docs/06-prompts.md Aşama 1 — çıktı şeması. Sağlayıcıdan bağımsız
// (Claude/Gemini) — hem şema hem prompt metni burada tek yerde tutulur, her
// sağlayıcı sadece "modele nasıl sorulur" kısmını implemente eder.
export const themeItemSchema = z.object({
  theme: z.string(),
  sentiment: z.enum(["positive", "negative", "mixed"]),
  mention_count: z.number().int().min(0),
  summary: z.string(),
  // bkz. docs/10-roadmap.md Faz 2 "Treatments" — tema belirli bir tedavi/hizmet
  // türüyle ilişkiliyse (implant, ortodonti, botoks vb.) burada serbest metin
  // olarak belirtilir; kategoriden bağımsız, kapalı bir liste DEĞİL (ürün
  // herhangi bir sağlık/estetik kategorisine açık). Tema genel bir konuyla
  // ilgiliyse (ör. "bekleme süresi") null bırakılır.
  treatment: z.string().nullable(),
  // bkz. docs/02-business-rules.md Bölüm D — bu temaya dair yorumlardan EN AZ
  // BİRİ sağlık/güvenlik zararı, ciddi bir etik/yasal risk ya da dolandırıcılık
  // iddiası içeriyorsa 'critical'; sıradan bir memnuniyetsizlikse (bekleme
  // süresi, fiyat, resepsiyon nezaketi vb.) 'normal'. mention_count'tan bağımsız
  // — tek bir yorum bile 'critical' olabilir.
  severity: z.enum(["normal", "critical"]),
});

export const themeExtractionOutputSchema = z.object({
  themes: z.array(themeItemSchema),
});

export type ThemeItem = z.infer<typeof themeItemSchema>;
export type ThemeExtractionOutput = z.infer<typeof themeExtractionOutputSchema>;

export interface ReviewInput {
  rating: number | null;
  text: string;
  language: string | null;
  published_at: string | null;
}

// Sağlayıcıdan bağımsız Aşama 1 girdi sözleşmesi — hem claude/theme-extraction.ts
// hem gemini/theme-extraction.ts bunu birebir kullanır (extractThemes params),
// böylece iki sağlayıcı da otomatik olarak aynı alanları taşımak zorunda kalır.
export interface Stage1ExtractThemesParams {
  businessName: string;
  category: string | null;
  reviews: ReviewInput[];
  outputLanguage: string;
  windowDays: number;
  // bkz. docs/05-ai-pipeline.md "known-theme vocabulary", docs/02-business-rules.md
  // Bölüm C/D/E "tema etiketi kayması" (gerçek Mersin diş kliniği pilotu,
  // 2026-08 — aynı konu iki döngü arasında farklı etiketlendi ve dedup/outcome/
  // trend eşleştirmesi sessizce kırıldı). Bir önceki döngüde bu owner scope'unda
  // (own çağrısı için own'un kendi önceki etiketleri; her rakip çağrısı için
  // önceki AGREGAT rakip etiketleri — tek tek rakip değil, bkz.
  // execute-analysis.ts fetchPreviousThemeData) kullanılmış tema etiketleri, en
  // çok bahsedilenden başlayarak en fazla STAGE1_KNOWN_THEME_VOCABULARY_LIMIT
  // (constants.ts) adet. İlk analizde (önceki döngü yok) boş dizi — bu durumda
  // prompt'a hiçbir sözlük eklenmez (bkz. buildStage1UserPrompt).
  knownThemes: string[];
}

// ÖNEMLİ: "theme" alanının çıktı dilinde üretilmesi zorunlu tutuluyor çünkü
// aggregate-competitor-themes.ts, temaları normalizeTheme() (sadece
// trim+lowercase, fuzzy eşleştirme YOK) ile birleştiriyor. Model tema
// etiketini girdi yorumun diline göre üretirse (ör. "hygiene" vs "hijyen"),
// aynı tema iki ayrı anahtar olarak sayılır ve rakip mention_count'ları
// yanlışlıkla bölünür. Bu cümleyi sadeleştirmeden önce bunu bil.
export function buildStage1SystemPrompt(outputLanguage: string): string {
  return (
    "Sen bir müşteri deneyimi analistisin. Sana bir işletmenin yorumları " +
    "verilecek. Görevin, yorumlardaki tekrar eden temaları, bu temalara dair " +
    "duygu tonunu ve aciliyetini çıkarmak. Yorumlardan asla birebir alıntı " +
    "yapma, her zaman kendi cümlelerinle özetle. Her tema belirli bir " +
    "tedavi/hizmet türüyle (ör. implant, ortodonti, botoks, dolgu — " +
    "işletmenin kategorisine göre değişir, kapalı bir liste yok) ilgiliyse bunu " +
    "\"treatment\" alanında belirt; tema genel bir konuyla ilgiliyse (ör. bekleme " +
    "süresi, resepsiyon nezaketi, fiyat şeffaflığı) \"treatment\" alanını null " +
    "bırak — bir tedavi türü uydurma. Bir temaya değinen yorumlardan EN AZ BİRİ " +
    "sağlık/güvenlik zararı (ör. yanlış tedavi, hasta zarar görmüş), ciddi bir " +
    "etik/yasal risk ya da dolandırıcılık iddiası içeriyorsa \"severity\" alanını " +
    "\"critical\" yap — bu, kaç kişinin aynı şeyi söylediğinden bağımsızdır, tek " +
    "bir yorum bile yeterlidir. Sıradan bir memnuniyetsizlik (uzun bekleme, " +
    "yüksek fiyat, resepsiyon nezaketsizliği vb.) için \"normal\" kullan — " +
    "\"critical\"ı sadece gerçekten ciddi durumlar için kullan, aksi halde " +
    "gürültü yaratırsın. " +
    "Sana ayrıca önceki analiz döngüsünde bu işletme için kullanılmış tema " +
    "etiketlerinin bir listesi verilebilir (varsa). Bulduğun bir tema bu " +
    "listedeki etiketlerden biriyle AYNI konuyu anlatıyorsa, o etiketi " +
    "karakter karakter (birebir) AYNEN kullanmalısın — yeni bir isim uydurma; " +
    "yalnızca gerçekten yeni bir konu için yeni bir etiket oluştur. Bu liste " +
    "bir SÖZLÜKTÜR, bir KONTROL LİSTESİ DEĞİLDİR: listede olan ama bu " +
    "yorumlarda hiç geçmeyen bir etiket için zorla bir tema uydurma ya da var " +
    "olmayan mention'lar icat etme. " +
    `"theme" ve "summary" alanlarını, girdi yorumların dili ne olursa olsun ` +
    `(yorumlar çok dilli olabilir) her zaman "${outputLanguage}" dilinde yaz. ` +
    "Sadece belirtilen JSON şemasında yanıt ver."
  );
}

export function buildStage1UserPrompt(params: Stage1ExtractThemesParams): string {
  const reviewList = params.reviews.map((r) => ({
    rating: r.rating,
    text: r.text,
    language: r.language,
    published_at: r.published_at,
  }));

  const lines = [
    `İşletme: ${params.businessName}${params.category ? ` (${params.category})` : ""}`,
    `Yorumlar (son ${String(params.windowDays)} gün, ${String(params.reviews.length)} adet):`,
    JSON.stringify(reviewList),
  ];

  // bkz. yukarıdaki Stage1ExtractThemesParams.knownThemes notu — ilk analizde
  // (liste boş) bu bölüm hiç eklenmez, prompt'a gereksiz gürültü katılmaz.
  if (params.knownThemes.length > 0) {
    lines.push(
      "",
      "Önceki analiz döngüsünde kullanılan tema etiketleri (bu bir SÖZLÜKTÜR: " +
        "bulduğun bir tema bu etiketlerden biriyle aynı konuysa AYNEN tekrar " +
        "kullan; burada olmayan yeni bir tema bulman engellenmez; buradaki bir " +
        "etiket bu yorumlarda hiç geçmiyorsa onu zorla kullanma):",
      JSON.stringify(params.knownThemes),
    );
  }

  lines.push(
    "",
    "Her tekrar eden tema için:",
    '- theme: kısa tema adı (ör. "bekleme süresi", "fiyat şeffaflığı")',
    "- sentiment: positive | negative | mixed",
    "- mention_count: bu temaya değinen yorum sayısı",
    "- summary: kendi cümlelerinle 1 cümlelik özet (asla alıntı değil)",
    '- treatment: ilgili tedavi/hizmet türü (ör. "implant", "ortodonti") ya da null',
    "- severity: normal | critical (sağlık/güvenlik zararı, ciddi etik/yasal risk ya da dolandırıcılık iddiası içeren EN AZ BİR yorum varsa critical, aksi halde normal)",
  );

  return lines.join("\n");
}
