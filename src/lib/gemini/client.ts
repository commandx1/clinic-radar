import { GoogleGenAI } from "@google/genai";

// Geçici sağlayıcı: Anthropic hesabındaki kredi bakiyesi yenilenene kadar
// AI_PROVIDER=gemini ile kullanılıyor (bkz. src/lib/ai-pipeline/provider.ts).
// Ücretsiz kullanım kotası olan, yapılandırılmış JSON çıktıyı destekleyen bir
// model — bkz. https://ai.google.dev/gemini-api/docs/structured-output.
// 2026-08-23: gemini-2.5-flash yeni kullanıcılara kapatıldı (API 404 "no longer
// available to new users, use gemini-3.6-flash") — yedek sağlayıcı yolu tamamen
// kırılmıştı; smoke testle doğrulanarak gemini-3.6-flash'a geçildi.
export const GEMINI_MODEL = "gemini-3.6-flash";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("gemini_not_configured");
  }

  cachedClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return cachedClient;
}
