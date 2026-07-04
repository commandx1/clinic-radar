import { getClaudeClient } from "@/lib/claude/client";
import * as claudeExecutiveSummary from "@/lib/claude/executive-summary";
import * as claudeGapAnalysis from "@/lib/claude/gap-analysis";
import * as claudeThemeExtraction from "@/lib/claude/theme-extraction";
import { getGeminiClient } from "@/lib/gemini/client";
import * as geminiExecutiveSummary from "@/lib/gemini/executive-summary";
import * as geminiGapAnalysis from "@/lib/gemini/gap-analysis";
import * as geminiThemeExtraction from "@/lib/gemini/theme-extraction";

export type {
  ExecutiveSummaryInput,
  ExecutiveSummaryOutput,
  ThemeTrendInput,
} from "@/lib/ai-pipeline/executive-summary-schema";
export type { CompetitorThemeInput, GapAnalysisOutput, TaskCandidate } from "@/lib/ai-pipeline/gap-analysis-schema";
export type { ReviewInput, ThemeExtractionOutput, ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";

// Tek geçiş noktası: hangi AI sağlayıcısının kullanıldığı AI_PROVIDER env
// değişkeniyle belirlenir. Anthropic hesabındaki kredi bakiyesi tükendiğinde
// geçici olarak "gemini"ye geçildi — geri dönüş sadece bu değişkeni "claude"a
// çevirmek (bkz. CLAUDE.md).
function resolveProvider(): "claude" | "gemini" {
  return process.env.AI_PROVIDER === "gemini" ? "gemini" : "claude";
}

// Route, gerçek Stage 1/2 çağrılarına başlamadan önce sağlayıcının
// yapılandırıldığını doğrulamak için bunu çağırır (claude_not_configured /
// gemini_not_configured hatası fırlatır).
export function assertProviderConfigured(): void {
  if (resolveProvider() === "gemini") {
    getGeminiClient();
  } else {
    getClaudeClient();
  }
}

export const extractThemes: typeof claudeThemeExtraction.extractThemes = (params) =>
  resolveProvider() === "gemini" ? geminiThemeExtraction.extractThemes(params) : claudeThemeExtraction.extractThemes(params);

export const generateGapAnalysis: typeof claudeGapAnalysis.generateGapAnalysis = (params) =>
  resolveProvider() === "gemini" ? geminiGapAnalysis.generateGapAnalysis(params) : claudeGapAnalysis.generateGapAnalysis(params);

export const generateExecutiveSummary: typeof claudeExecutiveSummary.generateExecutiveSummary = (input) =>
  resolveProvider() === "gemini"
    ? geminiExecutiveSummary.generateExecutiveSummary(input)
    : claudeExecutiveSummary.generateExecutiveSummary(input);
