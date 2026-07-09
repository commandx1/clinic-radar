import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

import { resolveTaskHistory } from "../../resolve-task-history";
import { TaskHistoryList } from "../../task-history-list";

export default async function TaskHistoryPage() {
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
  const historyItems = await resolveTaskHistory(supabase, business!.id, locale);

  return (
    <div className="flex flex-col gap-4">
      <TaskHistoryList tasks={historyItems} />
      <Link
        href="/business/tasks"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("viewOpenTasks")}
      </Link>
    </div>
  );
}
