import { cn } from "@/lib/cn";

export function StepIndicator({ stepIndex, stepCount }: { stepIndex: number; stepCount: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: stepCount }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-full", i === stepIndex ? "bg-accent-strong" : "bg-border")}
        />
      ))}
    </div>
  );
}
