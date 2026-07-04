"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { TaskCardBody, type TaskCardData } from "./task-card-body";

export interface TaskHistoryItem extends TaskCardData {
  id: string;
  status: "done" | "dismissed";
  resolvedAt: string;
  completedAtLabel: string | null;
}

const STATUS_BADGE_VARIANT: Record<TaskHistoryItem["status"], "secondary" | "outline"> = {
  done: "secondary",
  dismissed: "outline",
};

function TaskHistoryRow({ task }: { task: TaskHistoryItem }) {
  const t = useTranslations("business.tasks.history");

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <TaskCardBody
          task={task}
          leadingBadge={<Badge variant={STATUS_BADGE_VARIANT[task.status]}>{t(`status.${task.status}`)}</Badge>}
        />
        {task.completedAtLabel && (
          <p className="text-xs text-muted-foreground">{t("completedAt", { date: task.completedAtLabel })}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskHistoryList({ tasks }: { tasks: TaskHistoryItem[] }) {
  const t = useTranslations("business.tasks.history");

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskHistoryRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
