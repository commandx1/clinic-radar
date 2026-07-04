// Google yorum hızı ölçüm scripti — "haftalık yeni yorum sinyali var mı?"
// sorusuna veri sağlar (bkz. docs/11-risks-assumptions.md Bölüm A, Risk 1).
// Tek seferlik araştırma scripti; ürün koduna dahil değildir, `npx tsx` ile
// çalıştırılır. DİKKAT: Apify çağrıları ücretlidir, --help dışında her
// çalıştırma gerçek bir scrape tetikler.
//
// Kullanım:
//   npx tsx scripts/measure-review-velocity.ts --query "dental clinic" \
//     --lat 30.2672 --lng -97.7431 --radius-km 10 --count 25
//
// mevcut Apify sarmalayıcıları yeniden kullanılır (src/lib/apify/*) — burada
// scraping mantığı tekrar yazılmaz, sadece örnekleme + istatistik katmanı var.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { searchPlacesNearby, type PlaceCandidate } from "../src/lib/apify/google-places";
import { fetchReviewsForPlaces, type ScrapedReview } from "../src/lib/apify/google-reviews";

// Apify actor'ün run-sync-get-dataset-items çağrısı yorum taramasında uzun
// sürebilir — client.ts'teki 100_000ms varsayılanı yetmez, 15 dk kullanıyoruz.
const REVIEWS_TIMEOUT_MS = 900_000;

const EXAMPLE_COORDINATES: readonly { label: string; lat: number; lng: number }[] = [
  { label: "Austin TX", lat: 30.2672, lng: -97.7431 },
  { label: "Miami FL", lat: 25.7617, lng: -80.1918 },
  { label: "Phoenix AZ", lat: 33.4484, lng: -112.074 },
  { label: "İstanbul Kadıköy", lat: 40.99, lng: 29.027 },
  { label: "Antalya Muratpaşa", lat: 36.888, lng: 30.703 },
];

interface CliOptions {
  query: string;
  label: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  count: number;
  windowDays: number;
  maxReviews: number;
  out: string;
}

function printHelp(): void {
  const lines = [
    "measure-review-velocity — klinikler için Google yorum hızını (yorum/ay) ölçer.",
    "",
    "Kullanım:",
    "  npx tsx scripts/measure-review-velocity.ts --query <arama-terimi> --lat <sayı> --lng <sayı> [seçenekler]",
    "",
    "Zorunlu:",
    '  --query <str>        Arama terimi, örn. "dental clinic" veya "diş kliniği"',
    "  --lat <num>           Enlem",
    "  --lng <num>           Boylam",
    "",
    "Opsiyonel:",
    "  --radius-km <num>     Arama yarıçapı (varsayılan: 10)",
    "  --count <num>         Örneklenecek klinik sayısı (varsayılan: 25)",
    "  --window-days <num>   Hız penceresi, gün (varsayılan: 90)",
    "  --max-reviews <num>   Klinik başına çekilecek en yeni yorum sayısı (varsayılan: 100)",
    '  --label <str>         Dosya adı etiketi, örn. "dental-waco" — aynı query ile farklı',
    "                        şehir/koşu raporlarının birbirinin üzerine yazmasını önler",
    "  --out <path>          Rapor çıktı yolu (varsayılan: docs/research/review-velocity-<label|query-slug>-<tarih>.md)",
    "  --help                Bu mesajı göster ve çık",
    "",
    "Örnek koordinatlar:",
    ...EXAMPLE_COORDINATES.map((c) => `  ${c.label}: ${String(c.lat)} ${String(c.lng)}`),
    "",
    "Not: Bu script gerçek Apify scrape'i tetikler (ücretli). --help hariç her",
    "çalıştırma APIFY_TOKEN gerektirir ve ağ çağrısı yapar.",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

// `.env.local`'i basit satır bazlı parse eder — repo'ya yeni bağımlılık
// (dotenv vb.) eklemeden. Zaten set edilmiş env değişkenlerinin üzerine yazmaz.
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== "" && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseNumberFlag(raw: string | undefined, flagName: string): number {
  if (raw === undefined || raw.trim() === "") {
    throw new Error(`--${flagName} zorunludur ve sayısal bir değer almalıdır.`);
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`--${flagName} geçerli bir sayı değil: "${raw}"`);
  }

  return value;
}

// process.argv'yi basit `--flag value` çiftlerine çevirir (boolean --help hariç).
function parseArgv(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const hasNext = i + 1 < argv.length;
    const next = hasNext ? argv[i + 1] : "";
    if (hasNext && !next.startsWith("--")) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, "");
    }
  }

  return flags;
}

function parseCliOptions(argv: string[]): CliOptions {
  const flags = parseArgv(argv);

  const query = flags.get("query");
  if (query === undefined || query.trim() === "") {
    throw new Error("--query zorunludur, örn. --query \"dental clinic\"");
  }

  const lat = parseNumberFlag(flags.get("lat"), "lat");
  const lng = parseNumberFlag(flags.get("lng"), "lng");
  const radiusKm = flags.has("radius-km") ? parseNumberFlag(flags.get("radius-km"), "radius-km") : 10;
  const count = flags.has("count") ? parseNumberFlag(flags.get("count"), "count") : 25;
  const windowDays = flags.has("window-days")
    ? parseNumberFlag(flags.get("window-days"), "window-days")
    : 90;
  const maxReviews = flags.has("max-reviews")
    ? parseNumberFlag(flags.get("max-reviews"), "max-reviews")
    : 100;

  const rawLabel = flags.get("label");
  const label = rawLabel !== undefined && rawLabel.trim() !== "" ? rawLabel.trim() : null;

  const defaultOut = `docs/research/review-velocity-${slugify(label ?? query)}-${todayIsoDate()}.md`;
  const out = flags.get("out") ?? defaultOut;

  return { query, label, lat, lng, radiusKm, count, windowDays, maxReviews, out };
}

interface ClinicVelocity {
  place: PlaceCandidate;
  inWindowCount: number;
  fetchedCount: number;
  oldestFetchedAt: Date | null;
  unparsedCount: number;
  scrapeFailed: boolean;
  censored: boolean;
  reviewsPerMonth: number; // sansürlü ise alt sınır değeri
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

// Bir klinik için pencere içi yorum sayısı + sansür kontrolünü hesaplar.
// Sansür: en eski çekilen yorum pencere başlangıcından daha yeniyse VE
// çekilen yorum sayısı max-reviews'a ulaştıysa, gerçek hız ölçülenden
// yüksektir — bu durumda alt sınır değeri raporlanır.
function computeClinicVelocity(
  place: PlaceCandidate,
  reviews: ScrapedReview[],
  windowStart: Date,
  windowDays: number,
  maxReviews: number,
): ClinicVelocity {
  let inWindowCount = 0;
  let unparsedCount = 0;
  let oldestFetchedAt: Date | null = null;

  for (const review of reviews) {
    if (review.published_at === null) {
      unparsedCount += 1;
      continue;
    }

    const publishedAt = new Date(review.published_at);
    if (Number.isNaN(publishedAt.getTime())) {
      unparsedCount += 1;
      continue;
    }

    if (oldestFetchedAt === null || publishedAt < oldestFetchedAt) {
      oldestFetchedAt = publishedAt;
    }

    if (publishedAt >= windowStart) {
      inWindowCount += 1;
    }
  }

  const scrapeFailed = reviews.length === 0;
  const censored =
    !scrapeFailed && oldestFetchedAt !== null && oldestFetchedAt > windowStart && reviews.length >= maxReviews;

  const reviewsPerMonth = (inWindowCount * 30) / windowDays;

  return {
    place,
    inWindowCount,
    fetchedCount: reviews.length,
    oldestFetchedAt,
    unparsedCount,
    scrapeFailed,
    censored,
    reviewsPerMonth,
  };
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatVelocity(v: ClinicVelocity): string {
  const rounded = v.reviewsPerMonth.toFixed(1);
  return v.censored ? `≥${rounded}/ay (sansürlü)` : `${rounded}/ay`;
}

function buildMarkdownReport(
  options: CliOptions,
  velocities: ClinicVelocity[],
  totalUnparsed: number,
): string {
  const measured = velocities.map((v) => v.reviewsPerMonth);
  const med = median(measured);
  const p25 = percentile(measured, 25);
  const p75 = percentile(measured, 75);
  const min = measured.length > 0 ? Math.min(...measured) : 0;
  const max = measured.length > 0 ? Math.max(...measured) : 0;
  const censoredCount = velocities.filter((v) => v.censored).length;
  const failedCount = velocities.filter((v) => v.scrapeFailed).length;
  const successRate =
    velocities.length > 0 ? ((velocities.length - failedCount) / velocities.length) * 100 : 0;

  // Karar hattı: haftada ≥1 yorum ≈ ayda ≥4.3 yorum (30/7).
  const weeklySignalThreshold = 30 / 7;
  const weeklySignalCount = velocities.filter((v) => v.reviewsPerMonth >= weeklySignalThreshold).length;
  const weeklySignalRate = velocities.length > 0 ? (weeklySignalCount / velocities.length) * 100 : 0;
  const lowVolumeCount = velocities.filter((v) => v.reviewsPerMonth < 2).length;
  const lowVolumeRate = velocities.length > 0 ? (lowVolumeCount / velocities.length) * 100 : 0;

  const rows = velocities
    .map((v) => {
      const rating = v.place.rating !== null ? v.place.rating.toFixed(1) : "—";
      return `| ${v.place.name} | ${String(v.place.review_count ?? 0)} | ${String(v.inWindowCount)} | ${formatVelocity(v)} | ${rating} |`;
    })
    .join("\n");

  return `# Yorum Hızı Ölçümü — "${options.query}"

**Parametreler:** lat=${String(options.lat)}, lng=${String(options.lng)}, radius-km=${String(options.radiusKm)}, count=${String(options.count)}, window-days=${String(options.windowDays)}, max-reviews=${String(options.maxReviews)}${options.label !== null ? `, label=${options.label}` : ""}
**Tarih:** ${todayIsoDate()}

Bu rapor \`docs/11-risks-assumptions.md\` Bölüm A, Risk 1 için erken sinyal verisidir:
"hedef segmentte rakip başına aylık ortalama yorum hızı" sorusuna cevap arar.

## Özet

| Metrik | Değer |
| --- | --- |
| Klinik sayısı | ${String(velocities.length)} |
| Medyan yorum/ay | ${med.toFixed(1)} |
| p25 yorum/ay | ${p25.toFixed(1)} |
| p75 yorum/ay | ${p75.toFixed(1)} |
| Min / Max yorum/ay | ${min.toFixed(1)} / ${max.toFixed(1)} |
| Sansürlü klinik sayısı | ${String(censoredCount)} |
| Scrape başarı oranı | ${successRate.toFixed(0)}% (${String(velocities.length - failedCount)}/${String(velocities.length)}) |
| Parse edilemeyen yorum tarihi sayısı | ${String(totalUnparsed)} |

## Kadans kararı için girdiler

- Haftada ≥1 yorum alan klinik oranı (≥4.3 yorum/ay): **${weeklySignalRate.toFixed(0)}%** (${String(weeklySignalCount)}/${String(velocities.length)})
- Ayda <2 yorum alan oran: **${lowVolumeRate.toFixed(0)}%** (${String(lowVolumeCount)}/${String(velocities.length)})

Medyan düşükse veya "ayda <2 yorum" oranı yüksekse, "haftalık" kadans vaadi
yeniden gözden geçirilmelidir (bkz. Risk 1 panzehiri #2: hacme göre kadans).
Sıfır/başarısız scrape oranı da Risk 3 ("Google veri erişimi zorlaşır") için
bir erken sinyaldir.

## Klinik bazında detay

| Klinik | Toplam yorum (Google) | Pencere içi yorum | Yorum/ay | Puan |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function buildCsv(velocities: ClinicVelocity[]): string {
  const header = [
    "place_id",
    "name",
    "rating",
    "total_review_count",
    "in_window_count",
    "fetched_count",
    "reviews_per_month",
    "censored",
    "scrape_failed",
    "unparsed_count",
  ].join(",");

  const rows = velocities.map((v) =>
    [
      v.place.google_place_id,
      v.place.name,
      v.place.rating !== null ? v.place.rating.toString() : "",
      v.place.review_count !== null ? v.place.review_count.toString() : "",
      v.inWindowCount.toString(),
      v.fetchedCount.toString(),
      v.reviewsPerMonth.toFixed(2),
      v.censored.toString(),
      v.scrapeFailed.toString(),
      v.unparsedCount.toString(),
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [header, ...rows].join("\n");
}

function ensureDirFor(filePath: string): void {
  const dir = dirname(resolve(process.cwd(), filePath));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    printHelp();
    return;
  }

  loadEnvLocal();

  const options = parseCliOptions(argv);

  if (!process.env.APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN tanımlı değil (.env.local kontrol edin).");
  }

  process.stdout.write(
    `Klinik aranıyor: "${options.query}" (lat=${String(options.lat)}, lng=${String(options.lng)}, radius=${String(options.radiusKm)}km)...\n`,
  );

  const candidates = await searchPlacesNearby({
    lat: options.lat,
    lng: options.lng,
    radiusKm: options.radiusKm,
    searchKeyword: options.query,
    maxResults: options.count * 4, // review_count=0/null düşenler için pay
  });

  // Sıralama yapılmaz (örnekleme yanlılığı olmasın) — sadece review_count
  // 0/null olanlar elenir, geliş sırası korunur.
  const eligible = candidates.filter(
    (c) => c.review_count !== null && c.review_count > 0,
  );
  const sample = eligible.slice(0, options.count);

  if (sample.length === 0) {
    throw new Error("Uygun klinik bulunamadı (review_count > 0 olan sonuç yok).");
  }

  process.stdout.write(`${String(sample.length)} klinik örneklendi, yorumlar çekiliyor (bu uzun sürebilir)...\n`);

  const placeIds = sample.map((p) => p.google_place_id);
  const allReviews = await fetchReviewsForPlaces(placeIds, options.maxReviews, {
    timeoutMs: REVIEWS_TIMEOUT_MS,
  });

  const reviewsByPlace = new Map<string, ScrapedReview[]>();
  for (const review of allReviews) {
    const existing = reviewsByPlace.get(review.place_id);
    if (existing) {
      existing.push(review);
    } else {
      reviewsByPlace.set(review.place_id, [review]);
    }
  }

  const windowStart = new Date(Date.now() - options.windowDays * 24 * 60 * 60 * 1000);

  const velocities = sample.map((place) =>
    computeClinicVelocity(
      place,
      reviewsByPlace.get(place.google_place_id) ?? [],
      windowStart,
      options.windowDays,
      options.maxReviews,
    ),
  );

  const totalUnparsed = velocities.reduce((sum, v) => sum + v.unparsedCount, 0);
  const failedPlaces = velocities.filter((v) => v.scrapeFailed);

  const report = buildMarkdownReport(options, velocities, totalUnparsed);
  const csv = buildCsv(velocities);

  ensureDirFor(options.out);
  writeFileSync(resolve(process.cwd(), options.out), report, "utf-8");
  // --out ".md" ile bitmiyorsa replace no-op olur ve CSV raporun üzerine
  // yazardı — bu durumda ".csv" sonuna eklenir.
  const csvPath = options.out.endsWith(".md")
    ? options.out.replace(/\.md$/, ".csv")
    : `${options.out}.csv`;
  writeFileSync(resolve(process.cwd(), csvPath), csv, "utf-8");

  const med = median(velocities.map((v) => v.reviewsPerMonth));
  process.stdout.write(`\nRapor yazıldı: ${options.out}\n`);
  process.stdout.write(`CSV yazıldı: ${csvPath}\n`);
  process.stdout.write(`Klinik sayısı: ${String(velocities.length)}, medyan yorum/ay: ${med.toFixed(1)}\n`);
  if (failedPlaces.length > 0) {
    process.stdout.write(
      `Scrape başarısız (${String(failedPlaces.length)}): ${failedPlaces.map((v) => v.place.name).join(", ")}\n`,
    );
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Hata: ${message}\n`);
  process.exitCode = 1;
});
