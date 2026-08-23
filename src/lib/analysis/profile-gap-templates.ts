import type { BilingualText } from "@/lib/ai-pipeline/gap-analysis-schema";

// bkz. docs/02-business-rules.md Bölüm D, docs/06-prompts.md (title doğal/somut
// bir eylem cümlesi olmalı — profil farkı görevleri AI'dan gelmediği için bu
// kural buradaki sabit şablonlarla elle uygulanıyor). Sayılar interpolate
// edilir, metin sabit kalır — çeviri anahtarı yerine burada tutuluyor çünkü bu
// metin `title_i18n`/`description_i18n` olarak doğrudan `tasks` tablosuna
// yazılıyor (messages/*.json değil — diğer görev kaynaklarıyla aynı desen).

export interface ReplyRateTaskContentParams {
  unrepliedCount: number;
  ownRatePct: number;
  competitorRatePct: number;
  windowDays: number;
}

export interface WebsiteTaskContentParams {
  competitorSharePct: number;
}

export interface ProfileGapTaskContent {
  title: BilingualText;
  description: BilingualText;
  checklist: BilingualText[];
}

export function buildReplyRateTaskContent(params: ReplyRateTaskContentParams): ProfileGapTaskContent {
  // eslint-plugin @typescript-eslint/restrict-template-expressions sadece
  // string/boolean interpolasyonuna izin verir — sayılar önce string'e çevrilir.
  const unrepliedCount = String(params.unrepliedCount);
  const ownRatePct = String(params.ownRatePct);
  const competitorRatePct = String(params.competitorRatePct);
  const windowDays = String(params.windowDays);

  return {
    title: {
      tr: `Yanıtlanmamış ${unrepliedCount} yoruma cevap ver`,
      en: `Reply to your ${unrepliedCount} unanswered reviews`,
    },
    description: {
      tr:
        `Son ${windowDays} günde rakiplerinin ortalama yorum yanıt oranı %${competitorRatePct}, ` +
        `seninki ise %${ownRatePct}. Şu anda ${unrepliedCount} yorumun hâlâ yanıtsız.`,
      en:
        `Over the last ${windowDays} days, your competitors reply to reviews at an average rate of ` +
        `${competitorRatePct}% — yours is ${ownRatePct}%. You currently have ${unrepliedCount} unanswered reviews.`,
    },
    checklist: [
      { tr: "Yorumlar sekmesini aç", en: "Open the Reviews tab" },
      { tr: "Yanıt Asistanı ile bir taslak oluştur", en: "Generate a draft with the Reply Assistant" },
      {
        tr: "Yanıtı Google'da paylaş ve 'Yanıtladım' olarak işaretle",
        en: "Post it on Google and mark it as replied",
      },
    ],
  };
}

export function buildWebsiteTaskContent(params: WebsiteTaskContentParams): ProfileGapTaskContent {
  const competitorSharePct = String(params.competitorSharePct);

  return {
    title: {
      tr: "Google İşletme Profiline web sitesi ekle",
      en: "Add a website to your Google Business Profile",
    },
    description: {
      tr:
        `Rakiplerinin %${competitorSharePct}'i Google İşletme Profili'nde bir web sitesi bağlantısı ` +
        "gösteriyor; seninkinde yok. Bu, hastaların doğrudan sana ulaşmasını zorlaştırıyor.",
      en:
        `${competitorSharePct}% of your competitors show a website link on their Google Business Profile — ` +
        "yours doesn't. This makes it harder for patients to reach you directly.",
    },
    checklist: [
      { tr: "Kullanılacak web sitesi/URL'yi belirle", en: "Decide which website URL to use" },
      {
        tr: "Google İşletme Profili düzenleme ekranından web sitesi alanını doldur",
        en: "Add it in the Google Business Profile edit screen",
      },
      { tr: "Google Haritalar'da profilde göründüğünü doğrula", en: "Verify it appears on the Maps listing" },
    ],
  };
}
