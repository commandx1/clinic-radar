import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

import { resolveOpenTasks } from "../resolve-open-tasks";
import { TaskList } from "../task-list";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // business sorgusu, locale ve çeviriler birbirinden bağımsız — tek turda paralel çalıştır.
  const [{ data: business }, locale, t] = await Promise.all([
    supabase.from("businesses").select("id").eq("user_id", user!.id).maybeSingle(),
    getLocale(),
    getTranslations("business.tasks.history"),
  ]);
  const taskListItems = await resolveOpenTasks(supabase, business!.id, locale);

  return (
    <div className="flex flex-col gap-4">
      <TaskList tasks={taskListItems} />
      <Link
        href="/business/tasks/history"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("viewHistory")}
      </Link>
    </div>
  );
}
