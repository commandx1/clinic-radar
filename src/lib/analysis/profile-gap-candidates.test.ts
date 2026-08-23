import { describe, expect, it } from "vitest";

import { buildProfileGapCandidates, type ProfileGapStats } from "@/lib/analysis/profile-gap-candidates";

// Sabitler (bkz. src/lib/constants.ts): PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE = 0.5,
// PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_REVIEWS = 10 (referans rakip olabilmek
// için hacim eşiği — bkz. FIX 1, gerçek veriyle kalibre edildi),
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
    // c1'in kendisi de hacim eşiğini (total=10 >= MIN_COMPETITOR_REVIEWS) geçtiği
    // için referans oran artık rakip ORTALAMASI değil, doğrudan c1'in kendi oranı
    // (0.8) — bkz. FIX 1.
    expect(replyTask?.based_on_competitor_id).toBe("c1");
    // prevalence = referans rakibin oranı (c1: %80); deficiency = own eksikliği
    // own rate=0.2 → deficiency=(1-0.2)*100=80. score = 80*0.5 + 80*0.4 = 72.
    expect(replyTask?.impact_score_breakdown.competitor_prevalence).toBe(80);
    expect(replyTask?.impact_score_breakdown.own_deficiency).toBe(80);
    expect(replyTask?.impact_score).toBe(72);
    expect(replyTask?.checklist).toHaveLength(3);
    expect(replyTask?.title.tr).toContain("8");
  });

  it("gerçek veri şekli: 3 rakipten biri (169 yorum) %100 yanıtlıyor, diğer ikisi %0 — ortalama " +
    "(%33) eşiğin altında kalsa bile hacim eşiğini geçen referans rakip TEK BAŞINA görev üretir", () => {
    const stats = makeStats({
      own: { total: 8, replied: 0, website: "own.com" },
      windowDays: 365,
      competitors: [
        {
          id: "c-strong",
          name: "Mersin Ortodonti Uzmanı Yrd Doç Hatice Akıncı Cansunar (invisaling, diş teli, şeffaf plak)",
          total: 169,
          replied: 169,
          website: null,
        },
        { id: "c-silent-1", name: "Silent Competitor 1", total: 143, replied: 0, website: null },
        { id: "c-silent-2", name: "Silent Competitor 2", total: 25, replied: 0, website: null },
      ],
    });

    // Ortalama = (1.0 + 0 + 0) / 3 = %33.3 — eski kuralda eşiğin (%50) altında
    // kalıp görev ÜRETİLMEZDİ. Yeni kuralda hacim eşiğini (>=10) geçen 3 rakip
    // arasından en yüksek orana sahip olan (c-strong, %100) referans alınır ve
    // tek başına eşiği geçtiği için görev üretilir.
    const candidates = buildProfileGapCandidates(stats);
    const replyTask = candidates.find((c) => c.theme === "profile:reply_rate");

    expect(replyTask).toBeDefined();
    expect(replyTask?.based_on_competitor_id).toBe("c-strong");
    expect(replyTask?.description.tr).toContain("Mersin Ortodonti Uzmanı");
    expect(replyTask?.description.tr).toContain("169");
    expect(replyTask?.description.tr).toContain("%100");
    expect(replyTask?.description.tr).toContain("%0");
    expect(replyTask?.description.tr).toContain("8 yorumun");
    expect(replyTask?.impact_score_breakdown.competitor_prevalence).toBe(100);
    expect(replyTask?.impact_score_breakdown.own_deficiency).toBe(100);
  });

  it("az yorumlu ama yüksek oranlı bir rakip (3/3 = %100) tek başına referans olamaz", () => {
    const stats = makeStats({
      own: { total: 10, replied: 1, website: "own.com" }, // unreplied = 9
      competitors: [
        // Hacim eşiğinin (10) altında, oranı yüksek ama gürültü sayılır.
        { id: "c-small", name: "Small", total: 3, replied: 3, website: null },
        // Hacim eşiğini geçen rakiplerin oranları düşük — referans bunlardan
        // seçilir (en yükseği), ortalamayı c-small yukarı çekse de eşiği
        // (mean 0.4 < 0.5) geçmiyor.
        { id: "c-big-1", name: "Big 1", total: 15, replied: 2, website: null },
        { id: "c-big-2", name: "Big 2", total: 15, replied: 1, website: null },
      ],
    });

    const candidates = buildProfileGapCandidates(stats);
    expect(candidates.find((c) => c.theme === "profile:reply_rate")).toBeUndefined();
  });

  it("hiçbir rakip hacim eşiğini geçmese de rakip ortalaması eşiği geçerse eski davranışla aday üretir", () => {
    const stats = makeStats({
      own: { total: 10, replied: 2, website: "own.com" }, // unreplied = 8
      competitors: [
        { id: "c1", name: "C1", total: 5, replied: 4, website: null }, // 0.8, hacim eşiğinin altında
        { id: "c2", name: "C2", total: 3, replied: 1, website: null }, // 0.333, hacim eşiğinin altında
      ],
    });

    // Ortalama = (0.8 + 0.333) / 2 = %56.7 >= %50 → mean-based yol tetiklenir
    // (hiçbir rakip hacim eşiğini geçmediği için referans oran = ortalama,
    // based_on = en yüksek orana sahip rakip — eski davranışla birebir aynı).
    const candidates = buildProfileGapCandidates(stats);
    const replyTask = candidates.find((c) => c.theme === "profile:reply_rate");

    expect(replyTask).toBeDefined();
    expect(replyTask?.based_on_competitor_id).toBe("c1");
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
