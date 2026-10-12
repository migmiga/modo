import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "danger" | "success";

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
  roundedClassName = "rounded-badge",
  colorClassName,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
  /** Overrides the pill radius for one instance (e.g. the note tags, which
   *  want 6px instead of the default full-pill) — kept separate from the
   *  base className so there's never two conflicting `rounded-*` utilities
   *  in the same className at once; cn() is a plain string join, not
   *  tailwind-merge, so that would be undefined. */
  roundedClassName?: string;
  /** Replaces (not appends to) the tone's own bg/text classes — e.g. a
   *  per-tag pastel color. Same reasoning as roundedClassName: this swaps
   *  the whole color pair out instead of layering a second one on top of
   *  `tones[tone]`. */
  colorClassName?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral: "bg-accent/5 text-muted",
    accent: "bg-accent/10 text-accent",
    danger: "bg-transparent text-foreground border border-danger",
    success: "bg-success/10 text-success",
  };

  return (
    <span
      title={title}
      className={cn(roundedClassName, "px-2.5 py-1 text-xs font-medium", colorClassName ?? tones[tone], className)}
    >
      {children}
    </span>
  );
}
