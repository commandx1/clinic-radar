// Faz 1.2 kalan iş: migration (20260708000000_tasks_checklist_i18n.sql)
// öncesi oluşturulmuş açık (`status = "open"`) görevlerde `checklist_i18n`
// null/boş kalıyor — bu görevlerde UI'da tıklanabilir alt adım listesi hiç
// görünmüyor. Bu script, mevcut görev başlığı/açıklaması/temasından AI
// pipeline'daki (`gap-analysis-schema.ts`) ile AYNI şemada (3-5 madde, hem tr
// hem en) tek seferlik bir checklist üretip yazar.
//
// DİKKAT: Bu bir migration değil, tek seferlik bakım scriptidir — üretim
// koduna dahil değildir, `npx tsx` ile elle çalıştırılır. Her satır bir AI
// çağrısı tetikler (gerçek maliyet); önce --dry-run ile kaç görev
// etkileneceğini görün.
//
// Kullanım:
//   npx tsx scripts/backfill-task-checklists.ts --dry-run
//   npx tsx scripts/backfill-task-checklists.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { bilingualTextSchema, type BilingualText } from "@/lib/ai-pipeline/gap-analysis-schema";
import { getClaudeClient, CLAUDE_MODEL } from "@/lib/claude/client";
import { createAdminClient } from "@/lib/supabase/admin";

// `.env.local`'i basit satır bazlı parse eder — repo'ya yeni bağımlılık
// (dotenv vb.) eklemeden. Zaten set edilmiş env değişkenlerinin üzerine yazmaz.
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key !== "" && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const checklistOnlySchema = z.object({
  checklist: z.array(bilingualTextSchema).min(3).max(5),
});

function buildPrompt(task: { title: unknown; description: unknown; theme: string | null }): string {
  const title = task.title as BilingualText | null;
  const description = task.description as BilingualText | null;
  return [
    "Aşağıdaki, bir klinik/işletme için zaten oluşturulmuş bir görev var. Bu görevi",
    "tamamlamak için 3-5 somut, uygulanabilir alt adımdan oluşan bir checklist üret.",
    "Her adım hem tr hem en olmalı, kısa ve doğrudan yapılabilir bir eylem cümlesi",
    'olmalı (ör. "Resepsiyon ekibine X konusunda kısa bir bilgilendirme yap"),',
    "soyut tavsiye olmamalı. Sadece belirtilen JSON şemasında yanıt ver.",
    "",
    `Görev başlığı (tr): ${title?.tr ?? "(bilinmiyor)"}`,
    `Görev açıklaması (tr): ${description?.tr ?? "(bilinmiyor)"}`,
    `Tema: ${task.theme ?? "(bilinmiyor)"}`,
  ].join("\n");
}

async function generateChecklistForTask(task: {
  title: unknown;
  description: unknown;
  theme: string | null;
}): Promise<BilingualText[] | null> {
  const client = getClaudeClient();
  const message = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      "Sen bir işletme danışmanısın. Var olan bir göreve, kullanıcının" +
      " atlamaması gereken somut alt adımlardan oluşan bir checklist üretiyorsun.",
    messages: [{ role: "user", content: buildPrompt(task) }],
    output_config: { format: zodOutputFormat(checklistOnlySchema) },
  });
  return message.parsed_output?.checklist ?? null;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const supabase = createAdminClient();

  // Boş/null checklist_i18n VE hâlâ açık olan görevler — dismissed/done
  // görevlerde geçmişe dönük checklist üretmenin bir faydası yok, kullanıcı
  // zaten o görevle ilgilenmiyor.
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title_i18n, description_i18n, theme, checklist_i18n")
    .eq("status", "open")
    .or("checklist_i18n.is.null,checklist_i18n.eq.[]");

  if (error) {
    console.error("Görevler okunamadı:", error.message);
    process.exitCode = 1;
    return;
  }

  const targets = tasks.filter((t) => {
    const checklist = t.checklist_i18n as unknown[] | null;
    return !checklist || checklist.length === 0;
  });

  console.warn(`${String(targets.length)} açık görevde checklist eksik.`);
  if (targets.length === 0) {
    return;
  }

  if (dryRun) {
    for (const t of targets) {
      const title = (t.title_i18n as BilingualText | null)?.tr ?? "(başlıksız)";
      console.warn(`  - [${t.id}] ${title} (tema: ${t.theme ?? "(bilinmiyor)"})`);
    }
    console.warn("--dry-run: hiçbir şey yazılmadı.");
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      const checklist = await generateChecklistForTask({
        title: t.title_i18n,
        description: t.description_i18n,
        theme: t.theme,
      });
      if (!checklist) {
        console.warn(`  [${t.id}] AI şema uyuşmadı, atlanıyor.`);
        failed += 1;
        continue;
      }
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ checklist_i18n: checklist.map((item) => ({ ...item, done: false })) })
        .eq("id", t.id);
      if (updateError) {
        console.warn(`  [${t.id}] yazılamadı: ${updateError.message}`);
        failed += 1;
        continue;
      }
      ok += 1;
      console.warn(`  [${t.id}] checklist yazıldı (${String(checklist.length)} adım).`);
    } catch (err) {
      failed += 1;
      console.warn(`  [${t.id}] hata: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.warn(`Bitti: ${String(ok)} güncellendi, ${String(failed)} başarısız/atlandı.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
