"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { TaskCardBody, type TaskCardData } from "./task-card-body";
import { useTaskActions, useTaskChecklistToggle } from "./use-task-list-actions";

export interface TaskListItem extends TaskCardData {
  id: string;
}

function TaskRow({ task }: { task: TaskListItem }) {
  const t = useTranslations("business.tasks");
  const { isPending, errorMessage, complete, dismiss } = useTaskActions(task.id);
  const {
    pendingIndex: checklistPendingIndex,
    errorMessage: checklistErrorMessage,
    toggle: toggleChecklistItem,
  } = useTaskChecklistToggle(task.id);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <TaskCardBody
          task={task}
          onToggleChecklistItem={toggleChecklistItem}
          checklistPendingIndex={checklistPendingIndex}
        />

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {checklistErrorMessage && (
          <p className="text-sm text-destructive">{checklistErrorMessage}</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => {
              complete();
            }}
          >
            {t("completeButton")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              dismiss();
            }}
          >
            {t("dismissButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskList({
  tasks,
  showTitle = true,
}: {
  tasks: TaskListItem[];
  showTitle?: boolean;
}) {
  const t = useTranslations("business.tasks");

  return (
    <div className="flex max-w-md flex-col gap-4">
      {showTitle && <h2 className="text-lg font-semibold">{t("title")}</h2>}
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
