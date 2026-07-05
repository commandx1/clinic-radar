import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { updateTaskChecklistSchema, updateTaskStatusSchema } from "@/lib/validations/tasks";

interface ChecklistItem {
  tr: string;
  en: string;
  done: boolean;
}

function isChecklistItem(value: unknown): value is ChecklistItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ChecklistItem).tr === "string" &&
    typeof (value as ChecklistItem).en === "string" &&
    typeof (value as ChecklistItem).done === "boolean"
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();

  // Checklist adımı tiklemek ayrı bir alan seti kullanır (checklistIndex/done),
  // status alanıyla karışmaz — hangi şemaya uyduğuna göre dallanıyoruz.
  const checklistParsed = updateTaskChecklistSchema.safeParse(body);
  if (checklistParsed.success) {
    return handleChecklistUpdate(supabase, id, checklistParsed.data);
  }

  const parsed = updateTaskStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      completed_at: parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ task: updated });
}

async function handleChecklistUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  input: { checklistIndex: number; done: boolean },
) {
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("checklist_i18n, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch task for checklist update:", fetchError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const checklist = Array.isArray(existing.checklist_i18n) ? existing.checklist_i18n : [];
  if (input.checklistIndex >= checklist.length || !isChecklistItem(checklist[input.checklistIndex])) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const updatedChecklist = checklist.map((item, index) =>
    index === input.checklistIndex ? { ...(item as unknown as ChecklistItem), done: input.done } : item,
  );

  // Checklist-status senkronu (bkz. docs/10-roadmap.md Faz 1.2 bilinen kısıt):
  // tüm alt adımlar bittiğinde görev otomatik "done" olur ve north star metriğine
  // (haftalık tamamlanan görev) yansır. Kullanıcı bir adımı geri açarsa ve görev
  // sadece bu otomasyonla "done" olduysa (dismissed asla otomatik dokunulmaz),
  // görev "open"a geri döner ki checklist ile status arasındaki tutarsızlık
  // kullanıcıyı yanıltmasın.
  const allDone = updatedChecklist.length > 0 && updatedChecklist.every((item) => isChecklistItem(item) && item.done);
  const statusUpdate: { status?: "open" | "done"; completed_at?: string | null } = {};
  if (allDone && existing.status === "open") {
    statusUpdate.status = "done";
    statusUpdate.completed_at = new Date().toISOString();
  } else if (!allDone && existing.status === "done") {
    statusUpdate.status = "open";
    statusUpdate.completed_at = null;
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({ checklist_i18n: updatedChecklist, ...statusUpdate })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to update task checklist:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ task: updated });
}
