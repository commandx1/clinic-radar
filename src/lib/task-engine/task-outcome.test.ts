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
      absent: false,
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
      absent: true,
      measured_at: MEASURED_AT,
      window_days: 90,
    });
  });

  // bkz. docs/09-task-engine.md "Görev sonuç takibi" + theme-similarity.ts —
  // tam eşleşme kaçarsa (model temayı morfolojik olarak farklı adlandırmışsa)
  // fuzzy güvenlik ağı devreye girer; sahte "absent" (ve dolayısıyla sahte
  // "improved" verdict'i, bkz. aşağıdaki compareOutcome testi) üretilmemeli.
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
      absent: false,
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

  it("toplam mention 0 iken negative_ratio 0 kalır (bölme hatası yok)", () => {
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

    expect(metric).toMatchObject({ negative_ratio: 0, absent: false });
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

describe("compareOutcome", () => {
  it("baseline veya latest yoksa null döner", () => {
    const metric: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 1,
      negative: 1,
      negative_ratio: 0.5,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
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

  it("theme: negatif oran ≥10 yüzde puanı düşerse improved", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 5,
      negative: 5,
      negative_ratio: 0.5,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, negative: 2, positive: 8, negative_ratio: 0.2 };
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("theme: tema artık hiç geçmiyor ve baseline eşik üstündeyse improved", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 1,
      negative: 4,
      negative_ratio: 0.8,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      absent: true,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    expect(compareOutcome(baseline, latest)).toBe("improved");
  });

  it("theme: eşik altı negatif mention'la kaybolma improved SAYILMAZ, flat kalır", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 99,
      negative: 1,
      negative_ratio: 0.01,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      absent: true,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

  // Yeniden adlandırılan bir tema, benzerlik ağı yakaladığı sürece "absent"
  // kısayolu üzerinden sahte bir "improved" verdict'i üretmemeli. Uçtan
  // uca: buildOutcomeMetric fuzzy güvenlik ağıyla morfolojik varyantı bulur
  // (absent=false), compareOutcome bu yüzden "yok oldu" kısayolunu (yukarıdaki
  // testler) DEĞİL, gerçek negative_ratio kıyasını kullanır.
  it("tema morfolojik olarak yeniden adlandırılsa da (fuzzy eşleşme) negatif oran değişmediyse flat kalır — sahte 'improved' ÜRETİLMEZ", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Randevu süreci",
      positive: 2,
      negative: 6,
      negative_ratio: 0.75,
      absent: false,
      measured_at: "2026-08-01T00:00:00.000Z",
      window_days: 90,
    };
    // Aynı döngüdeki gerçek mention dağılımı DEĞİŞMEDİ, sadece AI bu döngüde
    // temayı "Randevu sürecinde" olarak etiketledi.
    const latest = buildOutcomeMetric(
      { theme: "Randevu süreci", source_type: "competitive_gap" },
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

  it("theme: negatif oran ≥10 yüzde puanı artarsa worsened", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 8,
      negative: 2,
      negative_ratio: 0.2,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, positive: 5, negative: 5, negative_ratio: 0.5 };
    expect(compareOutcome(baseline, latest)).toBe("worsened");
  });

  it("theme: eşik altı değişim flat kalır", () => {
    const baseline: OutcomeMetric = {
      kind: "theme",
      theme: "Hijyen",
      positive: 5,
      negative: 5,
      negative_ratio: 0.5,
      absent: false,
      measured_at: MEASURED_AT,
      window_days: 90,
    };
    const latest: OutcomeMetric = { ...baseline, positive: 6, negative: 5, negative_ratio: 0.45 };
    expect(compareOutcome(baseline, latest)).toBe("flat");
  });

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
  it("geçerli theme JSON'unu parse eder", () => {
    const json = {
      kind: "theme",
      theme: "Hijyen",
      positive: 1,
      negative: 2,
      negative_ratio: 0.66,
      absent: false,
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
});
