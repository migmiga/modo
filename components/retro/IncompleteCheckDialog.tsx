import { Button } from "@/components/ui/Button";
import { formatDisplayDate } from "@/lib/dateUtils";
import type { Task } from "@/lib/types";

export function IncompleteCheckDialog({
  overdueTasks,
  onConfirmCompleted,
  onStillRemaining,
}: {
  overdueTasks: Task[];
  onConfirmCompleted: () => void;
  onStillRemaining: () => void;
}) {
  const sorted = [...overdueTasks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="space-y-1">
          <h2 className="text-base font-medium">완료하지 않은 할 일이 있어요</h2>
          <p className="text-sm text-muted">실제로 완료했지만 체크하지 않은 할 일이 있나요?</p>
        </div>

        <ul className="max-h-[200px] space-y-2 overflow-y-auto">
          {sorted.map((task) => (
            <li
              key={task.task_id}
              className="rounded-card border border-border bg-surface px-3 py-2.5"
            >
              <p className="text-sm leading-snug" data-amp-mask="">
                {task.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDisplayDate(task.scheduled_date)}</p>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Button variant="header" onClick={onStillRemaining} className="flex-1">
            아직 남아있어요
          </Button>
          <Button onClick={onConfirmCompleted} className="flex-1">
            완료했어요
          </Button>
        </div>
      </div>
    </div>
  );
}
