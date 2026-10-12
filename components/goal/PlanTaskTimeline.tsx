import { cn } from "@/lib/cn";
import { enumerateDates, formatDisplayDate } from "@/lib/dateUtils";
import type { Task } from "@/lib/types";

// Shared "time column" for both the day-total (header row) and each Task's
// duration (task row) — same fixed width, same left-aligned text, same
// built-in trailing gap. The header row has no horizontal padding of its
// own; the task-list box's rows do (`pl-3` below, intentionally with no
// matching `pr-3` — see note at the task row). Giving both rows' content
// box the SAME right edge (just `column.right`, unpadded) and then using
// this identical column for both is what makes the two sets of numbers
// share one left-aligned start point AND one right-hand gap, instead of
// one-off margins tuned per row.
const TIME_COLUMN_CLASSNAME = "w-14 shrink-0 pr-3 text-left text-xs tabular-nums";

export function PlanTaskTimeline({
  startDate,
  targetDate,
  tasks,
}: {
  startDate: string;
  targetDate: string;
  tasks: Task[];
}) {
  const dates = enumerateDates(startDate, targetDate);

  return (
    // scrollbar-gutter reserves this container's own scrollbar space up
    // front, so the right-aligned day-total/task-duration columns above
    // don't jitter sideways if the task list grows enough to need internal
    // scrolling partway through.
    <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:[scrollbar-gutter:stable]">
      {dates.map((date, dayIndex) => {
        const isLast = dayIndex === dates.length - 1;
        const dayTasks = tasks
          .filter((t) => t.scheduled_date === date)
          .sort((a, b) => a.order - b.order);
        const total = dayTasks.reduce((sum, t) => sum + t.duration_minutes, 0);

        return (
          <div key={date} className="flex gap-5">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-medium text-accent">
                {dayIndex + 1}
              </span>
              {!isLast && <div className="mt-1 w-px flex-1 bg-accent/20" />}
            </div>

            <div className={cn("flex-1 space-y-2", !isLast && "pb-4")}>
              <div className="flex items-baseline gap-3 pt-1">
                <h4 className="flex-1 text-sm font-medium">{formatDisplayDate(date)}</h4>
                <span className={cn(TIME_COLUMN_CLASSNAME, "text-muted")}>{total}분</span>
              </div>

              {dayTasks.length > 0 ? (
                <div className="divide-y divide-border rounded-card border border-border">
                  {dayTasks.map((task, taskIndex) => {
                    const isCompleted = task.status === "completed";
                    const isCancelled = task.status === "cancelled";

                    return (
                      // pl-3 only (no pr-3) — the trailing gap before the
                      // border is reserved by TIME_COLUMN_CLASSNAME's own
                      // pr-3 instead, so this row's content box has the same
                      // right edge (column.right, unpadded) as the header
                      // row above it. That's what makes the two time
                      // columns land on the same left x and the same
                      // right-hand gap without a one-off margin.
                      <div key={task.task_id} className="flex items-center gap-3 py-2 pl-3 text-sm">
                        <span
                          className={cn(
                            "w-5 shrink-0 text-xs tabular-nums",
                            isCompleted ? "text-accent" : "text-muted"
                          )}
                        >
                          {isCompleted ? "✓" : String(taskIndex + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={cn(
                            "flex-1 leading-snug",
                            isCancelled && "text-muted line-through"
                          )}
                          data-amp-mask=""
                        >
                          {task.title}
                        </span>
                        <span className={cn(TIME_COLUMN_CLASSNAME, isCancelled ? "text-muted/60" : "text-muted")}>
                          {task.duration_minutes}분
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted">예정된 할 일이 없어요.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
