# 09 — Task Engine & Opportunity Score

Bu doküman, ürünün "wow" özelliğinin (Opportunity Score) ve görev yaşam döngüsünün algoritmik detayını içerir. `02-business-rules.md`'deki kurallar burada formüle dökülür.

## Opportunity Score bileşenleri

Her görev iki skorla değerlendirilir:
- **impact_score** (0-100): Artık Aşama 2 Claude çağrısından ALINMAZ — `src/lib/task-engine/impact-score.ts` içinde kod tarafında, rakip yaygınlığı + own eksikliği + trend kırılımından deterministik hesaplanır (bkz. "Impact score bileşenleri (v1)" altbölümü).
- **effort_score** (1-5): uygulama zorluğu. Aşama 2 Claude çağrısından (`06-prompts.md`) gelir. 1 = hızlı/kolay (ör. "Google profiline fotoğraf ekle"), 5 = zor/uzun soluklu (ör. "randevu sistemini değiştir").

### Impact score bileşenleri (v1)

İki aday tipi (`candidate_source_type`) için farklı formül kullanılır:

**`competitive_gap`** (rakip bu temada güçlü, klinik zayıf/eksik):
```
competitor_prevalence = rakibin bu temadaki pozitif mention oranı × 100   (0-100)
own_deficiency        = (1 - kliniğin bu temadaki pozitif mention oranı) × 100
                         (own bu temada hiç veri üretmediyse tam eksiklik = 100)
trend_adjustment      = own tema trend'ine göre +IMPACT_SCORE_TREND_WORSENING_BONUS /
                         IMPACT_SCORE_TREND_IMPROVING_PENALTY / 0

impact_score = clamp(
    competitor_prevalence * IMPACT_SCORE_COMPETITOR_PREVALENCE_WEIGHT +
    own_deficiency        * IMPACT_SCORE_OWN_DEFICIENCY_WEIGHT +
    trend_adjustment,
  0, 100)
```

**`absolute_quality`** (rakip fark etmeksizin kliniğin kendi ciddi/tekrar eden sorunu — rakip verisi bu tipte anlamsız, `competitor_prevalence = null`):
```
own_deficiency   = kliniğin bu temadaki negatif mention oranı × 100
                   — severity='critical' ise oran hesaplanmaz, sabit 100 kabul edilir
                     (bkz. 02-business-rules.md Bölüm D "kritik tekil yorum sinyali";
                     tek ciddi yorum etraftaki olumlu yorumlarla sulandırılmamalı)
volume           = clamp((negatif mention sayısı / IMPACT_SCORE_MENTION_VOLUME_SCALE) * 100, 0, 100)
trend_adjustment = (yukarıdaki ile aynı mantık)

impact_score = clamp(
    own_deficiency * IMPACT_SCORE_ABSOLUTE_QUALITY_DEFICIENCY_WEIGHT +
    volume         * IMPACT_SCORE_ABSOLUTE_QUALITY_VOLUME_WEIGHT +
    trend_adjustment,
  0, 100)
```

Ağırlık/eşik sabitleri `src/lib/constants.ts` içinde tek yerde tutulur (`IMPACT_SCORE_*`, `IMPACT_SCORE_MENTION_VOLUME_SCALE`) — kalibrasyon için buradan değiştirilir. Görev kartında "neden bu skor" kırılımını göstermek için `ImpactScoreBreakdown` (competitor_prevalence, own_deficiency, trend, trend_adjustment) ham bileşenleriyle birlikte döndürülür ve saklanır (`tasks.impact_score_breakdown`).

**`profile_gap`** (rakip fark analizi/mention'a dayanmayan, deterministik profil sinyalleri — bkz. `02-business-rules.md` Bölüm D madde 3): ayrı bir formül yoktur, `computeCompetitiveGapImpactScore` (yukarıdaki `competitive_gap` formülü) reuse edilir; `trend` her zaman `null` (bu kaynağın theme_summary/trend kavramı yok). Girdi bileşenleri kaynağa göre yeniden yorumlanır:
- **Yorum yanıt oranı** adayı: `competitor_prevalence` = **referans rakibin** yanıt oranı (`positive_mentions = round(referenceRate×100)` — hacim eşiğini (`PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_REVIEWS`, 10) geçen rakip varsa o rakibin kendi oranı, yoksa rakip ortalaması; bkz. `02-business-rules.md` Bölüm D reply-rate kuralı), `own_deficiency` = own yanıtsız oranı (`positive_mentions = round(ownOran×100)` own girdisi olarak verilir, deficiency `(1-ownOran)×100` olarak çıkar).
- **Website eksikliği** adayı: `competitor_prevalence` = website'ı olan rakip oranı (`positive_mentions = round(website'lıPay×100)`), own teması **verilmez** (`undefined`) → `own_deficiency` her zaman **100** (own website'sizse eksiklik zaten tamdır).

Hesaplama `src/lib/analysis/profile-gap-candidates.ts` içinde yapılır (task-candidates.ts'in `attachImpactScores`'undan bağımsız — bu adaylar zaten skorlanmış (`ScoredTaskCandidate`) halde `execute-analysis.ts`'e döner, Stage 2 adaylarıyla `rankCandidates`'tan önce birleştirilir).

## Priority türetme (kod tarafında, promptta değil)
```
priority_raw = impact_score / effort_score

if priority_raw >= 30  → priority = "high"
if priority_raw >= 12  → priority = "medium"
else                    → priority = "low"
```
Bu eşikler ilk 20-30 gerçek görev üzerinde kalibre edilmeli — başlangıç değerleri olarak kullanılsın.

## Görev dedup (`upsertTasks`, mükerrer görev üretmeyi önleme)
Kural kaynağı `02-business-rules.md` Bölüm D — burada sadece mekanizma özetlenir. `upsertTasks`
(`src/lib/analysis/execute-analysis.ts`) her aday için önce EXACT (normalize edilmiş) `theme`+`source_type`+
`status='open'` eşleşmesine bakar; bulunursa mevcut görev güncellenir (insert edilmez).

**Faz 2.8 — fuzzy güvenlik ağı.** Exact eşleşme kaçarsa (Aşama 1 modeli aynı konuyu bu döngüde hafifçe farklı
adlandırmışsa — gerçek Mersin pilotunda gözlemlendi, bkz. `05-ai-pipeline.md`), aynı `source_type`'taki AÇIK
görevler arasında `findSimilarTheme` (`src/lib/task-engine/theme-similarity.ts`, `THEME_SIMILARITY_THRESHOLD =
0.6`, Jaccard benzerliği) ile morfolojik olarak benzer bir tema aranır. Bulunursa o görev candidate'in güncel
skor/başlık/açıklamasıyla güncellenir; `theme` kolonu ve `outcome_baseline` BİLİNÇLİ OLARAK dokunulmadan
kalır (görevin kendi kimliği ve geçmişi korunur). Bu, `MAX_NEW_TASKS_PER_CYCLE` kotasına dahil edilmez (kota
yalnızca gerçek yeni oluşturmaları sınırlar — Bölüm D). Birincil savunma yine de kaynağındadır: Aşama 1'e
verilen known-theme vocabulary (`05-ai-pipeline.md`), etiketin döngüler arası kaymasını en başta azaltır;
fuzzy ağ SADECE bunun kaçırdığı dar morfolojik varyantlar için bir son çare.

## Görev yeniden önceliklendirme (her analiz döngüsünde)
impact_score artık Aşama 2 modelinden gelmediği için (yukarı bkz.), ayrı bir
"14 gün aging bump" süreci **kaldırılmıştır**. Bunun yerine her analiz döngüsünde
(`upsertTasks`, `src/lib/analysis/execute-analysis.ts`) mevcut `open` görevin
impact_score'u temanın en güncel own/rakip mention kırılımı + `theme_summary.trend`
değeriyle **sıfırdan yeniden hesaplanır**; böylece skor doğal olarak tazelenir:
1. Trend `worsening` → `+IMPACT_SCORE_TREND_WORSENING_BONUS` (constants.ts, şu an **+15**).
2. Trend `improving` → `IMPACT_SCORE_TREND_IMPROVING_PENALTY` (constants.ts, şu an **-10**;
   kullanıcı muhtemelen zaten bir şey yapıyor, öncelik düşer).
3. Trend `stable`/`null` → 0.
4. Nihai skor `clamp(…, 0, 100)`, ardından `priority_raw` → `priority` güncellenir ve
   `last_priority_recalc_at` yazılır.

> Not: değerler tek kaynak `src/lib/constants.ts`'tir; bu doküman yalnızca örnek
> gösterir — çakışma olursa constants.ts esastır.

## Otomatik dismiss (60 gün kuralı)
Görev 60 gün `open` kalır ve `priority = low` ise → `status = dismissed`, kullanıcıya bildirim (`02-business-rules.md` Bölüm G).

## Dismissed görev reopen (2x negatif patlama kuralı)
Bu kontrol analiz döngüsü içinde (`analysis/run` route'u) tema özeti (`theme_summary`) kaydından sonra, görev upsert'inden önce çalışır — bkz. `02-business-rules.md` Bölüm E.

## Görev sonuç takibi (per-task outcome tracking)
Ürünün "işe yaradı mı?" kanıtı — her görev, oluşturulduğu andaki ölçülebilir sinyal
durumunu (`tasks.outcome_baseline`) ve her sonraki analiz döngüsündeki en güncel
durumu (`tasks.outcome_latest`) saklar (ikisi de `jsonb`, şekil aşağıdaki
`OutcomeMetric` union'ı — bkz. `03-database.md`). Saf/test edilebilir hesap
mantığı `src/lib/task-engine/task-outcome.ts`'te; supabase'e dokunan taze­leme
`src/lib/analysis/task-outcomes.ts`'te (`refreshTaskOutcomes`).

**Metric türleri** (görevin `theme`/`source_type`'ına göre):
- **`theme`** (`competitive_gap` / `absolute_quality`): görevin teması ÖNCE
  `normalizeTheme` ile own tarafının o döngüdeki `theme_summary` kırılımına
  eşleştirilir (bkz. `02-business-rules.md` Bölüm C tema eşleştirme kuralı).
  Eşleşme bulunursa `positive`/`negative`/`negative_ratio` (`negative /
  (positive + negative)`, toplam 0 ise 0) ve `absent: false`; bulunamazsa (tema
  artık own yorumlarında hiç geçmiyor) `absent: true` ve sayılar sıfır.
  **Faz 2.8:** exact eşleşme kaçarsa, "absent" sonucuna varmadan ÖNCE
  `findSimilarTheme` (`src/lib/task-engine/theme-similarity.ts`) ile bir
  benzerlik denemesi daha yapılır — gerekçe: eski bir etiket sessizce yeniden
  adlandırılmışsa (bkz. `05-ai-pipeline.md` "known-theme vocabulary" — gerçek
  Mersin pilotunda gözlemlendi), `absent: true` `compareOutcome`'ın "tema
  tamamen kayboldu → improved" kısayolunu (aşağıdaki Verdict eşikleri) yanlış
  tetikleyip sahte bir "işe yaradı!" verdict'i üretiyordu. Benzerlik ağı sadece
  dar morfolojik varyantları yakalar (eşik `THEME_SIMILARITY_THRESHOLD = 0.6`)
  — tam rephrasing'lerde (gerçek pilot örnekleri) yine de `absent: true` kalır,
  bunun asıl çözümü kaynağındaki (Aşama 1) known-theme vocabulary'dir.
- **`reply_rate`** (`theme = "profile:reply_rate"`): own'un o pencerede
  `total`/`replied` yorum sayısı ve `rate = replied/total` (total 0 ise 0).
- **`website`** (`theme = "profile:website"`): own'un `website` alanının dolu
  olup olmadığı (`has_website`).
- Diğer tüm `theme`/`source_type` kombinasyonları için `null` (metric
  üretilmez, outcome kaydedilmez).

**Verdict eşikleri** (`compareOutcome`, `OutcomeVerdict = "improved" |
"worsened" | "flat"`; `kind` uyuşmazlığında `null`):
- **theme:** `improved` — `latest.negative_ratio <= baseline.negative_ratio -
  THEME_TREND_DELTA_THRESHOLD` **VEYA** (`latest.absent` **VE**
  `baseline.negative >= TASK_MENTION_THRESHOLD`, yani tema eşik üstü bir
  hacimle konuşuluyorken tamamen kaybolduysa da iyileşme sayılır). `worsened`
  — `latest.negative_ratio >= baseline.negative_ratio +
  THEME_TREND_DELTA_THRESHOLD`. Aksi halde `flat`. (Aynı eşikler
  `theme_summary.trend`'i de belirler — bkz. `02-business-rules.md` Bölüm C.)
- **reply_rate:** oran `THEME_TREND_DELTA_THRESHOLD` (10 yüzde puanı) ya da
  fazlası yükselirse `improved`, aynı miktarda düşerse `worsened`, aksi halde
  `flat`.
- **website:** baseline'da yoktu, latest'te varsa `improved`; aksi halde
  `flat` (bu görev zaten sadece own website'ı yokken üretildiği için baseline
  pratikte hep `has_website: false`'tur — bkz. Bölüm D madde 3).

**Yazma akışı** (`execute-analysis.ts`): `upsertTasks` bir görevi ilk kez
INSERT ederken `outcome_baseline`'ı o anki own kırılımından hesaplar ve donar
— bir daha ÜZERİNE YAZILMAZ (baseline sabit bir başlangıç noktası olmalı).
Task upsert'inden hemen sonra `refreshTaskOutcomes` **tüm** `open`/`done`
görevler için `outcome_latest`'i tazeler; migration öncesi oluşmuş görevlerde
(`outcome_baseline` hâlâ `null`) bu ilk ölçüm aynı zamanda baseline olarak da
yazılır (geriye dönük veri yok, ilk gördüğümüz an baseline kabul edilir).
`dismissed` görevler kapsam dışıdır.

**Okuma/UI:** `resolve-tasks-shared.ts`, jsonb kolonlarını `parseOutcomeMetric`
(zod) ile güvenli parse eder — şemaya uymayan/bozuk veri asla UI'a sızmaz.
Kart satırı (`task-outcome-line.tsx`) yalnızca hem baseline hem latest mevcutsa
VE `measured_at`'leri farklıysa (yani en az bir analiz döngüsü geçtiyse)
gösterilir — bkz. `08-dashboard.md`.

## Clinic Score formülü (ilk versiyon, kalibre edilecek)
```
clinic_score =
    0.4 * (own_rating / 5 * 100) +
    0.3 * task_completion_rate * 100 +
    0.3 * review_growth_trend_normalized
```
- `task_completion_rate`: son 90 gündeki done/toplam oranı.
- `review_growth_trend_normalized`: son 90 gün yorum artış hızının rakip ortalamasına göre normalize edilmiş hali (0-100 aralığına sıkıştırılır).

Bu formül **v1 tahminidir** — gerçek kullanıcı verisiyle (özellikle hangi görev tiplerinin gerçekten rating'i etkilediği görüldükçe) ağırlıklar revize edilmeli. Formülün kod içinde tek bir yerde (config) tutulması, A/B test edilebilmesi için önemli.

## Potential Rating Gain (Executive kart için)
```
potential_rating_gain = sum(impact_score of open tasks with priority='high') / 1000
```
Kaba bir tahmin katsayısıdır (1000 sabiti kalibrasyon gerektirir), amaç kesin bir bilimsel tahmin değil, kullanıcıya "bunu yaparsan işe yarar" hissi vermek.

## Opportunity Estimate (Faz 2.5 — Overview'daki "Fırsat tahmini" kartı)

Saf hesaplama `src/lib/task-engine/opportunity-estimate.ts` (`estimateOpportunity`), DB okuma katmanı
`src/app/(app)/business/resolve-opportunity-estimate.ts`, kart `opportunity-estimate-card.tsx`. Sabitler
`src/lib/constants.ts`'te `OPPORTUNITY_*` öneki ile. **Her zaman bantlı** — CLAUDE.md ve `10-roadmap.md`
Faz 1.2 notundaki "asla '+0.18 yıldız' gibi kesin tahmin verilmez" kuralı bu kart için de geçerlidir.

**Rating gap:**
```
competitor_median_rating = median(rakiplerin puanları, null olmayanlar)
rating_gap = round1dp(competitor_median_rating - own_rating)   -- own puan ya da hiç rakip puanı yoksa null
```
`rating_gap > 0` → rakip önde (kullanıcı geride); `< 0` → kullanıcı önde; `0` → eşit. İkisi de aynı 1dp'ye
yuvarlanır, ham (uydurma hassasiyette) bir sayı asla gösterilmez.

**Gelir etkisi bandı (yalnızca rating_gap > 0 iken):**
```
revenue_uplift_pct_range = [round1dp(gap * OPPORTUNITY_REVENUE_PCT_PER_STAR_MIN),
                             round1dp(gap * OPPORTUNITY_REVENUE_PCT_PER_STAR_MAX)]
```
`OPPORTUNITY_REVENUE_PCT_PER_STAR_MIN/MAX = 5/9` — yayınlanmış yerel işletme araştırmalarının (Luca 2011 /
Anderson, HBS; Yelp verisiyle) verdiği "+1 yıldız ≈ +%5-9 gelir" bandı, tek bir katsayı değil. `docs/11-risks-assumptions.md`
Bölüm C'deki fiyat/ROI anlatısıyla aynı kaynak ailesi ("bir yıllık ek hastanın değeri aboneliği kat kat
öder") — kart bu anlatının somutlaştırılmış hali, ayrı bir tahmin modeli değil.

**$ bandı (yalnızca `avg_patient_value_usd` ve `monthly_new_patients` doluysa, ikisi de opsiyonel iş
girdisi — `businesses` tablosu, işletme düzenleme formu):**
```
annual_revenue_usd_range = [
  round2sigfig(monthly_new_patients * 12 * avg_patient_value_usd * revenue_uplift_pct_range[0] / 100),
  round2sigfig(monthly_new_patients * 12 * avg_patient_value_usd * revenue_uplift_pct_range[1] / 100),
]
```
2 anlamlı basamağa yuvarlama (12.345 değil 12.000) bilinçli — bant, kesinlik değil. Girdiler eksikse kart
$ bandı yerine girdileri girmeye yönlendiren bir CTA gösterir.

**4.0 filtre eşiği uyarısı:**
```
below_filter_threshold = own_rating < OPPORTUNITY_RATING_FILTER_THRESHOLD (4.0)
                          && competitor_median_rating >= OPPORTUNITY_RATING_FILTER_THRESHOLD
```
Rakip medyanı da 4.0 altındaysa uyarı gösterilmez — rakipler de düşükse bu bir rekabet fırsatı değildir
(Impact Score'daki "competitor_prevalence" mantığıyla aynı ilke).

**Yorum hızı açığı:**
```
own_reviews_per_month = own_reviews_in_window / (OPPORTUNITY_VELOCITY_WINDOW_DAYS / 30)
competitor_avg_reviews_per_month = avg(competitor_reviews_in_window) / (OPPORTUNITY_VELOCITY_WINDOW_DAYS / 30)
review_velocity_ratio = competitor_avg_reviews_per_month > 0 ? own/competitor : null
velocity_gap = ratio !== null && ratio < OPPORTUNITY_REVIEW_VELOCITY_GAP_RATIO (0.7)
```
Pencere own/rakip için aynı (`reviews.published_at >= now() - OPPORTUNITY_VELOCITY_WINDOW_DAYS gün`, sabit
90 gün) — pipeline'ın adaptif analiz penceresine (`AI_ANALYSIS_WINDOW_DAYS_STEPS`) bağlı DEĞİL, kasıtlı
olarak ayrı bir sabit.

**Kartın görünürlüğü:** `rating_gap` VE `review_velocity_ratio` ikisi de null ise (kıyaslanabilir hiçbir
veri yok) kart hiç render edilmez.
