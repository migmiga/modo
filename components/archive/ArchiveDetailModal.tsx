"use client";

import { useEffect, useRef } from "react";

import { PlanStatsRow } from "@/components/goal/PlanStatsRow";
import { PlanTaskTimeline } from "@/components/goal/PlanTaskTimeline";
import { Button } from "@/components/ui/Button";
import { enumerateDates, formatShortDate } from "@/lib/dateUtils";
import { calcProgress } from "@/lib/progress";
import type { ArchivedPlan } from "@/lib/types";

export function ArchiveDetailModal({
  plan,
  onClose,
  onUseAsReference,
}: {
  plan: ArchivedPlan | null;
  onClose: () => void;
  onUseAsReference: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (plan) backdropRef.current?.focus();
  }, [plan]);

  if (!plan) return null;

  const { goal, tasks } = plan;
  const dates = enumerateDates(goal.start_date, goal.target_date);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);
  const isCompleted = calcProgress(tasks) === 100;

  return (
    <div
      ref={backdropRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 outline-none"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">계획 상세</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-muted hover:text-foreground"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-badge bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-muted">
              {plan.category}
            </span>
            {isCompleted && (
              <span className="rounded-badge bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                완료
              </span>
            )}
          </div>
          <h3 className="text-lg font-medium" data-amp-mask="">
            {goal.title}
          </h3>
          <p className="text-sm text-muted">
            {formatShortDate(goal.start_date)} ~ {formatShortDate(goal.target_date)} · 평일{" "}
            {goal.weekday_minutes}분 · 주말 {goal.weekend_minutes}분
          </p>
        </div>

        <hr className="my-4 border-border" />

        <PlanStatsRow totalDays={dates.length} totalMinutes={totalMinutes} taskCount={tasks.length} />

        <hr className="my-4 border-border" />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlanTaskTimeline startDate={goal.start_date} targetDate={goal.target_date} tasks={tasks} />
        </div>

        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            닫기
          </Button>
          <Button onClick={onUseAsReference} className="flex-1">
            이 계획으로 새 계획 만들기
          </Button>
        </div>
      </div>
    </div>
  );
}
