"use client";

import { cn } from "@/lib/cn";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSolid"
  | "header"
  | "sapphire"
  | "sapphireSolid"
  | "blueOutline"
  | "outlineBlue"
  | "outlineGray";
type Size = "md" | "sm" | "icon" | "xs";

export function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  onClick,
  className,
  hoverClassName,
  title,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Overrides just the variant's hover/active state for this one instance
   *  (e.g. a gray hover on an otherwise-default secondary button) — kept
   *  separate from `variants[variant]` so there's never two conflicting
   *  `hover:bg-*` utilities in the same className at once; cn() is a plain
   *  string join, not tailwind-merge, so that would be undefined. */
  hoverClassName?: string;
  /** Native tooltip — e.g. an icon-only Button's hover hint. */
  title?: string;
  "aria-label"?: string;
}) {
  // disabled:cursor-not-allowed is color-independent and universal — stays
  // shared. disabled:opacity-40 moved into each variant's own `base` instead
  // (see `sapphire` below for why: it defines its own distinct disabled
  // colors and must not also be dimmed by a blanket opacity rule). Font size
  // lives per-`size` (below), not here, so `xs` can use its own 12px without
  // ever having two conflicting `text-*` utilities in the same className.
  const base = "inline-flex items-center justify-center rounded-btn font-medium transition active:scale-[0.98] disabled:cursor-not-allowed";

  const sizes: Record<Size, string> = {
    md: "px-4 py-3 text-sm",
    sm: "px-4 py-2 text-sm",
    // Square, icon-only — e.g. the replan screen's "+" placement button,
    // which sits next to a flex-1 labeled button rather than stretching
    // itself.
    icon: "h-9 w-9 shrink-0 p-0 text-sm",
    // 12px text, 6px/12px padding, fixed 32px visual height — the replan
    // screen's overdue-task-card action buttons. `h-8` pins the exact 32px
    // regardless of line-height/border rounding, so the number is precise.
    xs: "h-8 px-3 py-1.5 text-xs",
  };

  const variants: Record<Variant, { base: string; hover: string }> = {
    // Hover/active darken (never brighten) toward black — one step each —
    // per the interaction rule for every solid violet primary button.
    primary: {
      base: "bg-accent-strong text-accent-foreground disabled:opacity-40",
      hover: "hover:brightness-95 active:brightness-90",
    },
    secondary: {
      base: "bg-transparent text-foreground border border-border disabled:opacity-40",
      hover: "hover:bg-accent/5",
    },
    ghost: { base: "text-muted disabled:opacity-40", hover: "hover:text-foreground" },
    danger: {
      base: "bg-transparent text-foreground border border-danger disabled:opacity-40",
      hover: "hover:bg-accent/5",
    },
    // Solid red — distinct from `danger` above (which stays Tangerine/
    // outline, still used elsewhere, e.g. the 계획 폐기 button). This one is
    // for an actual delete action (archive 선택 모드 삭제 button): a true
    // red (#DC2626/#B91C1C), not the app's Tangerine accent. Disabled gets
    // its own light-fill colors rather than a dimmed opacity version, same
    // reasoning as `sapphire` below.
    dangerSolid: {
      base: "bg-[#DC2626] text-white border border-[#DC2626] disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:bg-[#F5F5F5] disabled:text-[#A3A3A3]",
      hover: "hover:bg-[#B91C1C] hover:border-[#B91C1C]",
    },
    // Same border/text as `secondary`, but filled white — used for the
    // 도움말/취소 buttons that sit in the breadcrumb/header action slot
    // (AppHeader), which otherwise blend into that bar's own background.
    // Kept as its own variant (not a `secondary` change) so body buttons
    // using `secondary` — e.g. the archive 취소/replan 취소 — are unaffected.
    header: {
      base: "bg-canvas-white text-foreground border border-border disabled:opacity-40",
      hover: "hover:bg-paper-mist",
    },
    // Deep Sapphire filled — a second, visually "Primary"-weight CTA fill
    // distinct from the app's shared `primary` (Midnight Ink). Used only for
    // the 계획 수정하기 날짜 카드's 재조정 button, which needs to outrank its
    // neighboring 계획 추가 button without claiming the app's one black CTA
    // color. Not applied anywhere else. Disabled gets its own light-fill
    // colors (not a dimmed/opacity version of the active fill) — that's why
    // disabled:opacity-40 is deliberately absent here.
    sapphire: {
      base: "bg-deep-sapphire text-canvas-white disabled:bg-[#DBEAFE] disabled:text-[#64748B]",
      hover: "hover:brightness-95 active:brightness-90",
    },
    // Same Deep Sapphire fill as `sapphire`, but with an exact-hex hover
    // (#1E3A8A) instead of a brightness filter — used for the timeline's
    // 완료하기 button, which asked for that literal hover color rather than
    // a derived one. Kept separate so `sapphire`'s own brightness-based
    // hover (재조정 button) is untouched.
    sapphireSolid: {
      base: "bg-[#1E40AF] text-white",
      hover: "hover:bg-[#1E3A8A]",
    },
    // Light-blue outline — the timeline's 마저하기 (resume) button: a softer
    // stand-in for the app's one black Primary fill, so it doesn't compete
    // with 완료하기 sitting right next to it.
    blueOutline: {
      base: "bg-[#EFF6FF] text-accent border border-[#BFDBFE]",
      hover: "hover:bg-[#DBEAFE] hover:border-[#93C5FD]",
    },
    // White bg + blue text/border — the replan overdue-card's "계획에 넣기"
    // button: reads as the primary action (blue) without adding another
    // solid-filled button to a screen that already has several (unlike
    // `blueOutline` above, which is filled light-blue — this one is white).
    outlineBlue: {
      base: "bg-canvas-white text-accent border border-[#93C5FD] disabled:opacity-40",
      hover: "hover:bg-[#EFF6FF]",
    },
    // White bg + neutral gray text/border — the replan overdue-card's
    // "일정에서 제외" button, kept clearly secondary next to outlineBlue.
    outlineGray: {
      base: "bg-canvas-white text-steel border border-border disabled:opacity-40",
      hover: "hover:bg-paper-mist",
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        base,
        sizes[size],
        variants[variant].base,
        hoverClassName ?? variants[variant].hover,
        className
      )}
    >
      {children}
    </button>
  );
}
