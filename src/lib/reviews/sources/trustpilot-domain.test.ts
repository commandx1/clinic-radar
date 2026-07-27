import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTrustpilotReviews } from "@/lib/apify/trustpilot-reviews";
import {
  extractHost,
  normalizeTrustpilotDomainInput,
  resolveTrustpilotDomain,
} from "@/lib/reviews/sources/trustpilot-domain";
import type { ScrapedSourceReview } from "@/lib/reviews/types";

// Gerçek Apify çağrısı yapılmaz — apify/trustpilot-reviews modülü mock'lanır.
vi.mock("@/lib/apify/trustpilot-reviews", () => ({
  fetchTrustpilotReviews: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchTrustpilotReviews);

function review(): ScrapedSourceReview {
  return {
    review_id: "r1",
    source: "trustpilot",
    source_ref: "example.com",
    author_name: null,
    rating: 5,
    text: null,
    original_language: null,
    translated_text: null,
    owner_reply: null,
    images_count: null,
    likes: null,
    is_local_guide: null,
    review_url: null,
    published_at: null,
  };
}

describe("extractHost", () => {
  it("null/boş girdide null döner", () => {
    expect(extractHost(null)).toBeNull();
    expect(extractHost("")).toBeNull();
  });

  it("şema ve yol içeren URL'den host'u çıkarır, www'ı korur", () => {
    expect(extractHost("https://www.natural.clinic/tr")).toBe("www.natural.clinic");
  });

  it("şemasız girdiye şema ekleyerek parse eder", () => {
    expect(extractHost("natural.clinic")).toBe("natural.clinic");
  });

  it("geçersiz girdide null döner", () => {
    expect(extractHost("http://")).toBeNull();
  });
});

describe("normalizeTrustpilotDomainInput", () => {
  it("ham domain'i olduğu gibi kabul eder", () => {
    expect(normalizeTrustpilotDomainInput("natural.clinic")).toBe("natural.clinic");
  });

  it("site URL'inden host'u çıkarır ve www'ı KORUR", () => {
    // Trustpilot'ta kimlik www'a duyarlı — www silinirse yanlış profile bakılır.
    expect(normalizeTrustpilotDomainInput("https://www.veraclinic.net/tr")).toBe("www.veraclinic.net");
  });

  it("Trustpilot profil URL'inden domain'i çıkarır (trustpilot.com'u DEĞİL)", () => {
    expect(normalizeTrustpilotDomainInput("https://www.trustpilot.com/review/natural.clinic")).toBe(
      "natural.clinic",
    );
  });

  it("profil URL'indeki query/hash domain'e karışmaz", () => {
    expect(normalizeTrustpilotDomainInput("https://tr.trustpilot.com/review/natural.clinic?stars=5")).toBe(
      "natural.clinic",
    );
  });

  it("profil URL'inde www'lu domain korunur", () => {
    expect(normalizeTrustpilotDomainInput("https://www.trustpilot.com/review/www.veraclinic.net")).toBe(
      "www.veraclinic.net",
    );
  });

  it("büyük harfli girdiyi küçültür", () => {
    expect(normalizeTrustpilotDomainInput("Natural.Clinic")).toBe("natural.clinic");
  });

  it("boş/whitespace girdide null döner", () => {
    expect(normalizeTrustpilotDomainInput("")).toBeNull();
    expect(normalizeTrustpilotDomainInput("   ")).toBeNull();
  });

  it("parse edilemeyen girdide null döner", () => {
    expect(normalizeTrustpilotDomainInput("http://")).toBeNull();
  });
});

describe("resolveTrustpilotDomain", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("www'suz varyant satır dönerse onu döndürür ve ikinci çağrıyı yapmaz", async () => {
    mockedFetch.mockResolvedValueOnce([review()]);

    const result = await resolveTrustpilotDomain("https://natural.clinic");

    expect(result).toBe("natural.clinic");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    // maxPages: 1 — probe tam sayfa çekip atmamalı (actor pay-per-result).
    expect(mockedFetch).toHaveBeenCalledWith(["natural.clinic"], 1, { maxPages: 1 });
  });

  it("www'suz boş, www'lu dolu -> www.<host> döner", async () => {
    mockedFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([review()]);

    const result = await resolveTrustpilotDomain("https://veraclinic.net");

    expect(result).toBe("www.veraclinic.net");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch).toHaveBeenNthCalledWith(1, ["veraclinic.net"], 1, { maxPages: 1 });
    expect(mockedFetch).toHaveBeenNthCalledWith(2, ["www.veraclinic.net"], 1, { maxPages: 1 });
  });

  it("ikisi de boş dönerse null döner (profil yok)", async () => {
    mockedFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await resolveTrustpilotDomain("https://dinamikdis.com");

    expect(result).toBeNull();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("ilk varyant hata fırlatır, ikinci varyant dolu döner -> ikinciyi döndürür", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("apify_run_failed:500")).mockResolvedValueOnce([review()]);

    const result = await resolveTrustpilotDomain("https://example.com");

    expect(result).toBe("www.example.com");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("website null ise fetch hiç çağrılmadan null döner", async () => {
    const result = await resolveTrustpilotDomain(null);

    expect(result).toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
