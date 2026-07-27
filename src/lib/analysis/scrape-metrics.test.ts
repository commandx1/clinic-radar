import { afterEach, describe, expect, it } from "vitest";

import { estimateScrapeCostUsd } from "@/lib/analysis/scrape-metrics";
import type { ReviewSource } from "@/lib/reviews/types";

const ENV_KEY = "APIFY_PRICE_PER_REVIEW_USD";

describe("estimateScrapeCostUsd", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    process.env[ENV_KEY] = original ?? "";
  });

  it("env tanımsızsa null döner (google tek kaynak)", () => {
    process.env[ENV_KEY] = "";
    const counts = new Map<ReviewSource, number>([["google", 10]]);
    expect(estimateScrapeCostUsd(counts)).toBeNull();
  });

  it("env negatifse veya sayısal değilse null döner", () => {
    process.env[ENV_KEY] = "-1";
    expect(estimateScrapeCostUsd(new Map<ReviewSource, number>([["google", 5]]))).toBeNull();

    process.env[ENV_KEY] = "not-a-number";
    expect(estimateScrapeCostUsd(new Map<ReviewSource, number>([["google", 5]]))).toBeNull();
  });

  it("google için sonuç sayısı × birim fiyat olarak hesaplar", () => {
    process.env[ENV_KEY] = "0.01";
    const counts = new Map<ReviewSource, number>([["google", 100]]);
    expect(estimateScrapeCostUsd(counts)).toBe(1);
  });

  it("kayıtlı olmayan bir kaynak (adaptörsüz) maliyete katkı yapmaz", () => {
    process.env[ENV_KEY] = "0.01";
    // "facebook" ReviewSource union'ında var ama REVIEW_SOURCE_ADAPTERS'a
    // kayıtlı değil — bu kaynağın sayımı toplam maliyete hiç girmemeli.
    const counts = new Map<ReviewSource, number>([
      ["google", 100],
      ["facebook", 50],
    ]);
    expect(estimateScrapeCostUsd(counts)).toBe(1);
  });

  it("kayıtlı ama fiyatı tanımsız bir kaynak maliyete katkı yapmaz", () => {
    process.env[ENV_KEY] = "0.01";
    // trustpilot adaptörü kayıtlı, ama fiyat env'i (bu testte set edilmeyen
    // APIFY_PRICE_PER_TRUSTPILOT_REVIEW_USD) yoksa costPerReviewUsd null
    // döner ve o kaynak sessizce maliyetsiz sayılır.
    const counts = new Map<ReviewSource, number>([
      ["google", 100],
      ["trustpilot", 50],
    ]);
    expect(estimateScrapeCostUsd(counts)).toBe(1);
  });

  it("tüm kaynaklar null/kayıtsız dönerse toplam sonuç null olur", () => {
    process.env[ENV_KEY] = "";
    const counts = new Map<ReviewSource, number>([
      ["google", 100],
      ["trustpilot", 50],
    ]);
    expect(estimateScrapeCostUsd(counts)).toBeNull();
  });

  it("0 sayımlı kaynakları atlar", () => {
    process.env[ENV_KEY] = "0.01";
    const counts = new Map<ReviewSource, number>([["google", 0]]);
    expect(estimateScrapeCostUsd(counts)).toBeNull();
  });
});
