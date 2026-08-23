import { describe, expect, it } from "vitest";

import { computeScrapeSuccessRate, shouldAlertScrapeSuccess } from "@/lib/analysis/scrape-success-alert";
import { SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD } from "@/lib/constants";

describe("computeScrapeSuccessRate", () => {
  it("processed=0 iken null döner (hiç deneme yok)", () => {
    expect(computeScrapeSuccessRate(0, 0)).toBeNull();
  });

  it("başarı sayısını processed'e bölerek oranı hesaplar", () => {
    expect(computeScrapeSuccessRate(3, 4)).toBe(0.75);
  });

  it("hiç başarı yoksa 0 döner (null ile karışmaz)", () => {
    expect(computeScrapeSuccessRate(0, 4)).toBe(0);
  });
});

describe("shouldAlertScrapeSuccess", () => {
  it("processed=0 iken alarm tetiklenmez (rate null olsa bile)", () => {
    expect(shouldAlertScrapeSuccess(null, 0)).toBe(false);
  });

  it("rate eşiğin altındaysa ve processed>=1 ise alarm tetiklenir", () => {
    expect(shouldAlertScrapeSuccess(SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD - 0.01, 1)).toBe(true);
  });

  it("rate eşiğe eşitse alarm tetiklenmez", () => {
    expect(shouldAlertScrapeSuccess(SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD, 5)).toBe(false);
  });

  it("rate eşiğin üstündeyse alarm tetiklenmez", () => {
    expect(shouldAlertScrapeSuccess(0.9, 10)).toBe(false);
  });
});
