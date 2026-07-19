import { describe, expect, it } from "vitest";

import { normalizeTheme, selectThemesToReopen, type PreviousMentionCounts } from "@/lib/task-engine/reopen";

// Sabitler (bkz. src/lib/constants.ts): TASK_MENTION_THRESHOLD = 3,
// DISMISSED_REOPEN_NEGATIVE_MULTIPLIER = 2.

function prevMap(entries: [string, PreviousMentionCounts][]): Map<string, PreviousMentionCounts> {
  return new Map(entries);
}

describe("normalizeTheme", () => {
  it("trim + lowercase uygular", () => {
    expect(normalizeTheme("  Hijyen ")).toBe("hijyen");
  });
});

describe("selectThemesToReopen", () => {
  it("2x artış + eşik üstü negatif mention temayı yeniden açar (orijinal ad korunur)", () => {
    const prev = prevMap([["own|hijyen", { positive_mentions: 1, negative_mentions: 2 }]]);
    const result = selectThemesToReopen(prev, [{ theme: "Hijyen", negative_mentions: 4 }]);

    expect(result).toEqual(["Hijyen"]);
  });

  it("2x artsa bile eşik altında kalırsa tetiklemez (1 → 2)", () => {
    const prev = prevMap([["own|hijyen", { positive_mentions: 0, negative_mentions: 1 }]]);
    const result = selectThemesToReopen(prev, [{ theme: "Hijyen", negative_mentions: 2 }]);

    expect(result).toEqual([]);
  });

  it("2x'in altında artış tetiklemez (3 → 5)", () => {
    const prev = prevMap([["own|hijyen", { positive_mentions: 0, negative_mentions: 3 }]]);
    const result = selectThemesToReopen(prev, [{ theme: "Hijyen", negative_mentions: 5 }]);

    expect(result).toEqual([]);
  });

  it("tam 2x sınırında tetikler (3 → 6)", () => {
    const prev = prevMap([["own|hijyen", { positive_mentions: 0, negative_mentions: 3 }]]);
    const result = selectThemesToReopen(prev, [{ theme: "Hijyen", negative_mentions: 6 }]);

    expect(result).toEqual(["Hijyen"]);
  });

  it("önceki döngüde negatif mention yoksa (0) atlar", () => {
    const prev = prevMap([["own|hijyen", { positive_mentions: 5, negative_mentions: 0 }]]);
    const result = selectThemesToReopen(prev, [{ theme: "Hijyen", negative_mentions: 10 }]);

    expect(result).toEqual([]);
  });

  it("önceki kayıt hiç yoksa atlar, boş girişlerde boş döner", () => {
    expect(selectThemesToReopen(prevMap([]), [{ theme: "Hijyen", negative_mentions: 10 }])).toEqual([]);
    expect(selectThemesToReopen(prevMap([]), [])).toEqual([]);
  });
});
