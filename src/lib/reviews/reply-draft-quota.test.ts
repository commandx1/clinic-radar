import { describe, expect, it } from "vitest";

import { FREE_PLAN_REPLY_DRAFTS_PER_MONTH } from "@/lib/constants";
import { canGenerateReplyDraft } from "@/lib/reviews/reply-draft-quota";

describe("canGenerateReplyDraft", () => {
  it("Pro kullanıcı için her zaman true döner (sayaç yüksek olsa bile)", () => {
    expect(canGenerateReplyDraft({ isPro: true, generatedLast30Days: 0 })).toBe(true);
    expect(canGenerateReplyDraft({ isPro: true, generatedLast30Days: 1000 })).toBe(true);
  });

  it("Free kullanıcı kota altındaysa true döner", () => {
    expect(canGenerateReplyDraft({ isPro: false, generatedLast30Days: 0 })).toBe(true);
    expect(
      canGenerateReplyDraft({ isPro: false, generatedLast30Days: FREE_PLAN_REPLY_DRAFTS_PER_MONTH - 1 }),
    ).toBe(true);
  });

  it("Free kullanıcı tam eşikteyse false döner", () => {
    expect(canGenerateReplyDraft({ isPro: false, generatedLast30Days: FREE_PLAN_REPLY_DRAFTS_PER_MONTH })).toBe(
      false,
    );
  });

  it("Free kullanıcı eşiği aştıysa false döner", () => {
    expect(
      canGenerateReplyDraft({ isPro: false, generatedLast30Days: FREE_PLAN_REPLY_DRAFTS_PER_MONTH + 3 }),
    ).toBe(false);
  });
});
