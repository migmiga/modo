"use client";

import { RetroNavButton } from "@/components/retro/RetroNavButton";
import { StepIndicator } from "@/components/retro/StepIndicator";
import { TaskCard } from "@/components/retro/TaskCard";
import { cn } from "@/lib/cn";
import type { Task, WorkloadChip } from "@/lib/types";

const WORKLOAD_CHIPS: { value: WorkloadChip; label: string }[] = [
  { value: "very_low", label: "매우 적었어요" },
  { value: "low", label: "조금 적었어요" },
  { value: "appropriate", label: "적절했어요" },
  { value: "high", label: "조금 많았어요" },
  { value: "very_high", label: "매우 많았어요" },
];

export function DayReviewStep({
  mode,
  completedTasks,
  incompleteTasks,
  workloadChip,
  onWorkloadChipChange,
  onBack,
  onNext,
  stepIndex,
  stepCount,
}: {
  mode: "full" | "partial";
  completedTasks: Task[];
  /** Present (and expected) only when mode === "partial". */
  incompleteTasks?: Task[];
  workloadChip: WorkloadChip | null;
  onWorkloadChipChange: (v: WorkloadChip) => void;
  onBack?: () => void;
  onNext: () => void;
  stepIndex: number;
  stepCount: number;
}) {
  const workloadQuestion = mode === "full" ? "오늘 계획의 작업량은 적절했나요?" : "계획의 작업량은 적절했나요?";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto">
        {mode === "full" ? (
          <FullTaskSection tasks={completedTasks} />
        ) : (
          <PartialTaskSection completedTasks={completedTasks} incompleteTasks={incompleteTasks ?? []} />
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">{workloadQuestion}</p>
          <div className="flex flex-wrap gap-2">
            {WORKLOAD_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={workloadChip === chip.value}
                onClick={() => onWorkloadChipChange(chip.value)}
                className={cn(
                  "flex h-8 w-[94px] items-center justify-center whitespace-nowrap rounded-badge border border-transparent px-1.5 text-xs font-medium tracking-tight transition",
                  workloadChip === chip.value
                    ? "bg-accent text-white hover:brightness-95"
                    : "bg-ash text-foreground hover:bg-smoke"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-11 flex shrink-0 items-center justify-between">
        <StepIndicator stepIndex={stepIndex} stepCount={stepCount} />
        <div className="flex shrink-0 items-center gap-2">
          {onBack && (
            <RetroNavButton variant="secondary" onClick={onBack}>
              이전
            </RetroNavButton>
          )}
          <RetroNavButton onClick={onNext} disabled={!workloadChip}>
            다음
          </RetroNavButton>
        </div>
      </div>
    </div>
  );
}

// Single completed-task list, laid out column-major across up to two 194px
// columns (left gets ceil(n/2), matching the spec's worked examples for
// 5/6/7/8 tasks). The right column is simply omitted when empty rather than
// rendered as a blank card.
function FullTaskSection({ tasks }: { tasks: Task[] }) {
  const leftCount = Math.ceil(tasks.length / 2);
  const left = tasks.slice(0, leftCount);
  const right = tasks.slice(leftCount);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-subtle">오늘 완료한 작업 · {tasks.length}개</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <TaskCard tasks={left} />
        {right.length > 0 && <TaskCard tasks={right} />}
      </div>
    </div>
  );
}

// Two distinct categories side by side, each its own card — unlike
// FullTaskSection's single-list column split, an empty category here still
// renders its card with an empty-state message instead of disappearing.
function PartialTaskSection({ completedTasks, incompleteTasks }: { completedTasks: Task[]; incompleteTasks: Task[] }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="space-y-2">
        <p className="text-xs text-muted-subtle">완료한 작업 · {completedTasks.length}개</p>
        <TaskCard tasks={completedTasks} emptyMessage="완료한 작업이 없어요" />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-subtle">완료하지 못한 작업 · {incompleteTasks.length}개</p>
        <TaskCard tasks={incompleteTasks} emptyMessage="완료하지 못한 작업이 없어요" />
      </div>
    </div>
  );
}
