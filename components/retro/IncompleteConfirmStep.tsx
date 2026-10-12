"use client";

import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDisplayDate } from "@/lib/dateUtils";
import type { Task } from "@/lib/types";

export function IncompleteConfirmStep({
  overdueTasks,
  onBack,
  onClose,
  onConfirm,
}: {
  overdueTasks: Task[];
  onBack: () => void;
  onClose: () => void;
  onConfirm: (checkedTaskIds: string[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const sorted = [...overdueTasks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  function toggle(taskId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">실제로 완료한 할 일을 선택해주세요</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="relative flex h-6 w-6 items-center justify-center rounded-[6px] text-sm text-muted outline-none transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">선택하지 않은 작업은 미완료로 처리돼요.</p>

        <ul className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
          {sorted.map((task) => {
            const isChecked = checked.has(task.task_id);
            return (
              <li key={task.task_id}>
                <button
                  type="button"
                  onClick={() => toggle(task.task_id)}
                  className="flex w-full items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 text-left transition hover:bg-accent/5"
                >
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-input">
                    <span
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-input border transition",
                        isChecked ? "border-accent bg-accent" : "border-border bg-surface"
                      )}
                    />
                    {isChecked && (
                      <IconCheck
                        size={12}
                        strokeWidth={3}
                        aria-hidden="true"
                        className="pointer-events-none absolute text-white"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug">{task.title}</p>
                    <p className="text-xs text-muted">{formatDisplayDate(task.scheduled_date)}</p>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex gap-2">
          <Button variant="header" onClick={onBack} className="flex-1">
            뒤로
          </Button>
          <Button onClick={() => onConfirm([...checked])} className="flex-1">
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}
