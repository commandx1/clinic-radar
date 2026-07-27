import { runActorSync } from "@/lib/apify/client";
import { TRUSTPILOT_FETCH_MAX_PAGES } from "@/lib/constants";
import type { ScrapedSourceReview } from "@/lib/reviews/types";

// Apify'a özgü alan adları burada izole edilir — actor'ün ham şeması
// değişirse sadece bu dosya güncellenir (bkz. docs/04-api.md,
// sian.agency/trustpilot-reviews-scraper).
const TRUSTPILOT_REVIEWS_ACTOR_ID = "sian.agency/trustpilot-reviews-scraper";

// KRİTİK FARK (Google'a göre): bu actor çağrı başına TEK bir companyDomain
// alır — compass/google-maps-reviews-scraper'daki gibi placeIds dizisini tek
// çağrıda kabul etmiyor. Bu yüzden fetchTrustpilotReviews domain başına ayrı
// bir runActorSync çağrısı yapar ve bunları SIRAYLA (Promise.all ile paralel
// DEĞİL) çalıştırır — Apify rate limit'i ve maliyet kontrolü için.
//
// `datePosted` (ör. "last_3_months") KASITLI OLARAK kullanılmıyor: actor bunu
// destekliyor olsa da, execute-analysis.ts içindeki determineAnalysisWindowDays
// yeterli yorum yoksa analiz penceresini DB'deki mevcut yorumlardan 180/365
// güne genişletiyor. Fetch sırasında 3 ayla kesersek bu genişletme Trustpilot
// tarafında kalıcı olarak boş kalır (DB'de zaten olmayan eski yorumlara asla
// ulaşılamaz).
//
// `locale` de KASITLI OLARAK kullanılmıyor: actor'ün locale enum'unda "tr-TR"
// yok ve belirtilmezse tüm diller dönüyor — kliniklerin yorumları çok dilli
// olduğu için bu daha doğru bir varsayılan.

interface ApifyTrustpilotReviewItem {
  review_id: string;
  consumer_name: string | null;
  review_rating: number | null;
  review_text: string | null;
  review_title: string | null;
  review_language: string | null;
  replyText: string | null;
  review_likes: number | null;
  review_time: string | null;
}

// Boş/whitespace metni yokluk sayar. `??` yetmez: actor boş metni "" olarak
// döndürebiliyor ve "" başlığa düşmeyi engellerdi. Ayrıca "" DB'ye yazılırsa
// execute-analysis.ts:183'teki `.not("text","is",null)` sorgusu onu "metinli
// yorum" sayar ve analiz penceresinin genişlemesini haksız yere engeller.
function firstNonEmpty(...values: (string | null)[]): string | null {
  for (const value of values) {
    if (value && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

function toScrapedReview(item: ApifyTrustpilotReviewItem, domain: string): ScrapedSourceReview {
  return {
    review_id: item.review_id,
    source: "trustpilot",
    // Actor item'ı domain'i güvenilir taşımıyor — çağrıdaki domain
    // değişkeninden enjekte edilir.
    source_ref: domain,
    author_name: item.consumer_name,
    rating: item.review_rating,
    // Trustpilot'ta metin boş/null ise başlığa düşülür — çoğu zaman tek
    // sinyal başlıktır (Google'daki gibi ayrı bir başlık alanı yok).
    text: firstNonEmpty(item.review_text, item.review_title),
    original_language: item.review_language,
    translated_text: null,
    owner_reply: item.replyText,
    images_count: null,
    likes: item.review_likes,
    // Trustpilot'ta "local guide" karşılığı yok.
    is_local_guide: null,
    review_url: `https://www.trustpilot.com/reviews/${item.review_id}`,
    published_at: item.review_time,
  };
}

// `maxPages` çağıran tarafından daraltılabilir: actor pay-per-result
// fiyatlandırmalı olduğu için, sadece "bu domain'in profili var mı" sorusunu
// soran probe (bkz. src/lib/reviews/sources/trustpilot-domain.ts) tam sayfa
// çekip sonucu atmak yerine tek sayfayla yetinir. maxReviewsPerSourceRef
// sonuçları çekildikten SONRA kestiği için maliyeti düşürmez.
export async function fetchTrustpilotReviews(
  domains: string[],
  maxReviewsPerSourceRef: number,
  { timeoutMs, maxPages }: { timeoutMs?: number; maxPages?: number } = {},
): Promise<ScrapedSourceReview[]> {
  const results: ScrapedSourceReview[] = [];

  for (const domain of domains) {
    const items = await runActorSync<ApifyTrustpilotReviewItem>(
      TRUSTPILOT_REVIEWS_ACTOR_ID,
      {
        operation: "companyReviews",
        companyDomain: domain,
        maxPages: maxPages ?? TRUSTPILOT_FETCH_MAX_PAGES,
        reviewSort: "recency",
      },
      { timeoutMs },
    );

    const scraped = items
      .filter((item) => Boolean(item.review_id))
      .map((item) => toScrapedReview(item, domain))
      .slice(0, maxReviewsPerSourceRef);

    results.push(...scraped);
  }

  return results;
}
