import { describe, expect, it } from "vitest";

import { buildOwnerMap } from "@/lib/analysis/execute-analysis";

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
