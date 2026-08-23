import { describe, expect, it } from "vitest";

import {
  computeRecentRank,
  computeRecentRating,
  extractRecentRatingTrendPoint,
  median,
  type RecentRatingsSnapshot,
} from "@/lib/analysis/recent-ratings";
import { RECENT_RATING_MIN_REVIEWS } from "@/lib/constants";

describe("computeRecentRating", () => {
  it(`yorum sayısı RECENT_RATING_MIN_REVIEWS (${String(RECENT_RATING_MIN_REVIEWS)}) altındaysa rating null döner`, () => {
    const stars = Array.from({ length: RECENT_RATING_MIN_REVIEWS - 1 }, () => 5);
    expect(computeRecentRating(stars)).toEqual({ rating: null, reviews: RECENT_RATING_MIN_REVIEWS - 1 });
  });

  it("yorum sayısı eşiğe ulaştığında ortalamayı 2 ondalığa yuvarlar", () => {
    const stars = [5, 5, 5, 4, 4];
    // ortalama = 23/5 = 4.6
    expect(computeRecentRating(stars)).toEqual({ rating: 4.6, reviews: 5 });
  });

  it("küsuratlı ortalamayı doğru yuvarlar (2dp)", () => {
    const stars = [5, 4, 4, 3, 5, 5];
    // ortalama = 26/6 = 4.333...
    expect(computeRecentRating(stars)).toEqual({ rating: 4.33, reviews: 6 });
  });

  it("boş dizide reviews=0, rating=null döner", () => {
    expect(computeRecentRating([])).toEqual({ rating: null, reviews: 0 });
  });
});

describe("computeRecentRank", () => {
  it("own ve rakiplerin hiçbirinde veri yoksa null döner", () => {
    expect(computeRecentRank(null, [null, null])).toBeNull();
  });

  it("own veri varsa rakipler null olsa da rank hesaplanır (1)", () => {
    expect(computeRecentRank(4.5, [null, null])).toBe(1);
  });

  it("own null ama en az bir rakipte veri varsa yine hesaplanır", () => {
    // own = 0 muamelesi görür, rakip pozitifse önde sayılır -> own rank 2 olur
    expect(computeRecentRank(null, [4.2])).toBe(2);
  });

  it("own rakiplerin gerisindeyse doğru sırayı döner", () => {
    expect(computeRecentRank(4.0, [4.5, 3.9, 4.8])).toBe(3);
  });
});

describe("median", () => {
  it("boş dizide null döner", () => {
    expect(median([])).toBeNull();
  });

  it("tek elemanlı dizide o elemanı döner", () => {
    expect(median([4.2])).toBe(4.2);
  });

  it("tek sayıda elemanda ortanca elemanı döner", () => {
    expect(median([4.5, 3.9, 4.8])).toBe(4.5);
  });

  it("çift sayıda elemanda ortadaki ikisinin ortalamasını döner", () => {
    expect(median([4.0, 4.6, 3.8, 4.2])).toBe(4.1);
  });
});

describe("extractRecentRatingTrendPoint", () => {
  it("snapshot null ise iki alan da null döner", () => {
    expect(extractRecentRatingTrendPoint(null)).toEqual({
      ownRecentRating: null,
      competitorMedianRecentRating: null,
    });
  });

  it("own null, rakiplerden bazıları null ise sadece dolu olanlardan medyan alır", () => {
    const snapshot: RecentRatingsSnapshot = {
      own: null,
      competitors: [
        { competitor_id: "a", name: "A", rating: 4.0, reviews: 6 },
        { competitor_id: "b", name: "B", rating: null, reviews: 2 },
        { competitor_id: "c", name: "C", rating: 4.6, reviews: 8 },
      ],
      recent_rank: null,
    };
    expect(extractRecentRatingTrendPoint(snapshot)).toEqual({
      ownRecentRating: null,
      competitorMedianRecentRating: 4.3,
    });
  });

  it("own doluysa own.rating'i taşır", () => {
    const snapshot: RecentRatingsSnapshot = {
      own: { rating: 4.5, reviews: 10 },
      competitors: [],
      recent_rank: 1,
    };
    expect(extractRecentRatingTrendPoint(snapshot)).toEqual({
      ownRecentRating: 4.5,
      competitorMedianRecentRating: null,
    });
  });
});
