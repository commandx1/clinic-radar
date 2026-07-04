import Anthropic from "@anthropic-ai/sdk";

// Model kullanıcı onayıyla seçildi: docs/05-ai-pipeline.md'deki Aşama 1/2 saf
// JSON çıkarım/üretim işi (ajanik değil), Sonnet 5 maliyet/kalite dengesi.
export const CLAUDE_MODEL = "claude-sonnet-5";

let cachedClient: Anthropic | null = null;

// apify/client.ts'teki apify_not_configured desenine paralel — eksik key'i
// route'ta ayrı bir hata koduyla (claude_not_configured) ayırt edebilmek için
// SDK'nın kendi genel auth hatasına güvenmek yerine erken kontrol ediyoruz.
export function getClaudeClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("claude_not_configured");
  }

  cachedClient ??= new Anthropic();
  return cachedClient;
}
