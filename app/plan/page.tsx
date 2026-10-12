"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { cn } from "@/lib/cn";
import { dayBudgetFor, formatDisplayDate } from "@/lib/dateUtils";
import { useAppStore } from "@/lib/store";

export default function CurrentPlanPage() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const goal = useAppStore((s) => s.goal);
  const tasks = useAppStore((s) => s.tasks);

  useEffect(() => {
    if (!hydrated) return;
    if (!goal) router.replace("/dashboard");
  }, [hydrated, goal, router]);

  const dates = useMemo(() => {
    return Array.from(new Set(tasks.map((t) => t.scheduled_date))).sort();
  }, [tasks]);

  if (!hydrated || !goal) {
    return <LoadingScreen />;
  }

  return (
    <Container>
      <div className="flex flex-1 flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-lg font-medium" data-amp-mask="">
            {goal.title}
          </h1>
          <p className="text-sm text-muted">
            {formatDisplayDate(goal.start_date)} ~ {formatDisplayDate(goal.target_date)}
          </p>
        </div>

        <div className="space-y-5">
          {dates.map((date) => {
            const dayTasks = tasks
              .filter((t) => t.scheduled_date === date)
              .sort((a, b) => a.order - b.order);
            const total = dayTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
            const budget = dayBudgetFor(date, goal.weekday_minutes, goal.weekend_minutes);

            return (
              <div key={date} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-medium">{formatDisplayDate(date)}</h3>
                  <span className="text-xs text-muted">
                    {total}분 / {budget}분
                  </span>
                </div>
                <ul className="space-y-1">
                  {dayTasks.map((task) => (
                    <li
                      key={task.task_id}
                      className="flex items-center justify-between rounded-btn bg-accent/5 px-3 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          "leading-snug",
                          task.status === "completed" && "text-muted line-through"
                        )}
                        data-amp-mask=""
                      >
                        {task.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 pl-2">
                        {task.status === "completed" && <Badge tone="success">완료</Badge>}
                        {task.status === "cancelled" && <Badge tone="neutral">제외</Badge>}
                        <span className="text-xs text-muted">{task.duration_minutes}분</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </Container>
  );
}
