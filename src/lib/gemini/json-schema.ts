import { z } from "zod";

// Gemini'nin responseJsonSchema alanı ham JSON Schema bekliyor — Zod v4'ün
// yerleşik z.toJSONSchema()'sı kullanılıyor, üçüncü parti bir paket
// gerekmiyor. $schema anahtarı Gemini için anlamsız, çıkarılıyor.
export function toGeminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}
