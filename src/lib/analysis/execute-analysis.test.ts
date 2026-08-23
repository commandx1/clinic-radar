import { describe, expect, it, vi } from "vitest";

import { buildOwnerMap, buildThemeVocabulary, upsertTasks } from "@/lib/analysis/execute-analysis";
import type { ScoredTaskCandidate } from "@/lib/analysis/task-candidates";
import { STAGE1_KNOWN_THEME_VOCABULARY_LIMIT } from "@/lib/constants";
import type { BuildOutcomeMetricContext } from "@/lib/task-engine/task-outcome";

describe("buildOwnerMap", () => {
  it("google_place_id'lerden google: önekli anahtarlar üretir", () => {
    const map = buildOwnerMap({ id: "biz-1", google_place_id: "place-own" }, [
      { id: "comp-1", google_place_id: "place-comp" },
    ]);

    expect(map.get("google:place-own")).toEqual({ owner_type: "own", business_id: "biz-1" });
    expect(map.get("google:place-comp")).toEqual({ owner_type: "competitor", business_id: "comp-1" });
    expect(map.size).toBe(2);
  });

  // Anahtar formatı `${source}:${source_ref}` — groupRefsBySource ilk ":" ile
  // bölerek kaynağı geri çıkarır, mapToReviewRows aynı formatla owner arar.
  // Yeni bir kaynak (ör. trustpilot) eklendiğinde buraya `trustpilot:${domain}`
  // anahtarları da yazılacak; önek kaldırılırsa o iş sessizce bozulur.
  it("rakipsiz işletmede yalnızca kendi google anahtarını üretir", () => {
    const map = buildOwnerMap({ id: "biz-1", google_place_id: "place-own" }, []);

    expect([...map.keys()]).toEqual(["google:place-own"]);
  });

  it("trustpilot_domain doluysa trustpilot: önekli anahtarlar da üretir", () => {
    const map = buildOwnerMap(
      { id: "biz-1", google_place_id: "place-own", trustpilot_domain: "own.clinic" },
      [{ id: "comp-1", google_place_id: "place-comp", trustpilot_domain: "comp.clinic" }],
    );

    expect(map.get("trustpilot:own.clinic")).toEqual({ owner_type: "own", business_id: "biz-1" });
    expect(map.get("trustpilot:comp.clinic")).toEqual({ owner_type: "competitor", business_id: "comp-1" });
    expect(map.size).toBe(4);
  });

  it("trustpilot_domain null ise trustpilot anahtarı eklenmez", () => {
    const map = buildOwnerMap({ id: "biz-1", google_place_id: "place-own", trustpilot_domain: null }, [
      { id: "comp-1", google_place_id: "place-comp", trustpilot_domain: null },
    ]);

    expect([...map.keys()]).toEqual(["google:place-own", "google:place-comp"]);
  });
});

// Faz 2.8 "tema etiketi kayması" düzeltmesi — upsertTasks'ın exact
// (theme, source_type, status='open') dedup'u kaçtığında theme-similarity.ts
// güvenlik ağının araya girip YENİ bir görev yerine mevcut görevi güncellediğini
// doğrular (bkz. docs/02-business-rules.md Bölüm D).
//
// Basit, sıralı bir "thenable" query builder — supabase-js'in gerçek
// PostgrestFilterBuilder'ı gibi her filtre metodu (select/eq/update/insert)
// zincirin kendisini döner ve zincir `await` edildiğinde önceden tanımlı bir
// sonuca çözülür (bkz. resolve-trustpilot-refs.test.ts'teki daha basit tek
// tablo mock'u — burada birden fazla farklı sorgu şekli aynı "tasks" tablosuna
// SIRAYLA gittiği için `from` her çağrıda ayrı bir builder döner).
function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn((_columns?: string) => builder),
    eq: vi.fn((_column: string, _value: unknown) => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn((_payload: Record<string, unknown>) => builder),
    insert: vi.fn((_payload: Record<string, unknown>) => Promise.resolve(result)),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve(result);
    },
  };
  return builder;
}

function baseCandidate(overrides: Partial<ScoredTaskCandidate> = {}): ScoredTaskCandidate {
  return {
    title: { tr: "Başlık", en: "Title" },
    description: { tr: "Açıklama", en: "Description" },
    source_type: "competitive_gap",
    based_on_competitor_id: null,
    theme: "Randevu sürecinde",
    effort_score: 2,
    checklist: [],
    impact_score: 70,
    impact_score_breakdown: { competitor_prevalence: 60, own_deficiency: 40, trend: null, trend_adjustment: 0 },
    ...overrides,
  };
}

const OUTCOME_CTX: BuildOutcomeMetricContext = {
  ownAggregated: [],
  ownReply: { total: 0, replied: 0 },
  ownWebsite: null,
  measuredAt: "2026-08-23T00:00:00.000Z",
  windowDays: 90,
};

describe("upsertTasks (fuzzy dedup güvenlik ağı)", () => {
  it("exact eşleşme kaçarsa ama aynı source_type'ta morfolojik olarak benzer bir açık görev varsa, YENİ görev eklemek yerine onu günceller", async () => {
    const exactMatchMiss = createQueryBuilder({ data: null, error: null });
    const openTasksList = createQueryBuilder({
      data: [{ id: "task-existing-1", theme: "Randevu süreci" }],
      error: null,
    });
    const updateResult = createQueryBuilder({ data: null, error: null });

    const fromMock = vi
      .fn()
      .mockReturnValueOnce(exactMatchMiss)
      .mockReturnValueOnce(openTasksList)
      .mockReturnValueOnce(updateResult);
    const supabase = { from: fromMock } as unknown as Parameters<typeof upsertTasks>[0];

    // "Randevu sürecinde" (bu döngü) vs mevcut açık görevin teması "Randevu
    // süreci" (önceki döngü) — theme-similarity.test.ts'te jaccard=1.0 olarak
    // doğrulanan morfolojik varyant çifti.
    const result = await upsertTasks(supabase, "biz-1", [baseCandidate()], OUTCOME_CTX);

    expect(result).toEqual({ created: 0, updated: 1 });
    // Mevcut görevin id'si kullanılır...
    expect(updateResult.eq).toHaveBeenCalledWith("id", "task-existing-1");
    // ...ve theme kolonu UPDATE payload'ında YOK (mevcut etiket korunur,
    // outcome_baseline'a dokunulmaz — o zaten update payload'ında hiç yok).
    const updatePayload = updateResult.update.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty("theme");
    expect(updatePayload).not.toHaveProperty("outcome_baseline");
    expect(updatePayload).toMatchObject({ impact_score: 70, effort_score: 2 });
  });

  it("gerçek bir tam rephrasing için (ortak token neredeyse yok) benzerlik ağı da eşleşme bulamaz, yeni görev insert edilir", async () => {
    const exactMatchMiss = createQueryBuilder({ data: null, error: null });
    // Aynı source_type'ta açık tek görev, gerçek pilot verisindeki cycle-1
    // etiketi — theme-similarity.test.ts'te jaccard ≈ 0.286 (eşiğin altında).
    const openTasksList = createQueryBuilder({
      data: [{ id: "task-existing-2", theme: "Sahte online yorum iddiası" }],
      error: null,
    });
    const insertResult = createQueryBuilder({ data: null, error: null });
    const notificationInsertResult = createQueryBuilder({ data: null, error: null });

    const fromMock = vi
      .fn()
      .mockReturnValueOnce(exactMatchMiss)
      .mockReturnValueOnce(openTasksList)
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(notificationInsertResult);
    const supabase = { from: fromMock } as unknown as Parameters<typeof upsertTasks>[0];

    const result = await upsertTasks(
      supabase,
      "biz-1",
      [baseCandidate({ theme: "Sahte yorum ve itibar manipülasyonu şüphesi", source_type: "absolute_quality" })],
      OUTCOME_CTX,
    );

    expect(result).toEqual({ created: 1, updated: 0 });
    expect(insertResult.insert).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "Sahte yorum ve itibar manipülasyonu şüphesi" }),
    );
    // Var olan (alakasız kabul edilen) görev HİÇ güncellenmedi.
    expect(openTasksList.update).not.toHaveBeenCalled();
  });
});

// bkz. docs/05-ai-pipeline.md "tema kanonikleştirme" — bir tema hâlâ AÇIK bir
// görevin etiketiyse, sadece mention sayısına göre sıralanan sözlük onu es
// geçip görevi bir sonraki döngüde sessizce "absent"a düşürebilir. `pinnedLabels`
// (fetchPreviousThemeData'nın açık görev temalarından geçirdiği liste) bu
// yüzden cap'ten bağımsız olarak HER ZAMAN sonuca dahil edilir.
describe("buildThemeVocabulary", () => {
  it("pinnedLabels boşsa eskisi gibi mention sayısına göre sıralı, cap'e kadar döner", () => {
    const result = buildThemeVocabulary([
      { theme: "az", total: 1 },
      { theme: "çok", total: 10 },
      { theme: "orta", total: 5 },
    ]);
    expect(result).toEqual(["çok", "orta", "az"]);
  });

  it("pinned bir etiket cap'i dolduracak kadar yüksek mention'lı satır olsa bile listeden düşmez (en düşük mention'lı satır feda edilir)", () => {
    // Cap'i (40) tek başına dolduracak kadar satır + mention toplamı bunların
    // hepsinden düşük (theme_summary'de bile karşılığı olmayabilecek) pinned
    // bir açık görev teması. Toplam uzunluk cap'te (40) kalır — pinned öne
    // alınır, kalan bütçeyi en yüksek mention'lı satırlar doldurur; en düşük
    // mention'lı satır (`tema-39`) cap'ten düşürülür, ama pinned ASLA düşmez.
    const rows = Array.from({ length: STAGE1_KNOWN_THEME_VOCABULARY_LIMIT }, (_, i) => ({
      theme: `tema-${i.toString()}`,
      total: 100 - i,
    }));
    const result = buildThemeVocabulary(rows, ["pinlenmiş-açık-görev-teması"]);
    expect(result).toContain("pinlenmiş-açık-görev-teması");
    expect(result.length).toBe(STAGE1_KNOWN_THEME_VOCABULARY_LIMIT);
    expect(result).not.toContain(`tema-${(STAGE1_KNOWN_THEME_VOCABULARY_LIMIT - 1).toString()}`);
  });

  it("pinned etiket zaten normal sıralamada varsa mükerrer eklenmez", () => {
    const result = buildThemeVocabulary(
      [
        { theme: "Bekleme süresi", total: 10 },
        { theme: "Hijyen", total: 5 },
      ],
      ["Bekleme süresi"],
    );
    expect(result).toEqual(["Bekleme süresi", "Hijyen"]);
  });

  it("pinned etiketler kendi aralarında tekilleştirilir (normalize edilmiş)", () => {
    const result = buildThemeVocabulary([], ["Hijyen", "  hijyen "]);
    expect(result).toEqual(["Hijyen"]);
  });
});
