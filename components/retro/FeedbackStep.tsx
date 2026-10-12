"use client";

import { useState } from "react";
import { IconStarFilled } from "@tabler/icons-react";

import { RetroNavButton } from "@/components/retro/RetroNavButton";
import { StepIndicator } from "@/components/retro/StepIndicator";
import { Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function FeedbackStep({
  mode,
  satisfactionRating,
  onSatisfactionRatingChange,
  freeText,
  onFreeTextChange,
  onBack,
  onSubmit,
  stepIndex,
  stepCount,
}: {
  mode: "full" | "partial";
  satisfactionRating: number;
  onSatisfactionRatingChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  freeText: string;
  onFreeTextChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  stepIndex: number;
  stepCount: number;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayedRating = hoverRating || satisfactionRating;
  const satisfactionQuestion =
    mode === "full" ? "오늘의 AI 계획은 전반적으로 만족스러웠나요?" : "AI 계획은 전반적으로 만족스러웠나요?";
  const canSubmit = satisfactionRating > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto">
        <div className="space-y-3">
          <p className="text-sm font-medium">{satisfactionQuestion}</p>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {STAR_VALUES.map((v) => {
              const filled = v <= displayedRating;
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`${v}점`}
                  aria-pressed={satisfactionRating === v}
                  onMouseEnter={() => setHoverRating(v)}
                  onClick={() => onSatisfactionRatingChange(v)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center transition",
                    filled ? "text-[#FB923C]" : "text-ash"
                  )}
                >
                  <IconStarFilled size={30} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">MODO를 사용하면서 불편하거나 개선되었으면 하는 점이 있나요?</p>
            <p className="text-xs text-muted-subtle">AI 계획, 작업 실행, 일정 재조정 등 자유롭게 의견을 남겨주세요</p>
          </div>
          <Textarea
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            borderClassName="border border-ash"
            className="h-36 w-full resize-none"
            placeholder="예) 계획에 배정된 작업 시간이 조금 부족했어요."
          />
        </div>
      </div>

      <div className="mt-5 flex shrink-0 items-center justify-between">
        <StepIndicator stepIndex={stepIndex} stepCount={stepCount} />
        <div className="flex shrink-0 items-center gap-2">
          <RetroNavButton variant="secondary" onClick={onBack}>
            이전
          </RetroNavButton>
          <RetroNavButton onClick={onSubmit} disabled={!canSubmit}>
            완료
          </RetroNavButton>
        </div>
      </div>
    </div>
  );
}
