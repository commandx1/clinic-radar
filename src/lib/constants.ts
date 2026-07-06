// Plan limitleri — bkz. docs/02-business-rules.md Bölüm A
export const FREE_PLAN_MAX_BUSINESSES = 1;
export const FREE_PLAN_MAX_COMPETITORS = 3;
export const PRO_PLAN_MAX_BUSINESSES = 1;
export const PRO_PLAN_MAX_COMPETITORS = 10;

export const MIN_COMPETITORS = 3;
export const MAX_COMPETITORS = 10;

// Rakip keşif algoritması — bkz. docs/02-business-rules.md Bölüm B
export const DISCOVERY_RADIUS_KM_STEPS = [4, 6, 10] as const;
export const DISCOVERY_MIN_REVIEWS_STEPS = [100, 75, 50] as const;
export const DISCOVERY_TARGET_CANDIDATE_COUNT = 10;
// Apify'dan alınacak fazla aday — eşik filtreleme + kendi işletmeyi çıkarma payı
export const DISCOVERY_FETCH_BUFFER = 20;

// Analiz döngüsü sıklığı — bkz. docs/02-business-rules.md Bölüm A
export const FREE_PLAN_ANALYSIS_COOLDOWN_DAYS = 30;
export const PRO_PLAN_ANALYSIS_COOLDOWN_DAYS = 7;

// Cache TTL — bkz. docs/02-business-rules.md Bölüm C
export const CACHE_TTL_DENSE_DAYS = 7;
export const CACHE_TTL_SPARSE_DAYS = 14;
export const CACHE_DENSE_ACTIVE_USER_THRESHOLD = 5;

// Yorum çekme üst sınırı (place başına) — bkz. docs/02-business-rules.md Bölüm C
export const REVIEWS_FETCH_MAX_PER_PLACE = 200;

export const GEOHASH_PRECISION = 6;

// AI pipeline — Aşama 1 analiz penceresi — bkz. docs/05-ai-pipeline.md, docs/02-business-rules.md Bölüm C
export const AI_ANALYSIS_WINDOW_DAYS = 90;
// Düşük yorum hızlı işletmelerde (bkz. docs/11-risks-assumptions.md Risk 1) sabit
// 90 günlük pencere, işletmenin DB'de zaten sahip olduğu eski yorumları göz ardı
// edip her temayı gürültü eşiğinin (TASK_MENTION_THRESHOLD) altında bırakabilir.
// Own tarafında metinli yorum sayısı yetersizse pencere bu adımlarla (own+rakip
// için aynı anda, adil kıyas bozulmadan) kademeli genişletilir — DISCOVERY_RADIUS_KM_STEPS
// ile aynı desen.
export const AI_ANALYSIS_WINDOW_DAYS_STEPS = [90, 180, 365] as const;
export const AI_ANALYSIS_MIN_OWN_REVIEWS_FOR_WINDOW = 5;

// Görev oluşturma eşikleri — bkz. docs/02-business-rules.md Bölüm D
export const TASK_MENTION_THRESHOLD = 3;
export const ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD = 0.3;
export const MAX_NEW_TASKS_PER_CYCLE = 5;

// Tema trend hesabı (döngüler arası negatif oran deltası) — bkz. docs/02-business-rules.md Bölüm C
export const THEME_TREND_DELTA_THRESHOLD = 0.1;
export const THEME_TREND_MIN_MENTIONS = 5;

// Priority türetme formülü — bkz. docs/09-task-engine.md
export const TASK_PRIORITY_HIGH_THRESHOLD = 30;
export const TASK_PRIORITY_MEDIUM_THRESHOLD = 12;

// `dismissed` görevin negatif mention patlamasında otomatik `open`a dönmesi
// için gereken çarpan — bkz. docs/02-business-rules.md Bölüm E
export const DISMISSED_REOPEN_NEGATIVE_MULTIPLIER = 2;

// Bildirimler — bkz. docs/02-business-rules.md Bölüm G, docs/09-task-engine.md
// "Otomatik dismiss (60 gün kuralı)".
// Görev bu kadar gün `open` kalır ve priority='low' ise otomatik `dismissed` olur.
export const AUTO_DISMISS_STALE_DAYS = 60;
// Kritik sinyal: bir temanın toplam mention_count'u bir önceki döngüye göre bu
// kat veya fazlası artarsa anlık bildirim tetiklenir (Pro plan).
export const CRITICAL_SIGNAL_MENTION_MULTIPLIER = 3;
// Kritik sinyal gürültüsünü önlemek için minimum önceki mention eşiği — çok
// düşük sayılarda (ör. 1 -> 3) "3x" teknik olarak doğru ama anlamsızca gürültülü.
export const CRITICAL_SIGNAL_MIN_PREVIOUS_MENTIONS = THEME_TREND_MIN_MENTIONS;

// Impact score bileşen ağırlıkları (kod tarafında hesaplama) — bkz.
// docs/09-task-engine.md "Impact score bileşenleri (v1)". Toplamları 100'e
// tamamlanır (trend hariç, o bir ek düzeltme/adjustment).
export const IMPACT_SCORE_COMPETITOR_PREVALENCE_WEIGHT = 0.5;
export const IMPACT_SCORE_OWN_DEFICIENCY_WEIGHT = 0.4;
export const IMPACT_SCORE_ABSOLUTE_QUALITY_DEFICIENCY_WEIGHT = 0.7;
export const IMPACT_SCORE_ABSOLUTE_QUALITY_VOLUME_WEIGHT = 0.3;
// Trend'e göre ek puan (additive, ağırlıklara dahil değil) — worsening artırır,
// improving azaltır. 09-task-engine.md'deki 14 gün recalc kuralıyla aynı yön,
// farklı büyüklük (oluşum anı için daha küçük bir ilk sinyal).
export const IMPACT_SCORE_TREND_WORSENING_BONUS = 15;
export const IMPACT_SCORE_TREND_IMPROVING_PENALTY = -10;
// "Yaygınlık"/"hacim" bileşenlerini 0-100'e sıkıştırmak için kaba bir ölçek
// sabiti — bu kadar mention'da bileşen tavan (100) yapar. Kalibrasyon
// gerektirir (bkz. docs/09-task-engine.md notu).
export const IMPACT_SCORE_MENTION_VOLUME_SCALE = TASK_MENTION_THRESHOLD * 4;

// bkz. docs/11-risks-assumptions.md Risk 3 — cron döngüsü sonunda scrape
// başarı oranı bu eşiğin altına düşerse (ve en az bir işletme işlendiyse)
// alarm loglanır; kullanıcı akışını etkilemez, sadece gözlem/uyarıdır.
export const SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD = 0.5;
