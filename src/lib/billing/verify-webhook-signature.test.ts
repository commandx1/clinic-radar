import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "@/lib/billing/verify-webhook-signature";

const SECRET = "test-secret";

function sign(rawBody: string, secret: string = SECRET): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("doğru imzayı kabul eder", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_updated" } });
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("imza header'ı yoksa (null) reddeder", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false);
  });

  it("yanlış secret ile üretilmiş imzayı reddeder", () => {
    const body = "{}";
    expect(verifyWebhookSignature(body, sign(body, "wrong-secret"), SECRET)).toBe(false);
  });

  it("gövde değiştirilmişse imza tutmaz", () => {
    const signature = sign('{"a":1}');
    expect(verifyWebhookSignature('{"a":2}', signature, SECRET)).toBe(false);
  });

  it("farklı uzunluktaki imzayı timingSafeEqual'a düşmeden reddeder", () => {
    expect(verifyWebhookSignature("{}", "kisa-imza", SECRET)).toBe(false);
  });
});
