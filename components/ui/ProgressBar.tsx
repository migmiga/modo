import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  tone = "accent",
}: {
  value: number;
  /** "accent" (default) keeps the existing Electric Blue style, used for
   *  completed plans. "neutral" is the gray style for incomplete plans —
   *  driven by actual completion status, not the progress number itself. */
  tone?: "accent" | "neutral";
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-badge",
        tone === "accent" ? "bg-accent/10" : "bg-ash"
      )}
    >
      <div
        className={cn(
          "h-full rounded-badge transition-all duration-300",
          tone === "accent" ? "bg-accent" : "bg-silver"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
