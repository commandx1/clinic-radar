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

// Görev oluşturma eşikleri — bkz. docs/02-business-rules.md Bölüm D
export const TASK_MENTION_THRESHOLD = 5;
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
