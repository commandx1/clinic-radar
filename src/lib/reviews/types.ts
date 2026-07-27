// Kaynak-agnostik yorum tipleri — bkz. docs/02-business-rules.md Bölüm I
// "Yorum Kaynakları (Multi-Source)", docs/03-database.md.
//
// Bu dosya `reviews` tablosunun kaynak-bağımsız şeklini tanımlar. Yeni bir
// kaynak eklemek isteyen bir adaptör (src/lib/reviews/sources/<kaynak>.ts)
// SADECE `ScrapedSourceReview` üretmekle yükümlüdür; pipeline'ın geri kalanı
// (execute-analysis.ts, src/lib/ai-pipeline/**) bu tipten sonra kaynaktan
// bağımsız çalışır.

// Migration'daki reviews_source_check ile birebir aynı liste tutulmalı.
export type ReviewSource = "google" | "facebook" | "trustpilot";

export interface OwnerRef {
  owner_type: "own" | "competitor";
  business_id: string;
}

// `reviews` DB satırıyla birebir eşleşir (snake_case) — id/scraped_at/
// business_id/owner_type çağıran tarafından (source_ref -> owner eşlemesiyle)
// çözülür, adaptörler sadece kaynağın ham şeklini bu forma normalize eder.
export interface ScrapedSourceReview {
  review_id: string;
  source: ReviewSource;
  source_ref: string;
  author_name: string | null;
  rating: number | null;
  text: string | null;
  original_language: string | null;
  translated_text: null;
  owner_reply: string | null;
  images_count: number | null;
  likes: number | null;
  is_local_guide: boolean | null;
  review_url: string | null;
  published_at: string | null;
}
