import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTrustpilotRefs } from "@/lib/analysis/resolve-trustpilot-refs";
import { resolveTrustpilotDomain } from "@/lib/reviews/sources/trustpilot-domain";
import type * as TrustpilotDomainModule from "@/lib/reviews/sources/trustpilot-domain";

// Sadece `resolveTrustpilotDomain` mock'lanır (Apify'a çıkan taraf o);
// `extractHost` saf bir string parse'ı olduğu için gerçek implementasyonu
// kullanılır — website'ın geçerli olup olmadığı kararı gerçek mantıkla test edilsin.
vi.mock("@/lib/reviews/sources/trustpilot-domain", async (importOriginal) => ({
  ...(await importOriginal<typeof TrustpilotDomainModule>()),
  resolveTrustpilotDomain: vi.fn(),
}));

const mockedResolveTrustpilotDomain = vi.mocked(resolveTrustpilotDomain);

function createSupabaseMock() {
  const eqMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ update: updateMock });
  return { from: fromMock, update: updateMock, eq: eqMock } as unknown as Parameters<
    typeof resolveTrustpilotRefs
  >[0] & { from: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
}

describe("resolveTrustpilotRefs", () => {
  beforeEach(() => {
    mockedResolveTrustpilotDomain.mockReset();
  });

  it("kendi işletmenin trustpilot domaini yoksa rakipler hiç probe edilmez", async () => {
    const supabase = createSupabaseMock();
    mockedResolveTrustpilotDomain.mockResolvedValueOnce(null);

    const result = await resolveTrustpilotRefs(
      supabase,
      { id: "biz-1", website: "https://own.clinic", trustpilot_domain: null, trustpilot_checked_at: null },
      [{ id: "comp-1", website: "https://comp.clinic", trustpilot_domain: null, trustpilot_checked_at: null }],
    );

    expect(result).toEqual({ ownDomain: null, byCompetitorId: new Map() });
    // Sadece own için çağrılır, rakip için çağrılmaz.
    expect(mockedResolveTrustpilotDomain).toHaveBeenCalledTimes(1);
  });

  it("checked_at doluysa probe atlanır, kayıtlı domain kullanılır", async () => {
    const supabase = createSupabaseMock();

    const result = await resolveTrustpilotRefs(
      supabase,
      {
        id: "biz-1",
        website: "https://own.clinic",
        trustpilot_domain: "own.clinic",
        trustpilot_checked_at: "2026-01-01T00:00:00.000Z",
      },
      [
        {
          id: "comp-1",
          website: "https://comp.clinic",
          trustpilot_domain: null,
          trustpilot_checked_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    );

    expect(mockedResolveTrustpilotDomain).not.toHaveBeenCalled();
    expect(result.ownDomain).toBe("own.clinic");
    expect(result.byCompetitorId.size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("own domain bulunursa rakipler de probe edilir ve checked_at DB'ye yazılır", async () => {
    const supabase = createSupabaseMock();
    mockedResolveTrustpilotDomain.mockResolvedValueOnce("own.clinic").mockResolvedValueOnce("comp.clinic");

    const result = await resolveTrustpilotRefs(
      supabase,
      { id: "biz-1", website: "https://own.clinic", trustpilot_domain: null, trustpilot_checked_at: null },
      [{ id: "comp-1", website: "https://comp.clinic", trustpilot_domain: null, trustpilot_checked_at: null }],
    );

    expect(result.ownDomain).toBe("own.clinic");
    expect(result.byCompetitorId.get("comp-1")).toBe("comp.clinic");
    expect(supabase.from).toHaveBeenCalledWith("businesses");
    expect(supabase.from).toHaveBeenCalledWith("competitors");
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ trustpilot_domain: "own.clinic" }),
    );
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ trustpilot_domain: "comp.clinic" }),
    );
  });

  it("website null ise probe da checked_at yazımı da yapılmaz (kontrol hiç gerçekleşmedi)", async () => {
    const supabase = createSupabaseMock();

    const result = await resolveTrustpilotRefs(
      supabase,
      { id: "biz-1", website: null, trustpilot_domain: null, trustpilot_checked_at: null },
      [{ id: "comp-1", website: "https://comp.clinic", trustpilot_domain: null, trustpilot_checked_at: null }],
    );

    expect(result.ownDomain).toBeNull();
    expect(mockedResolveTrustpilotDomain).not.toHaveBeenCalled();
    // KRİTİK: checked_at yazılmamalı — website sonradan dolarsa tekrar
    // probe edilebilmeli.
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("website parse edilemiyorsa da checked_at yazılmaz", async () => {
    const supabase = createSupabaseMock();

    await resolveTrustpilotRefs(
      supabase,
      { id: "biz-1", website: "http://", trustpilot_domain: null, trustpilot_checked_at: null },
      [],
    );

    expect(mockedResolveTrustpilotDomain).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("probe null dönse bile checked_at yine de yazılır (tekrar probe önlemek için)", async () => {
    const supabase = createSupabaseMock();
    mockedResolveTrustpilotDomain.mockResolvedValueOnce("own.clinic").mockResolvedValueOnce(null);

    await resolveTrustpilotRefs(
      supabase,
      { id: "biz-1", website: "https://own.clinic", trustpilot_domain: null, trustpilot_checked_at: null },
      [{ id: "comp-1", website: "https://comp.clinic", trustpilot_domain: null, trustpilot_checked_at: null }],
    );

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ trustpilot_domain: null }),
    );
  });
});
