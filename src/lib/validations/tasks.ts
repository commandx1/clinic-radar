import { z } from "zod";

// Kullanıcı sadece open→done ya da open→dismissed yapabilir — dismissed'ten
// open'a otomatik geri dönüş (mention_count 2x artışı) sistemsel bir kural
// (bkz. docs/02-business-rules.md Bölüm E), bu uçtan tetiklenmiyor.
export const updateTaskStatusSchema = z.object({
  status: z.enum(["done", "dismissed"]),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
