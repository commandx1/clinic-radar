import { describe, expect, it } from "vitest";

import { buildProfileGapCandidates, type ProfileGapStats } from "@/lib/analysis/profile-gap-candidates";

// Sabitler (bkz. src/lib/constants.ts): PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE = 0.5,
// PROFILE_GAP_REPLY_RATE_MIN_GAP = 0.2, PROFILE_GAP_MIN_OWN_UNREPLIED = 3,
// PROFILE_GAP_WEBSITE_MIN_COMPETITOR_SHARE = 0.5. Impact score ağırlıkları
// (competitor_prevalence 0.5, own_deficiency 0.4) computeCompetitiveGapImpactScore'dan
// (bkz. impact-score.test.ts) reuse edilir.

function makeStats(overrides: Partial<ProfileGapStats> = {}): ProfileGapStats {
  return {
    own: { total: 0, replied: 0, website: null },
    competitors: [],
    windowDays: 90,
    ...overrides,
  };
}

describe("buildProfileGapCandidates — reply_rate kuralı", () => {
  it("rakip ortalaması yüksek, own düşük ve yeterli yanıtsız yorum varsa aday üretir", () => {
    const stats = makeStats({
      own: { total: 10, replied: 2, website: "own.com" },
      competitors: [
        { id: "c1", name: "C1", total: 10, replied: 8, website: null },
        { id: "c2", name: "C2", total: 5, replied: 3, website: null },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    const replyTask = candidates.find((c) => c.theme === "profile:reply_rate");

    expect(replyTask).toBeDefined();
    expect(replyTask?.source_type).toBe("profile_gap");
    expect(replyTask?.effort_score).toBe(1);
    // en yüksek yanıt oranına sahip rakip (c1: 8/10=0.8 > c2: 3/5=0.6) seçilir.
    expect(replyTask?.based_on_competitor_id).toBe("c1");
    // prevalence = rakip ortalama oranı (70) = ratio(70,100)*100; deficiency = own eksikliği
    // own rate=0.2 → deficiency=(1-0.2)*100=80. score = 70*0.5 + 80*0.4 = 67.
    expect(replyTask?.impact_score_breakdown.competitor_prevalence).toBe(70);
    expect(replyTask?.impact_score_breakdown.own_deficiency).toBe(80);
    expect(replyTask?.impact_score).toBe(67);
    expect(replyTask?.checklist).toHaveLength(3);
    expect(replyTask?.title.tr).toContain("8");
  });

  it("eşit yanıt oranında en çok yoruma sahip rakip seçilir", () => {
    const stats = makeStats({
      own: { total: 10, replied: 2, website: "own.com" },
      competitors: [
        { id: "c1", name: "C1", total: 10, replied: 6, website: null },
        { id: "c2", name: "C2", total: 20, replied: 12, website: null },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    const replyTask = candidates.find((c) => c.theme === "profile:reply_rate");

    expect(replyTask?.based_on_competitor_id).toBe("c2");
  });

  it("own yanıtsız yorum sayısı eşiğin altındaysa aday üretilmez", () => {
    const stats = makeStats({
      own: { total: 3, replied: 1, website: "own.com" }, // unreplied = 2 < 3
      competitors: [{ id: "c1", name: "C1", total: 10, replied: 9, website: null }],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:reply_rate")).toBeUndefined();
  });

  it("own/rakip arasındaki fark eşiğin altındaysa aday üretilmez", () => {
    const stats = makeStats({
      own: { total: 10, replied: 6, website: "own.com" }, // ownRate = 0.6, unreplied = 4
      competitors: [{ id: "c1", name: "C1", total: 10, replied: 7, website: null }], // rate = 0.7, gap = 0.1
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:reply_rate")).toBeUndefined();
  });

  it("rakip ortalama yanıt oranı eşiğin altındaysa aday üretilmez (herkes kötüyse fırsat yok)", () => {
    const stats = makeStats({
      own: { total: 10, replied: 1, website: "own.com" }, // unreplied = 9, ownRate = 0.1
      competitors: [{ id: "c1", name: "C1", total: 10, replied: 4, website: null }], // rate = 0.4 < 0.5
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:reply_rate")).toBeUndefined();
  });

  it("hiçbir rakibin yorumu yoksa aday üretilmez", () => {
    const stats = makeStats({
      own: { total: 10, replied: 1, website: "own.com" },
      competitors: [{ id: "c1", name: "C1", total: 0, replied: 0, website: null }],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:reply_rate")).toBeUndefined();
  });
});

describe("buildProfileGapCandidates — website kuralı", () => {
  it("own website yok ve rakiplerin yarısında (veya fazlasında) varsa aday üretir", () => {
    const stats = makeStats({
      own: { total: 0, replied: 0, website: null },
      competitors: [
        { id: "c1", name: "C1", total: 0, replied: 0, website: "a.com" },
        { id: "c2", name: "C2", total: 0, replied: 0, website: "b.com" },
        { id: "c3", name: "C3", total: 0, replied: 0, website: null },
        { id: "c4", name: "C4", total: 0, replied: 0, website: null },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    const websiteTask = candidates.find((c) => c.theme === "profile:website");

    expect(websiteTask).toBeDefined();
    expect(websiteTask?.source_type).toBe("profile_gap");
    expect(websiteTask?.based_on_competitor_id).toBeNull();
    expect(websiteTask?.effort_score).toBe(2);
    // share = 2/4 = 0.5 → prevalence 50; own undefined → deficiency 100.
    // score = 50*0.5 + 100*0.4 = 65.
    expect(websiteTask?.impact_score_breakdown.competitor_prevalence).toBe(50);
    expect(websiteTask?.impact_score_breakdown.own_deficiency).toBe(100);
    expect(websiteTask?.impact_score).toBe(65);
    expect(websiteTask?.checklist).toHaveLength(3);
  });

  it("own website boş string ise de eksik kabul edilir", () => {
    const stats = makeStats({
      own: { total: 0, replied: 0, website: "" },
      competitors: [
        { id: "c1", name: "C1", total: 0, replied: 0, website: "a.com" },
        { id: "c2", name: "C2", total: 0, replied: 0, website: "b.com" },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:website")).toBeDefined();
  });

  it("own zaten website'a sahipse aday üretilmez", () => {
    const stats = makeStats({
      own: { total: 0, replied: 0, website: "own.com" },
      competitors: [
        { id: "c1", name: "C1", total: 0, replied: 0, website: "a.com" },
        { id: "c2", name: "C2", total: 0, replied: 0, website: "b.com" },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:website")).toBeUndefined();
  });

  it("rakiplerin website oranı eşiğin altındaysa aday üretilmez", () => {
    const stats = makeStats({
      own: { total: 0, replied: 0, website: null },
      competitors: [
        { id: "c1", name: "C1", total: 0, replied: 0, website: "a.com" },
        { id: "c2", name: "C2", total: 0, replied: 0, website: null },
        { id: "c3", name: "C3", total: 0, replied: 0, website: null },
        { id: "c4", name: "C4", total: 0, replied: 0, website: null },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:website")).toBeUndefined();
  });

  it("hiç rakip yoksa aday üretilmez", () => {
    const stats = makeStats({ own: { total: 0, replied: 0, website: null }, competitors: [] });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:website")).toBeUndefined();
  });
});

describe("buildProfileGapCandidates — veri yetersizse boş dizi", () => {
  it("her iki kural da uygun değilse boş dizi döner", () => {
    const stats = makeStats({
      own: { total: 10, replied: 9, website: "own.com" },
      competitors: [{ id: "c1", name: "C1", total: 10, replied: 9, website: "a.com" }],
    });

    expect(buildProfileGapCandidates(stats)).toEqual([]);
  });

  it("hiç own/rakip verisi yoksa boş dizi döner", () => {
    expect(buildProfileGapCandidates(makeStats())).toEqual([]);
  });
});
