import { GoogleGenAI } from "@google/genai";

// Geçici sağlayıcı: Anthropic hesabındaki kredi bakiyesi yenilenene kadar
// AI_PROVIDER=gemini ile kullanılıyor (bkz. src/lib/ai-pipeline/provider.ts).
// Ücretsiz kullanım kotası olan, yapılandırılmış JSON çıktıyı destekleyen bir
// model — bkz. https://ai.google.dev/gemini-api/docs/structured-output.
export const GEMINI_MODEL = "gemini-2.5-flash";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("gemini_not_configured");
  }

  cachedClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return cachedClient;
}
