import { describe, expect, it } from "vitest";

import type { AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import {
  buildOutcomeMetric,
  compareOutcome,
  parseOutcomeMetric,
  type OutcomeMetric,
} from "@/lib/task-engine/task-outcome";

// Sabitler (bkz. src/lib/constants.ts): THEME_TREND_DELTA_THRESHOLD = 0.1,
// TASK_MENTION_THRESHOLD = 3.

const MEASURED_AT = "2026-08-23T00:00:00.000Z";

function theme(overrides: Partial<AggregatedTheme> = {}): AggregatedTheme {
  return {
    theme: "Hijyen",
    positive_mentions: 0,
    negative_mentions: 0,
    treatment: null,
    severity: "normal",
    ...overrides,
  };
}

// bkz. docs/09-task-engine.md "Görev sonuç takibi" — `own_theme_count`
// varsayılanı 1 (own analiz bu döngü normal çalıştı); absent-kısayolu
// testleri bunu bilinçli olarak 0'a çekip null davranışını doğrular.
function themeMetric(overrides: Partial<Extract<OutcomeMetric, { kind: "theme" }>> = {}): OutcomeMetric {
  return {
    kind: "theme",
    theme: "Hijyen",
    positive: 0,
    negative: 0,
    negative_ratio: 0,
    positive_ratio: 0,
    absent: false,
    source_type: "absolute_quality",
    own_theme_count: 1,
    measured_at: MEASURED_AT,
    window_days: 90,
    ...overrides,
  };
}

describe("buildOutcomeMetric", () => {
  it("competitive_gap/absolute_quality görevi için eşleşen own temayı theme metric'e çevirir", () => {
    const metric = buildOutcomeMetric(
      { theme: "Hijyen", source_type: "competitive_gap" },
      {
        ownAggregated: [theme({ theme: "hijyen", positive_mentions: 6, negative_mentions: 4 })],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({
      kind: "theme",
      theme: "Hijyen",
      positive: 6,
      negative: 4,
      negative_ratio: 0.4,
      positive_ratio: 0.6,
      absent: false,
      source_type: "competitive_gap",
      own_theme_count: 1,
      measured_at: MEASURED_AT,
      window_days: 90,
    });
  });

  it("eşleşme yoksa absent=true ve sıfırlar döner", () => {
    const metric = buildOutcomeMetric(
      { theme: "Bekleme süresi", source_type: "absolute_quality" },
      {
        ownAggregated: [theme({ theme: "hijyen" })],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({
      kind: "theme",
      theme: "Bekleme süresi",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      positive_ratio: 0,
      absent: true,
      source_type: "absolute_quality",
      own_theme_count: 1,
      measured_at: MEASURED_AT,
      window_days: 90,
    });
  });

  it("own Aşama 1 bu döngü hiç tema üretmediyse own_theme_count 0 kalır (absent VE 'ölçemedik' sinyali)", () => {
    const metric = buildOutcomeMetric(
      { theme: "Bekleme süresi", source_type: "absolute_quality" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toMatchObject({ absent: true, own_theme_count: 0 });
  });

  // bkz. docs/09-task-engine.md + theme-similarity.ts — tam eşleşme kaçarsa
  // (model temayı morfolojik olarak farklı adlandırmışsa) fuzzy güvenlik ağı
  // devreye girer; sahte "absent" (ve dolayısıyla sahte "improved" verdict'i,
  // bkz. aşağıdaki compareOutcome testi) üretilmemeli.
  it("tam eşleşme kaçarsa ama morfolojik varyant varsa (fuzzy güvenlik ağı) onu bulur, absent=false", () => {
    const metric = buildOutcomeMetric(
      { theme: "Randevu sürecinde", source_type: "competitive_gap" },
      {
        ownAggregated: [theme({ theme: "Randevu süreci", positive_mentions: 2, negative_mentions: 6 })],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({
      kind: "theme",
      theme: "Randevu sürecinde",
      positive: 2,
      negative: 6,
      negative_ratio: 0.75,
      positive_ratio: 0.25,
      absent: false,
      source_type: "competitive_gap",
      own_theme_count: 1,
      measured_at: MEASURED_AT,
      window_days: 90,
    });
  });

  it("gerçek pilot rephrasing'i (tam token rephrase) fuzzy güvenlik ağını da geçemez, absent=true kalır — bu Part A'nın (known-theme vocabulary) işi", () => {
    const metric = buildOutcomeMetric(
      { theme: "Sahte online yorum iddiası", source_type: "absolute_quality" },
      {
        ownAggregated: [
          theme({ theme: "Sahte yorum ve itibar manipülasyonu şüphesi", positive_mentions: 0, negative_mentions: 4 }),
        ],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toMatchObject({ absent: true, positive: 0, negative: 0 });
  });

  it("toplam mention 0 iken negative_ratio/positive_ratio 0 kalır (bölme hatası yok)", () => {
    const metric = buildOutcomeMetric(
      { theme: "Hijyen", source_type: "competitive_gap" },
      {
        ownAggregated: [theme({ theme: "hijyen", positive_mentions: 0, negative_mentions: 0 })],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toMatchObject({ negative_ratio: 0, positive_ratio: 0, absent: false });
  });

  it("theme null ise (competitive_gap/absolute_quality) null döner", () => {
    const metric = buildOutcomeMetric(
      { theme: null, source_type: "competitive_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toBeNull();
  });

  it("profile:reply_rate teması için reply_rate metric üretir", () => {
    const metric = buildOutcomeMetric(
      { theme: "profile:reply_rate", source_type: "profile_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 10, replied: 4 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({
      kind: "reply_rate",
      total: 10,
      replied: 4,
      rate: 0.4,
      measured_at: MEASURED_AT,
      window_days: 90,
    });
  });

  it("total 0 iken reply rate 0 kalır", () => {
    const metric = buildOutcomeMetric(
      { theme: "profile:reply_rate", source_type: "profile_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toMatchObject({ rate: 0 });
  });

  it("profile:website teması için website metric üretir (site var)", () => {
    const metric = buildOutcomeMetric(
      { theme: "profile:website", source_type: "profile_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: "https://example.com",
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({ kind: "website", has_website: true, measured_at: MEASURED_AT });
  });

  it("profile:website teması için website metric üretir (site yok/boşluk)", () => {
    const metric = buildOutcomeMetric(
      { theme: "profile:website", source_type: "profile_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: "   ",
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toEqual({ kind: "website", has_website: false, measured_at: MEASURED_AT });
  });

  it("bilinmeyen source_type/theme kombinasyonu için null döner", () => {
    const metric = buildOutcomeMetric(
      { theme: null, source_type: "profile_gap" },
      {
        ownAggregated: [],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(metric).toBeNull();
  });
});

describe("compareOutcome — kind/temel davranış", () => {
  it("baseline veya latest yoksa null döner", () => {
    const metric = themeMetric({ positive: 1, negative: 1, negative_ratio: 0.5, positive_ratio: 0.5 });
    expect(compareOutcome(null, metric)).toBeNull();
    expect(compareOutcome(metric, null)).toBeNull();
  });

  it("kind uyuşmazlığında null döner", () => {
    const baseline: OutcomeMetric = { kind: "website", has_website: false, measured_at: MEASURED_AT };
    const latest: OutcomeMetric = {
      kind: "reply_rate",
      total: 1,
      replied: 1,
      rate: 1,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    expect(compareOutcome(baseline, latest)).toBeNull();
  });
});

// absolute_quality — Faz 2.6-2.8'deki ratio-tabanlı semantik DEĞİŞMEDİ. Tek
// fark: eski "tema tamamen kayboldu ⇒ improved" kısayolu artık
// `own_theme_count > 0` şartına bağlı (bkz. docs/09-task-engine.md).
describe("compareOutcome — theme (absolute_quality)", () => {
  it("negatif oran ≥10 yüzde puanı düşerse improved", () => {
    const baseline = themeMetric({ positive: 5, negative: 5, negative_ratio: 0.5, positive_ratio: 0.5 });
    const latest = themeMetric({ positive: 8, negative: 2, negative_ratio: 0.2, positive_ratio: 0.8 });
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("tema artık hiç geçmiyor, own_theme_count > 0 (own analiz bu döngü ölçüm yaptı) ve baseline eşik üstündeyse improved", () => {
    const baseline = themeMetric({ positive: 1, negative: 4, negative_ratio: 0.8, positive_ratio: 0.2 });
    const latest = themeMetric({
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      positive_ratio: 0,
      absent: true,
      own_theme_count: 3,
    });
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  // bkz. docs/09-task-engine.md — gerçek pilot false-positive'i: "Sahte online
  // yorum iddiası" (cycle 1, baseline negative_ratio 1.0, negative=3) cycle
  // 2/3'te Aşama 1 aynı konuyu farklı etiketledi VE (bu senaryoda) own analiz
  // o döngü hiçbir tema üretmedi (own_theme_count=0) — eski kod bunu "tema
  // tamamen kayboldu ⇒ improved" sayardı, ürün gerçekleşmemiş bir kazanım
  // iddia ederdi. own_theme_count=0 iken absence GÜVENİLİR bir sinyal değildir
  // ("ölçemedik" demektir) — verdict null olmalı, satır UI'da gizlenir.
  it("own_theme_count 0 iken (own Aşama 1 bu döngü hiçbir şey üretmedi) absent → 'improved' DEĞİL, null döner", () => {
    const baseline = themeMetric({
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 3,
      negative_ratio: 1,
      positive_ratio: 0,
    });
    const latest = themeMetric({
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      positive_ratio: 0,
      absent: true,
      own_theme_count: 0,
    });
    expect(compareOutcome(baseline, latest)).toBeNull();
  });

  it("aynı senaryoda own_theme_count > 0 ise (own analiz ölçüm yaptı, sadece bu tema kayboldu) improved döner", () => {
    const baseline = themeMetric({
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 3,
      negative_ratio: 1,
      positive_ratio: 0,
    });
    const latest = themeMetric({
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      positive_ratio: 0,
      absent: true,
      own_theme_count: 5,
    });
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("eşik altı negatif mention'la kaybolma improved SAYILMAZ, flat kalır (own_theme_count > 0 olsa bile)", () => {
    const baseline = themeMetric({ positive: 99, negative: 1, negative_ratio: 0.01, positive_ratio: 0.99 });
    const latest = themeMetric({
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      positive_ratio: 0,
      absent: true,
      own_theme_count: 10,
    });
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  // Yeniden adlandırılan bir tema, benzerlik ağı yakaladığı sürece "absent"
  // kısayolu üzerinden sahte bir "improved" verdict'i üretmemeli. Uçtan
  // uca: buildOutcomeMetric fuzzy güvenlik ağıyla morfolojik varyantı bulur
  // (absent=false), compareOutcome bu yüzden "yok oldu" kısayolunu (yukarıdaki
  // testler) DEĞİL, gerçek negative_ratio kıyasını kullanır.
  it("tema morfolojik olarak yeniden adlandırılsa da (fuzzy eşleşme) negatif oran değişmediyse flat kalır — sahte 'improved' ÜRETİLMEZ", () => {
    const baseline = themeMetric({
      theme: "Randevu süreci",
      positive: 2,
      negative: 6,
      negative_ratio: 0.75,
      positive_ratio: 0.25,
      measured_at: "2026-08-01T00:00:00.000Z",
    });
    // Aynı döngüdeki gerçek mention dağılımı DEĞİŞMEDİ, sadece AI bu döngüde
    // temayı "Randevu sürecinde" olarak etiketledi.
    const latest = buildOutcomeMetric(
      { theme: "Randevu süreci", source_type: "absolute_quality" },
      {
        ownAggregated: [theme({ theme: "Randevu sürecinde", positive_mentions: 2, negative_mentions: 6 })],
        ownReply: { total: 0, replied: 0 },
        ownWebsite: null,
        measuredAt: MEASURED_AT,
        windowDays: 90,
      },
    );

    expect(latest).toMatchObject({ absent: false, negative_ratio: 0.75 });
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  it("negatif oran ≥10 yüzde puanı artarsa worsened", () => {
    const baseline = themeMetric({ positive: 8, negative: 2, negative_ratio: 0.2, positive_ratio: 0.8 });
    const latest = themeMetric({ positive: 5, negative: 5, negative_ratio: 0.5, positive_ratio: 0.5 });
    expect(compareOutcome(baseline, latest)).toBe("worsened");
  });

  it("eşik altı değişim flat kalır", () => {
    const baseline = themeMetric({ positive: 5, negative: 5, negative_ratio: 0.5, positive_ratio: 0.5 });
    const latest = themeMetric({ positive: 6, negative: 5, negative_ratio: 0.45, positive_ratio: 0.55 });
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });
});

// competitive_gap — Faz 2.9: bu görev tipi TANIM GEREĞİ own tarafında zaten
// "absent"/sessiz başlar (rakip güçlü, klinik bu konuda hiç konuşulmuyor);
// negatif oranı takip etmek anlamsızdır (baseline 0% → latest 0%, hep
// "flat"). Gerçek sinyal own OLUMLU mention'ların başlaması/artmasıdır — bkz.
// docs/09-task-engine.md.
describe("compareOutcome — theme (competitive_gap)", () => {
  it("own hiç olumlu mention almamışken eşiği geçip yeterince artarsa improved", () => {
    const baseline = themeMetric({
      source_type: "competitive_gap",
      positive: 0,
      negative: 0,
      absent: true,
      own_theme_count: 0,
    });
    const latest = themeMetric({
      source_type: "competitive_gap",
      positive: 4,
      negative: 1,
      absent: false,
      own_theme_count: 6,
    });
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("own olumlu mention'ları eşik kadar (veya fazla) düşerse worsened", () => {
    const baseline = themeMetric({ source_type: "competitive_gap", positive: 5, own_theme_count: 6 });
    const latest = themeMetric({ source_type: "competitive_gap", positive: 1, own_theme_count: 6 });
    expect(compareOutcome(baseline, latest)).toBe("worsened");
  });

  it("latest eşiği (3) geçse de baseline'a göre delta eşiğin altındaysa flat kalır", () => {
    const baseline = themeMetric({ source_type: "competitive_gap", positive: 2 });
    const latest = themeMetric({ source_type: "competitive_gap", positive: 4 });
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  it("küçük dalgalanma flat kalır", () => {
    const baseline = themeMetric({ source_type: "competitive_gap", positive: 1 });
    const latest = themeMetric({ source_type: "competitive_gap", positive: 2 });
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  it("own her iki döngüde de hiç mention almadıysa (absent/zero) null döner — anlamsız '%0 → %0' satırı gösterilmez", () => {
    const baseline = themeMetric({
      source_type: "competitive_gap",
      positive: 0,
      negative: 0,
      absent: true,
      own_theme_count: 0,
    });
    const latest = themeMetric({
      source_type: "competitive_gap",
      positive: 0,
      negative: 0,
      absent: true,
      own_theme_count: 4,
    });
    expect(compareOutcome(baseline, latest)).toBeNull();
  });
});

describe("compareOutcome — reply_rate/website", () => {
  it("reply_rate: oran ≥10 puan yükselirse improved", () => {
    const baseline: OutcomeMetric = {
      kind: "reply_rate",
      total: 10,
      replied: 2,
      rate: 0.2,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, replied: 5, total: 10, rate: 0.5 };
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("reply_rate: oran ≥10 puan düşerse worsened", () => {
    const baseline: OutcomeMetric = {
      kind: "reply_rate",
      total: 10,
      replied: 8,
      rate: 0.8,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, replied: 3, rate: 0.3 };
    expect(compareOutcome(baseline, latest)).toBe("worsened");
  });

  it("reply_rate: küçük değişim flat kalır", () => {
    const baseline: OutcomeMetric = {
      kind: "reply_rate",
      total: 10,
      replied: 5,
      rate: 0.5,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, replied: 6, rate: 0.55 };
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  it("website: baseline yok latest var ise improved", () => {
    const baseline: OutcomeMetric = { kind: "website", has_website: false, measured_at: MEASURED_AT };
    const latest: OutcomeMetric = { kind: "website", has_website: true, measured_at: MEASURED_AT };
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("website: ikisi de aynıysa flat", () => {
    const baseline: OutcomeMetric = { kind: "website", has_website: true, measured_at: MEASURED_AT };
    const latest: OutcomeMetric = { kind: "website", has_website: true, measured_at: MEASURED_AT };
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });
});

describe("parseOutcomeMetric", () => {
  it("geçerli theme JSON'unu (yeni format, tüm alanlar dolu) parse eder", () => {
    const json = {
      kind: "theme",
      theme: "Hijyen",
      positive: 1,
      negative: 2,
      negative_ratio: 0.66,
      positive_ratio: 0.33,
      absent: false,
      source_type: "absolute_quality",
      own_theme_count: 4,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    expect(parseOutcomeMetric(json)).toEqual(json);
  });

  it("null/undefined için null döner", () => {
    expect(parseOutcomeMetric(null)).toBeNull();
    expect(parseOutcomeMetric(undefined)).toBeNull();
  });

  it("şemaya uymayan veri için null döner (yarım/yanlış veri asla sızmaz)", () => {
    expect(parseOutcomeMetric({ kind: "theme", theme: "Hijyen" })).toBeNull();
    expect(parseOutcomeMetric("not-an-object")).toBeNull();
    expect(parseOutcomeMetric({ kind: "unknown" })).toBeNull();
  });

  // bkz. docs/09-task-engine.md, docs/10-roadmap.md Faz 2.9 — Faz 2.6-2.8'de
  // yazılmış eski satırlarda positive_ratio/source_type/own_theme_count YOK;
  // local DB'de gerçekten bu formatta 12 görev var, bunlar asla crash etmemeli.
  describe("eski format (positive_ratio/source_type/own_theme_count yok)", () => {
    const oldBaselineJson = {
      kind: "theme",
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 3,
      negative_ratio: 1,
      absent: false,
      measured_at: "2026-08-01T00:00:00.000Z",
      window_days: 90,
    };
    const oldLatestJson = {
      kind: "theme",
      theme: "Sahte online yorum iddiası",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      absent: true,
      measured_at: MEASURED_AT,
      window_days: 90,
    };

    it("eksik alanlar güvenli varsayılanlarla doldurulur — source_type: absolute_quality, own_theme_count: 0", () => {
      const parsed = parseOutcomeMetric(oldLatestJson);
      expect(parsed).toEqual({
        ...oldLatestJson,
        positive_ratio: 0,
        source_type: "absolute_quality",
        own_theme_count: 0,
      });
    });

    // Pilot bug'ının tam regresyon testi: eski (Faz 2.8 öncesi) JSON şekliyle
    // yazılmış gerçek satırlar bu düzeltmeden SONRA da parse edilebilmeli VE
    // artık sahte "improved" üretmemeli (own_theme_count bilinmiyor → 0 →
    // "ölçemedik" → null, bkz. yukarıdaki compareOutcome testleri).
    it("gerçek pilot bug'ının regresyon testi: eski formatlı satırlar artık sahte 'improved' üretmez", () => {
      const baseline = parseOutcomeMetric(oldBaselineJson);
      const latest = parseOutcomeMetric(oldLatestJson);
      expect(compareOutcome(baseline, latest)).toBeNull();
    });
  });
});
