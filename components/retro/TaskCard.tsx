import { cn } from "@/lib/cn";
import type { Task } from "@/lib/types";

// Fixed 194px per DESIGN spec; full width on mobile (<sm) so the two-card row
// doesn't force horizontal overflow on narrow viewports (section 8's "모바일
// 1열 전환" — the row itself switches to flex-col there, see DayReviewStep).
const CARD_WIDTH = "w-full sm:w-[194px]";

export function TaskCard({ tasks, emptyMessage }: { tasks: Task[]; emptyMessage?: string }) {
  if (tasks.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div
        className={cn(
          "rounded-[12px] border border-ash bg-surface px-2 py-4 text-center text-xs text-muted",
          CARD_WIDTH
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={cn("overflow-hidden rounded-[12px] border border-ash bg-surface", CARD_WIDTH)}>
      {tasks.map((task, i) => (
        <li
          key={task.task_id}
          title={task.title}
          className={cn(
            "truncate px-2 py-2 text-xs text-foreground",
            i !== tasks.length - 1 && "border-b border-paper-mist"
          )}
          data-amp-mask=""
        >
          {task.title}
        </li>
      ))}
    </ul>
  );
}
