"use client";

import { PlanStatsRow } from "@/components/goal/PlanStatsRow";
import { PlanTaskTimeline } from "@/components/goal/PlanTaskTimeline";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { enumerateDates, formatShortDate } from "@/lib/dateUtils";
import type { DraftPlan } from "@/lib/store";

export type PreviewStatus = "empty" | "loading" | "ready";

export function PlanPreviewPanel({
  status,
  draftPlan,
  onEditInputs,
  onEditPlan,
  onApply,
}: {
  status: PreviewStatus;
  draftPlan: DraftPlan | null;
  onEditInputs: () => void;
  onEditPlan: () => void;
  onApply: () => void;
}) {
  if (status === "loading") {
    return (
      <Card
        dataLd="card-ai-planner-preview"
        className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-5 text-center lg:h-full lg:min-h-0"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-muted">목표에 맞는 계획을 만들고 있어요.</p>
      </Card>
    );
  }

  if (status !== "ready" || !draftPlan) {
    return (
      <Card
        dataLd="card-ai-planner-preview"
        className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-5 text-center lg:h-full lg:min-h-0"
      >
        <p className="text-sm text-muted">아직 만들어진 계획이 없어요.</p>
        <p className="text-sm text-muted">목표와 현재 상황을 입력하고 계획을 만들어보세요.</p>
      </Card>
    );
  }

  const { goal, tasks } = draftPlan;
  // 선택한 전체 기간을 기준으로 날짜를 세서, Task가 0개인 날이 있어도
  // "총 계획일"/Timeline 날짜 수가 항상 시작일~목표일 범위와 일치하게 한다.
  const dates = enumerateDates(goal.start_date, goal.target_date);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.duration_minutes, 0);

  return (
    <Card dataLd="card-ai-planner-preview" className="flex flex-col space-y-5 p-5 lg:h-full lg:min-h-0">
      <div className="space-y-2 border-b border-border pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium" data-amp-mask="">
            {goal.title}
          </h2>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-badge border-[1.5px] border-deep-sapphire bg-transparent px-2.5 py-1 text-xs font-medium text-deep-sapphire">
            AI가 만든 계획
          </span>
        </div>
        <p className="text-sm text-muted">
          {formatShortDate(goal.start_date)} ~ {formatShortDate(goal.target_date)} · 평일{" "}
          {goal.weekday_minutes}분 · 주말 {goal.weekend_minutes}분
        </p>

        {goal.context_text && (
          <div className="mt-2 rounded-btn bg-accent/5 px-3 py-2">
            <p className="text-xs font-medium text-muted">계획 기준</p>
            <p className="mt-0.5 text-sm leading-snug text-foreground">{goal.context_text}</p>
          </div>
        )}
      </div>

      <PlanStatsRow totalDays={dates.length} totalMinutes={totalMinutes} taskCount={tasks.length} />

      <PlanTaskTimeline startDate={goal.start_date} targetDate={goal.target_date} tasks={tasks} />

      <div className="space-y-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onEditInputs}
          className="block text-sm text-muted underline lg:hidden"
        >
          입력 내용 수정
        </button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            hoverClassName="hover:bg-foreground/5"
            onClick={onEditPlan}
            className="flex-1"
          >
            수정하기
          </Button>
          <Button onClick={onApply} className="flex-1">
            적용하기
          </Button>
        </div>
      </div>
    </Card>
  );
}
