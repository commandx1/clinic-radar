-- ============ Canlı puan (recent rating) + rakip uyarıları (Faz 2.7) ============
-- bkz. docs/02-business-rules.md Bölüm F/G, docs/05-ai-pipeline.md, docs/08-dashboard.md
--
-- PROBLEM: businesses.rating / competitors.rating yalnızca ilk Apify
-- enrichment'ında (Google Places "place details" çağrısı) yazılır — sonraki
-- analiz döngüleri Google yorum actor'ünden yorum başına puan alır ama bu
-- toplu puanı hiç güncellemez. Sonuç: Competitor Rank, Trend grafiği ve
-- Competitors sayfası onboarding sonrası hiçbir zaman değişmiyordu.
--
-- ÇÖZÜM: her analiz döngüsünde, analiz penceresi içinde (own + rakip) taze
-- çekilen yorumların `rating` alanından bir "canlı" ortalama hesaplanıp ayrı
-- kolonlara yazılır. Resmi `rating` (Google'ın tüm-zamanlar toplu puanı)
-- DEĞİŞTİRİLMEZ — iki puan farklı şeyler ölçer (bkz. docs/02-business-rules.md
-- Bölüm F): `rating` = Google toplu puanı, `recent_rating` = son N günün
-- (analiz penceresi) taze yorumlarından hesaplanan puan. Bkz.
-- src/lib/analysis/recent-ratings.ts.
alter table public.businesses
  add column recent_rating numeric null,
  add column recent_rating_reviews integer null,
  add column recent_rating_window_days integer null,
  add column recent_rating_updated_at timestamptz null;

alter table public.competitors
  add column recent_rating numeric null,
  add column recent_rating_reviews integer null,
  add column recent_rating_window_days integer null,
  add column recent_rating_updated_at timestamptz null;

-- Trend grafiğinde own vs rakip-medyan canlı puan serisi için — her
-- snapshot anındaki own + tüm rakiplerin canlı puanının anlık görüntüsü
-- (bkz. src/lib/analysis/recent-ratings.ts, docs/08-dashboard.md Trend).
-- Şekil: { own: { rating, reviews } | null, competitors: [{ competitor_id,
-- name, rating, reviews }], recent_rank: number | null }.
alter table public.clinic_score_history
  add column recent_ratings jsonb null;

-- Rakip uyarıları (competitor_review_surge / competitor_rating_shift /
-- competitor_negative_spike) — bkz. src/lib/analysis/competitor-alerts.ts,
-- docs/02-business-rules.md Bölüm G.
alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'competitor_review_delta',
    'theme_spike',
    'task_auto_dismissed',
    'competitor_review_surge',
    'competitor_rating_shift',
    'competitor_negative_spike'
  ));
