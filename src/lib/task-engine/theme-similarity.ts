import { THEME_SIMILARITY_THRESHOLD } from "@/lib/constants";

// bkz. docs/02-business-rules.md Bölüm C/D/E "tema etiketi kayması" — Aşama 1
// modelinin aynı konuya döngüler arasında (ya da aynı döngüde rakipler arası)
// farklı etiketler vermesi, tema-tabanlı eşleştirmeye dayanan her şeyi
// (görev dedup, outcome lookup, trend, dismissed reopen) sessizce kırar.
// BİRİNCİL çözüm Aşama 1 prompt'una "known theme vocabulary" eklemek (bkz.
// docs/05-ai-pipeline.md, src/lib/ai-pipeline/theme-extraction-schema.ts,
// src/lib/analysis/execute-analysis.ts fetchPreviousThemeData) — model artık
// aynı konu için önceki etiketi AYNEN tekrar kullanmaya yönlendiriliyor.
//
// Bu dosya İKİNCİL bir güvenlik ağıdır: vocabulary kuralına rağmen model yine
// de farklı bir etiket üretirse, morfolojik varyantları (Türkçe ek
// farklılıkları — "süreci"/"sürecinde", "yorumu"/"yorumlar") normalize + kaba
// token overlap ile yakalar.
//
// BİLİNEN SINIR (bilinçli, dürüstçe belgelendi): tam yeniden ifade etmeleri
// (ör. gerçek pilotta görülen "Sahte online yorum iddiası" vs "Sahte yorum ve
// itibar manipülasyonu şüphesi") YAKALAMAZ — bu çiftler neredeyse hiç ortak
// token paylaşmaz. Eşiği (THEME_SIMILARITY_THRESHOLD) bu tür eşleşmeleri
// zorlayacak kadar düşürmek, alakasız iki temanın yanlışlıkla birleşmesi
// (false positive) riskini artırır — bu senaryoyu yakalamak bu dosyanın değil,
// yukarıdaki vocabulary kuralının işi.
export function normalizeTheme(theme: string): string {
  return theme.trim().toLowerCase();
}

const STOPWORDS = new Set([
  // tr
  "ve",
  "ile",
  "için",
  "bir",
  "bu",
  // en
  "and",
  "the",
  "for",
  "with",
  "a",
]);

const TOKEN_MIN_LENGTH = 3;
// Kaba Türkçe ek toleransı: kelimenin ilk 5 karakteri kökü (ya da köke yakın
// bir öneki) genelde korur — "sürecinde"/"süreci" ikisi de "sürec" olur,
// "yorumu"/"yorumlar" ikisi de "yorum" olur. Bilinçli olarak kaba (gerçek bir
// gövdeleyici değil), sadece yaygın ek varyantlarını yakalamak için yeterli.
const TOKEN_TRUNCATE_LENGTH = 5;

function tokenize(normalized: string): Set<string> {
  const withoutPunctuation = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = withoutPunctuation
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= TOKEN_MIN_LENGTH && !STOPWORDS.has(token))
    .map((token) => token.slice(0, TOKEN_TRUNCATE_LENGTH));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersectionSize = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersectionSize += 1;
    }
  }
  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// Exact normalized equality (trim+lowercase) her zaman önce kazanır — bu,
// kod tabanının geri kalanındaki (trend, reopen) davranışla birebir aynı ilk
// adım. Aday bulunamazsa ya da en iyi aday THEME_SIMILARITY_THRESHOLD'un
// altındaysa null döner (aşırı hevesli birleştirme yapmamak için).
export function findSimilarTheme(target: string, candidates: string[]): string | null {
  const normalizedTarget = normalizeTheme(target);

  for (const candidate of candidates) {
    if (normalizeTheme(candidate) === normalizedTarget) {
      return candidate;
    }
  }

  const targetTokens = tokenize(normalizedTarget);
  let best: { candidate: string; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenize(normalizeTheme(candidate));
    const score = jaccardSimilarity(targetTokens, candidateTokens);
    if (score >= THEME_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }

  return best?.candidate ?? null;
}
