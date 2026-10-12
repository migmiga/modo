import { IconCheck } from "@tabler/icons-react";

import { cn } from "@/lib/cn";

// Badge is 20×20px (h-5 w-5, already uniform across all three states — see
// the shared className below). 14×14 IconCheck is the guideline for a 24px
// badge; scaled proportionally down for this 20px one (14 * 20/24 ≈ 12).
const CHECK_ICON_SIZE = 12;

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: "목표 설정" },
  { step: 2, label: "계획 확인" },
  { step: 3, label: "계획 적용" },
];

export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = s.step < currentStep;
        const active = s.step === currentStep;

        return (
          <div key={s.step} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                  done && "bg-tangerine text-canvas-white",
                  active && "border-[1.5px] border-tangerine bg-tangerine/15 text-tangerine",
                  !done && !active && "border-[1.5px] border-smoke bg-canvas-white text-fog"
                )}
              >
                {done ? <IconCheck size={CHECK_ICON_SIZE} stroke={1.75} aria-hidden="true" /> : s.step}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active || done ? "text-foreground" : "text-muted"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
