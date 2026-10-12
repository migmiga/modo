"use client";

import { RetroNavButton } from "@/components/retro/RetroNavButton";
import { StepIndicator } from "@/components/retro/StepIndicator";
import { cn } from "@/lib/cn";
import type { ConditionLevel } from "@/lib/types";

// Emoji stand in for the character art, which will be swapped in later —
// kept at the same 64x64px slot size the real art will occupy.
const CONDITIONS: { level: ConditionLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: "😣", label: "매우 나쁨" },
  { level: 2, emoji: "🙁", label: "나쁨" },
  { level: 3, emoji: "😐", label: "보통" },
  { level: 4, emoji: "🙂", label: "좋음" },
  { level: 5, emoji: "😄", label: "매우 좋음" },
];

export function ConditionStep({
  value,
  onChange,
  onNext,
  stepIndex,
  stepCount,
}: {
  value: ConditionLevel | null;
  onChange: (value: ConditionLevel) => void;
  onNext: () => void;
  stepIndex: number;
  stepCount: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center gap-3">
        {CONDITIONS.map((c) => (
          <button
            key={c.level}
            type="button"
            aria-label={c.label}
            aria-pressed={value === c.level}
            onClick={() => onChange(c.level)}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-card border text-2xl transition",
              value === c.level ? "border-[#93C5FD] bg-[#EFF6FF]" : "border-border bg-surface hover:bg-paper-mist"
            )}
          >
            <span aria-hidden="true">{c.emoji}</span>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between">
        <StepIndicator stepIndex={stepIndex} stepCount={stepCount} />
        <RetroNavButton onClick={onNext} disabled={value === null}>
          다음
        </RetroNavButton>
      </div>
    </div>
  );
}
