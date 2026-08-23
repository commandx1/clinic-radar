import { describe, expect, it } from "vitest";

import {
  detectCompetitorAlerts,
  type CompetitorAlertCompetitorInput,
} from "@/lib/analysis/competitor-alerts";

function makeCompetitor(overrides: Partial<CompetitorAlertCompetitorInput> = {}): CompetitorAlertCompetitorInput {
  return {
    id: "comp-1",
    name: "A Kliniği",
    newReviewsThisCycle: 0,
    avgMonthlyReviews: 0,
    // Varsayılan: haftalık Pro döngüsü.
    cycleDays: 7,
    previousRecentRating: null,
    currentRecentRating: null,
    negativeThemeSpikes: [],
    ...overrides,
  };
}

describe("detectCompetitorAlerts — competitor_review_surge", () => {
  it("min yorum eşiğinin altındaysa (avg 0 olsa da) tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 4, avgMonthlyReviews: 0 })],
    });
    expect(alerts).toEqual([]);
  });

  it("min yorum eşiğini geçse de döngüye ölçeklenmiş çarpanı geçmiyorsa tetiklenmez", () => {
    // 30 günlük döngü, aylık 4 → beklenen 4, eşik 8; 6 yetmez.
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 6, avgMonthlyReviews: 4, cycleDays: 30 })],
    });
    expect(alerts).toEqual([]);
  });

  it("hem min hem çarpan koşulunu geçince tetiklenir", () => {
    // 7 günlük döngü, aylık 4 → beklenen ~0.93, eşik ~1.87; 10 geçer.
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 10, avgMonthlyReviews: 4 })],
    });
    expect(alerts).toEqual([
      {
        type: "competitor_review_surge",
        competitor_id: "comp-1",
        competitor_name: "A Kliniği",
        detail: { new_reviews: 10, avg_monthly_reviews: 4, cycle_days: 7 },
      },
    ]);
  });

  it("ilk analizde (cycleDays null) pencerenin tamamı 'yeni' olsa da tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 40, avgMonthlyReviews: 13, cycleDays: null })],
    });
    expect(alerts).toEqual([]);
  });

  it("uzun aralıklı analizde (60 gün) olağan hacim sahte patlama üretmez", () => {
    // Aylık 10 → 60 günde beklenen 20, eşik 40; 22 yeni yorum olağan.
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 22, avgMonthlyReviews: 10, cycleDays: 60 })],
    });
    expect(alerts).toEqual([]);
  });

  it("avgMonthlyReviews 0 iken min eşiği tek başına yeterli", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ newReviewsThisCycle: 5, avgMonthlyReviews: 0 })],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("competitor_review_surge");
  });
});

describe("detectCompetitorAlerts — competitor_rating_shift", () => {
  it("bir taraf null ise tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ previousRecentRating: 4.0, currentRecentRating: null })],
    });
    expect(alerts).toEqual([]);
  });

  it("eşik altındaki değişimde tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ previousRecentRating: 4.0, currentRecentRating: 4.2 })],
    });
    expect(alerts).toEqual([]);
  });

  it("eşiği aşan yükseliş direction=up ile tetiklenir", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ previousRecentRating: 4.0, currentRecentRating: 4.4 })],
    });
    expect(alerts).toEqual([
      {
        type: "competitor_rating_shift",
        competitor_id: "comp-1",
        competitor_name: "A Kliniği",
        detail: { from: 4.0, to: 4.4, direction: "up" },
      },
    ]);
  });

  it("eşiği aşan düşüş direction=down ile tetiklenir", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [makeCompetitor({ previousRecentRating: 4.5, currentRecentRating: 4.0 })],
    });
    expect(alerts).toEqual([
      {
        type: "competitor_rating_shift",
        competitor_id: "comp-1",
        competitor_name: "A Kliniği",
        detail: { from: 4.5, to: 4.0, direction: "down" },
      },
    ]);
  });
});

describe("detectCompetitorAlerts — competitor_negative_spike", () => {
  it("önceki mention 0 ise tetiklenmez (sonsuz kat artış gürültüdür)", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          negativeThemeSpikes: [{ theme: "hijyen", previousNegative: 0, currentNegative: 6 }],
        }),
      ],
    });
    expect(alerts).toEqual([]);
  });

  it("currentNegative THEME_TREND_MIN_MENTIONS altındaysa tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          negativeThemeSpikes: [{ theme: "hijyen", previousNegative: 2, currentNegative: 4 }],
        }),
      ],
    });
    expect(alerts).toEqual([]);
  });

  it("çarpan koşulunu geçmiyorsa tetiklenmez", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          negativeThemeSpikes: [{ theme: "hijyen", previousNegative: 4, currentNegative: 6 }],
        }),
      ],
    });
    expect(alerts).toEqual([]);
  });

  it("tüm koşullar sağlanınca tetiklenir", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          negativeThemeSpikes: [{ theme: "hijyen", previousNegative: 3, currentNegative: 6 }],
        }),
      ],
    });
    expect(alerts).toEqual([
      {
        type: "competitor_negative_spike",
        competitor_id: "comp-1",
        competitor_name: "A Kliniği",
        detail: { theme: "hijyen", previous_negative: 3, current_negative: 6 },
      },
    ]);
  });

  it("bir rakip için en fazla 3 spike üretir", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          negativeThemeSpikes: [
            { theme: "a", previousNegative: 3, currentNegative: 6 },
            { theme: "b", previousNegative: 3, currentNegative: 6 },
            { theme: "c", previousNegative: 3, currentNegative: 6 },
            { theme: "d", previousNegative: 3, currentNegative: 6 },
          ],
        }),
      ],
    });
    expect(alerts).toHaveLength(3);
    expect(alerts.map((a) => a.detail.theme)).toEqual(["a", "b", "c"]);
  });
});

describe("detectCompetitorAlerts — çoklu rakip ve çoklu alert türü", () => {
  it("birden fazla rakip için bağımsız değerlendirir, aynı rakipte birden fazla tür üretebilir", () => {
    const alerts = detectCompetitorAlerts({
      competitors: [
        makeCompetitor({
          id: "comp-1",
          name: "A Kliniği",
          newReviewsThisCycle: 10,
          avgMonthlyReviews: 2,
          previousRecentRating: 4.0,
          currentRecentRating: 4.5,
        }),
        makeCompetitor({ id: "comp-2", name: "B Kliniği" }),
      ],
    });
    expect(alerts).toHaveLength(2);
    expect(alerts.every((a) => a.competitor_id === "comp-1")).toBe(true);
    expect(alerts.map((a) => a.type).sort()).toEqual(["competitor_rating_shift", "competitor_review_surge"]);
  });
});
