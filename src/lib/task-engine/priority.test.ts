import { describe, expect, it } from "vitest";

import { derivePriority } from "@/lib/task-engine/priority";

// Eşikler (bkz. src/lib/constants.ts): high ≥ 30, medium ≥ 12.
describe("derivePriority", () => {
  it("priority_raw = impact/effort tam high eşiğinde high döner", () => {
    expect(derivePriority(30, 1)).toBe("high");
    expect(derivePriority(60, 2)).toBe("high");
  });

  it("high eşiğinin hemen altı medium döner", () => {
    expect(derivePriority(29, 1)).toBe("medium");
  });

  it("tam medium eşiğinde medium döner", () => {
    expect(derivePriority(12, 1)).toBe("medium");
    expect(derivePriority(24, 2)).toBe("medium");
  });

  it("medium eşiğinin hemen altı low döner", () => {
    expect(derivePriority(11, 1)).toBe("low");
  });

  it("yüksek effort skoru düşürür", () => {
    expect(derivePriority(30, 3)).toBe("low"); // 10 < 12
  });
});
