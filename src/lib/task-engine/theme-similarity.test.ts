import { describe, expect, it } from "vitest";

import { findSimilarTheme, normalizeTheme } from "@/lib/task-engine/theme-similarity";

// Sabit (bkz. src/lib/constants.ts): THEME_SIMILARITY_THRESHOLD = 0.6.

describe("normalizeTheme", () => {
  it("trim + lowercase uygular", () => {
    expect(normalizeTheme("  Hijyen ")).toBe("hijyen");
  });
});

describe("findSimilarTheme", () => {
  it("normalize edilince birebir eşleşen bir aday her zaman kazanır (token analizine hiç girmez)", () => {
    expect(findSimilarTheme("  Hijyen ", ["hijyen", "Bekleme süresi"])).toBe("hijyen");
  });

  it("aday listesi boşsa null döner", () => {
    expect(findSimilarTheme("Hijyen", [])).toBeNull();
  });

  it("hiç alakasız iki tema için null döner (ortak token yok)", () => {
    expect(findSimilarTheme("Hijyen", ["Randevu kolaylığı"])).toBeNull();
  });

  // bkz. docs/02-business-rules.md Bölüm D — gerçek Mersin diş kliniği pilotunda
  // (2026-08) aynı iki döngü arasında AI'ın etiketlediği 3 tema çifti. Bu test
  // Part A (known-theme vocabulary, execute-analysis.ts) OLMADAN, salt Part B
  // güvenlik ağının bu üç çiftte NE YAPTIĞINI dürüstçe belgeler — eşik
  // eşleşmeleri zorlayacak şekilde AYARLANMADI (bkz. constants.ts
  // THEME_SIMILARITY_THRESHOLD notu).
  describe("gerçek cycle-1 → cycle-2 tema çiftleri (Mersin pilotu, 2026-08)", () => {
    it('"Tedavi sürecinde bilgilendirme ve şeffaflık" → "Tedavi süreci hakkında detaylı bilgilendirme": jaccard 0.5, eşiğin (0.6) altında — EŞLEŞMEZ', () => {
      const result = findSimilarTheme("Tedavi süreci hakkında detaylı bilgilendirme", [
        "Tedavi sürecinde bilgilendirme ve şeffaflık",
      ]);
      expect(result).toBeNull();
    });

    it('"Sahte online yorum iddiası" → "Sahte yorum ve itibar manipülasyonu şüphesi": jaccard ≈ 0.286 — EŞLEŞMEZ (tam rephrasing, Part A\'nın işi)', () => {
      const result = findSimilarTheme("Sahte yorum ve itibar manipülasyonu şüphesi", [
        "Sahte online yorum iddiası",
      ]);
      expect(result).toBeNull();
    });

    it('"Randevu sürecinin esnekliği ve sorunsuzluğu" → "Hızlı iletişim ve randevu kolaylığı": jaccard ≈ 0.143 — EŞLEŞMEZ', () => {
      const result = findSimilarTheme("Hızlı iletişim ve randevu kolaylığı", [
        "Randevu sürecinin esnekliği ve sorunsuzluğu",
      ]);
      expect(result).toBeNull();
    });
  });

  describe("dar morfolojik varyantlar (Part B'nin gerçekten yakaladığı sınıf)", () => {
    it('"Randevu süreci" / "Randevu sürecinde" — aynı iki token aynı 5-karakter köke kırpılır, jaccard 1.0 — EŞLEŞİR', () => {
      expect(findSimilarTheme("Randevu sürecinde", ["Randevu süreci"])).toBe("Randevu süreci");
    });

    it('tek kelimelik ek varyantı ("Temizlik" / "Temizliği") jaccard 1.0 — EŞLEŞİR', () => {
      expect(findSimilarTheme("Temizliği", ["Temizlik"])).toBe("Temizlik");
    });

    it('tek kelimelik çoğul varyantı ("Yorum" / "Yorumlar") jaccard 1.0 — EŞLEŞİR', () => {
      expect(findSimilarTheme("Yorumlar", ["Yorum"])).toBe("Yorum");
    });

    it('fazladan bir kelime eklenmesi ("Bekleme süresi" / "Uzun bekleme süresi") jaccard ≈ 0.667 — EŞLEŞİR', () => {
      expect(findSimilarTheme("Uzun bekleme süresi", ["Bekleme süresi"])).toBe("Bekleme süresi");
    });

    // DÜRÜST SINIR: aynı "aile"den bir morfolojik varyant olsa bile, tek
    // kelimelik temada 5 karaktere kırpma her zaman ekten ÖNCE kesmeyebilir —
    // "süresi" → "süres", "süreleri" → "sürel" farklı 5. karakterde ayrışıyor.
    // Bu, THEME_SIMILARITY_THRESHOLD'u düşürmeden düzeltilemez (ki bu da
    // alakasız temaları birleştirme riskini artırır) — bilinçli olarak
    // kabul edilen bir sınır, bkz. constants.ts.
    it('"Bekleme süresi" / "Bekleme süreleri" jaccard ≈ 0.333, eşiğin altında — EŞLEŞMEZ (bilinen sınır)', () => {
      expect(findSimilarTheme("Bekleme süreleri", ["Bekleme süresi"])).toBeNull();
    });
  });

  it("birden fazla aday arasından en yüksek skorlu olanı seçer", () => {
    const result = findSimilarTheme("Randevu sürecinde", [
      "Hijyen",
      "Randevu süreci",
      "Fiyat şeffaflığı",
    ]);
    expect(result).toBe("Randevu süreci");
  });

  it("3 karakterden kısa token'lar ve stopword'ler (tr: ve/ile/için/bir/bu) benzerlik hesabından düşer", () => {
    // "ve" stopword'ü düşünce iki taraf da {randevu->rande, iletişim->ileti}
    // token setine indirgenir — jaccard 1.0.
    expect(findSimilarTheme("Randevu iletişim", ["Randevu ve iletişim"])).toBe("Randevu ve iletişim");
  });
});
