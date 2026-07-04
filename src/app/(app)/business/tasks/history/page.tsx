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

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  const locale = await getLocale();
  const historyItems = await resolveTaskHistory(supabase, business!.id, locale);
  const t = await getTranslations("business.tasks.history");

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
