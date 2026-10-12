"use client";

import { useState } from "react";

import { CelebrationStep } from "@/components/retro/CelebrationStep";
import { ConditionStep } from "@/components/retro/ConditionStep";
import { DayReviewStep } from "@/components/retro/DayReviewStep";
import { FeedbackStep } from "@/components/retro/FeedbackStep";
import { cn } from "@/lib/cn";
import type { ConditionLevel, Task, WorkloadChip } from "@/lib/types";

type FullStep = "condition" | "dayReview" | "feedback" | "celebrating";

// Fixed per-step modal heights — dayReview is deliberately absent: its task
// list's row count varies a lot (1-8 tasks), so it sizes to its own content
// instead of being pinned to one height (which either left dead space below
// a short list or clipped a long one). maxHeight (set below, alongside this)
// still caps it to the viewport.
const STEP_HEIGHT: Partial<Record<Exclude<FullStep, "celebrating">, number>> = {
  condition: 262,
  feedback: 460,
};
const CELEBRATION_HEIGHT = 364;

export function RetroModal({
  mode,
  isToday = true,
  completedTasks,
  incompleteTasks,
  onClose,
  onSubmitFull,
  onSubmitPartial,
}: {
  mode: "full" | "partial";
  /** False when this retro is about a past date (e.g. 어제) rather than
   *  today — swaps the "오늘은 어떠셨나요?"/"오늘 하루 되돌아보기" copy for a
   *  past-tense equivalent. Partial mode is always about a past date in
   *  practice, so it ignores this and keeps its existing copy either way. */
  isToday?: boolean;
  completedTasks: Task[];
  /** Present (and expected) only when mode === "partial". */
  incompleteTasks?: Task[];
  onClose: () => void;
  /** Invoked only when mode === "full". Returns the 0-based momo
   *  celebration-set index to show (see lib/store.ts's submitRetrospective),
   *  or null if the save wasn't counted as a new submission. */
  onSubmitFull?: (answers: {
    condition: ConditionLevel;
    workloadChip: WorkloadChip;
    satisfactionRating: 1 | 2 | 3 | 4 | 5;
    freeText: string | null;
  }) => number | null;
  /** Invoked only when mode === "partial". */
  onSubmitPartial?: (answers: {
    workloadChip: WorkloadChip;
    satisfactionRating: 1 | 2 | 3 | 4 | 5;
    freeText: string | null;
  }) => void;
}) {
  const [step, setStep] = useState<FullStep>(mode === "full" ? "condition" : "dayReview");
  const [condition, setCondition] = useState<ConditionLevel | null>(null);
  const [workloadChip, setWorkloadChip] = useState<WorkloadChip | null>(null);
  const [satisfactionRating, setSatisfactionRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [freeText, setFreeText] = useState("");
  const [momoSetIndex, setMomoSetIndex] = useState(0);

  function handleSubmitFull() {
    if (!condition || !workloadChip || satisfactionRating === 0) return;
    const text = freeText.trim() === "" ? null : freeText;
    let result: number | null;
    try {
      result = onSubmitFull?.({ condition, workloadChip, satisfactionRating, freeText: text }) ?? null;
    } catch {
      // Save failed — stay on the feedback step rather than showing the
      // celebration screen for a retrospective that was never recorded.
      return;
    }
    setMomoSetIndex(result ?? 0);
    setStep("celebrating");
  }

  function handleSubmitPartial() {
    if (!workloadChip || satisfactionRating === 0) return;
    const text = freeText.trim() === "" ? null : freeText;
    onSubmitPartial?.({ workloadChip, satisfactionRating, freeText: text });
  }

  const stepCount = mode === "full" ? 3 : 2;
  const stepIndex =
    step === "condition" ? 0 : step === "dayReview" ? (mode === "full" ? 1 : 0) : mode === "full" ? 2 : 1;
  const height = step === "celebrating" ? CELEBRATION_HEIGHT : STEP_HEIGHT[step];
  const stepTitle =
    step === "condition"
      ? isToday
        ? "오늘은 어떠셨나요?"
        : "그날은 어떠셨나요?"
      : step === "dayReview"
        ? mode === "full" && isToday
          ? "오늘 하루 되돌아보기"
          : "지난 하루 되돌아보기"
        : step === "feedback"
          ? "피드백"
          : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div
        className="flex w-full max-w-[448px] flex-col rounded-[16px] bg-surface p-6 shadow-pop"
        style={{ height, maxHeight: "calc(100vh - 32px)" }}
      >
        {stepTitle !== null && (
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-xl font-medium">{stepTitle}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-sm text-muted outline-none transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              ✕
            </button>
          </div>
        )}

        <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", stepTitle !== null && "mt-5")}>
          {step === "condition" && (
            <ConditionStep
              value={condition}
              onChange={setCondition}
              onNext={() => setStep("dayReview")}
              stepIndex={stepIndex}
              stepCount={stepCount}
            />
          )}

          {step === "dayReview" && (
            <DayReviewStep
              mode={mode}
              completedTasks={completedTasks}
              incompleteTasks={mode === "partial" ? incompleteTasks ?? [] : undefined}
              workloadChip={workloadChip}
              onWorkloadChipChange={setWorkloadChip}
              onBack={mode === "full" ? () => setStep("condition") : undefined}
              onNext={() => setStep("feedback")}
              stepIndex={stepIndex}
              stepCount={stepCount}
            />
          )}

          {step === "feedback" && (
            <FeedbackStep
              mode={mode}
              satisfactionRating={satisfactionRating}
              onSatisfactionRatingChange={setSatisfactionRating}
              freeText={freeText}
              onFreeTextChange={setFreeText}
              onBack={() => setStep("dayReview")}
              onSubmit={mode === "full" ? handleSubmitFull : handleSubmitPartial}
              stepIndex={stepIndex}
              stepCount={stepCount}
            />
          )}

          {step === "celebrating" && <CelebrationStep onClose={onClose} momoSetIndex={momoSetIndex} />}
        </div>
      </div>
    </div>
  );
}
