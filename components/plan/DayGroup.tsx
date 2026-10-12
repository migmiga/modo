"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { IconAlertCircle, IconChevronDown, IconChevronUp, IconPlus } from "@tabler/icons-react";

import { TaskRow } from "@/components/plan/TaskRow";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDisplayDate } from "@/lib/dateUtils";
import type { Task } from "@/lib/types";

// Same pattern as components/home/MemoTable.tsx's scroll list: a real
// scrollable element with its native scrollbar hidden visually (wheel/
// trackpad/touch/keyboard scrolling all keep working), plus floating
// up/down buttons shown only when there's somewhere to scroll to.
const SCROLLBAR_HIDDEN_CLASSNAME = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

// Visible by default (touch/no-hover devices) but, on a device that DOES
// support hover, hidden until the list is hovered/focused.
const SCROLL_BUTTON_VISIBILITY_CLASSNAME = cn(
  "opacity-100 pointer-events-auto transition-opacity",
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
  "[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto",
  "focus-visible:opacity-100 focus-visible:pointer-events-auto"
);

// The inverse of the above: a faint top/bottom fade that hints "there's
// more" while NOT hovering (hover-capable devices only — touch devices
// already show the always-on buttons, so the hint would be redundant there).
const EDGE_FADE_VISIBILITY_CLASSNAME = cn(
  "opacity-0 transition-opacity",
  "[@media(hover:hover)]:opacity-100",
  "[@media(hover:hover)]:group-hover:opacity-0"
);

// Fallback step size (title + stepper/미정 line + padding, roughly) used
// only before any TaskRow has actually rendered to measure from.
const TASK_ROW_FALLBACK_HEIGHT_PX = 84;
// Matches the list's own `space-y-2` (0.5rem) gap between rows.
const TASK_ROW_GAP_PX = 8;

// Selected/error card border — intentionally outside the Dub token system:
// these two exact colors are feature-specific (light 3px borders), not part
// of the shared palette, so they're kept local instead of adding global
// tokens for a one-component use.
//
// "Selected" is driven by CSS :focus-within (not React state) — the card
// has tabIndex so a plain click focuses it, and focus-within also holds
// true while a descendant (+/-/삭제 button) is focused, so interacting with
// the card's own controls doesn't flicker the selection off. Error always
// wins: when showMissingDurationError is true we render ERROR_BORDER_CLASSNAME
// outright, with no :focus-within rule in play at all.
const SELECTED_BORDER_CLASSNAME = "border border-border focus-within:border-[3px] focus-within:border-[#93BFFF]";
const ERROR_BORDER_CLASSNAME = "border-[3px] border-[#FCA5A5]";
// Error TEXT/ICON intentionally uses a true red (#DC2626), not the app's
// shared `danger` token — that token is aliased to Tangerine (the Accent
// color) app-wide, which this request calls out as the wrong role for an
// error message. Scoped to just this label rather than repointing `danger`
// everywhere else, which is out of scope here.
const ERROR_TEXT_CLASSNAME = "text-[#DC2626]";

interface DragState {
  taskId: string;
  pointerId: number;
}

// MVP 제약: 하루 최대 8개(lib/mockAi.ts의 MAX_TASKS_PER_DAY와 동일한 기준).
const MAX_TASKS_PER_DAY = 8;

export function DayGroup({
  date,
  tasks,
  budgetMinutes,
  isReconciling = false,
  reconcileError,
  showMissingDurationError = false,
  onReorder,
  onRemove,
  onRequestAdd,
  onChangeDuration,
  onRequestReconcile,
  registerRef,
  variant = "edit",
  needsReconcile = false,
  showErrorBorder = false,
  canPlaceOverdue = false,
  onRequestPlace,
  sessionPlacedTaskIds,
  onUndoTask,
}: {
  date: string;
  tasks: Task[];
  budgetMinutes: number;
  isReconciling?: boolean;
  reconcileError?: string | null;
  showMissingDurationError?: boolean;
  onReorder: (taskId: string, newIndex: number) => void;
  /** Optional since "replan" rows never render a remove affordance
   *  (trailingAction is "undo"/"none" there) — every "edit" caller already
   *  passes this. */
  onRemove?: (taskId: string) => void;
  onRequestAdd: (date: string) => void;
  onChangeDuration: (taskId: string, minutes: number) => void;
  onRequestReconcile: (date: string) => void;
  registerRef?: (date: string, el: HTMLDivElement | null) => void;
  /** "edit" (default, /goals/review) keeps every behavior below exactly as
   *  it was. "replan" (/replan's redesign) swaps the badge/border/footer
   *  behavior described on each prop below. */
  variant?: "edit" | "replan";
  /** "replan" only — drives the header's "재조정 필요" text badge,
   *  independent of the border (see showErrorBorder). Ignored in "edit". */
  needsReconcile?: boolean;
  /** "replan" only — drives the 3px red border. Independent of the badge
   *  so the border can appear only after a failed 완료 attempt while the
   *  badge stays up the whole time reconciliation is needed. Ignored in
   *  "edit" (which still uses showMissingDurationError for both). */
  showErrorBorder?: boolean;
  /** "replan" only — shows the icon-only "+" placement button in the
   *  footer when true; renders nothing in that slot when false (never a
   *  disabled button — the brief wants it absent, not greyed out). */
  canPlaceOverdue?: boolean;
  onRequestPlace?: (date: string) => void;
  /** "replan" only — task ids placed into this date during the current
   *  session; those rows get the undo arrow instead of the normal trash
   *  icon (pre-existing window tasks get neither, per the redesign's
   *  explicit "don't invent new deletion behavior for old tasks" scoping). */
  sessionPlacedTaskIds?: Set<string>;
  onUndoTask?: (taskId: string) => void;
}) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const total = sorted.reduce((sum, t) => sum + t.duration_minutes, 0);
  const over = total - budgetMinutes;
  const atCapacity = sorted.length >= MAX_TASKS_PER_DAY;
  const hasUndetermined = sorted.some((t) => t.duration_minutes <= 0);
  const isReplan = variant === "replan";
  const showBadge = isReplan ? needsReconcile : showMissingDurationError;
  const showBorder = isReplan ? showErrorBorder : showMissingDurationError;

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const borderClassName = showBorder ? ERROR_BORDER_CLASSNAME : SELECTED_BORDER_CLASSNAME;

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ up: false, down: false });

  // Tracks whether there's anything to scroll to in each direction — re-runs
  // on scroll, on the list's own size changing (card resized), and on its
  // content's size changing (Task added/removed, 미정 ↔ stepper row height
  // difference, etc.) — same approach as MemoTable's scroll list.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const up = el.scrollTop > 1;
      const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setCanScroll((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (listRef.current) observer.observe(listRef.current);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollByStep(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const sampleRow = rowRefs.current.values().next().value;
    const rowHeight = sampleRow?.getBoundingClientRect().height ?? TASK_ROW_FALLBACK_HEIGHT_PX;
    const step = rowHeight + TASK_ROW_GAP_PX;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // scrollBy clamps to the container's actual scrollable range on its own.
    el.scrollBy({ top: direction * step, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function handlePointerDown(taskId: string, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ taskId, pointerId: e.pointerId });
  }

  function handlePointerMove(taskId: string, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (!dragState || dragState.taskId !== taskId || dragState.pointerId !== e.pointerId) return;

    const others = sorted.filter((t) => t.task_id !== taskId);
    let newIndex = others.length;
    for (let i = 0; i < others.length; i += 1) {
      const rect = rowRefs.current.get(others[i].task_id)?.getBoundingClientRect();
      if (!rect) continue;
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY < midpoint) {
        newIndex = i;
        break;
      }
    }

    const currentIndex = sorted.findIndex((t) => t.task_id === taskId);
    if (newIndex !== currentIndex) {
      onReorder(taskId, newIndex);
    }
  }

  function handlePointerUp(taskId: string, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (dragState?.taskId === taskId) {
      setDragState(null);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      ref={(el) => registerRef?.(date, el)}
      tabIndex={-1}
      className={cn(
        // tabIndex=-1 keeps this out of normal Tab order (reachable by
        // click, or programmatically from handleDone's validation scroll).
        // focus-visible (not focus) so an ordinary click only shows the
        // colored border below — the outline ring is reserved for the
        // non-pointer case (keyboard/programmatic focus), drawn outside the
        // border (offset) so the two never visually merge into one.
        // lg+: locked to the calendar card's measured height (CSS var set
        // on the desktop grid container in app/goals/review/page.tsx), so
        // all 7 date cards — across both grid rows — share one exact
        // height instead of each shrinking/growing with its own Task
        // count. 420px fallback only covers the instant before that var is
        // set; min/max-h below still apply on mobile where there's no var.
        // lg:max-h-none cancels max-h-[60vh] from lg onward — otherwise a
        // short viewport or a 6-week month could clip the card below the
        // calendar's actual height, breaking the exact match.
        "flex min-h-[260px] max-h-[60vh] flex-col rounded-card bg-surface p-5 shadow-card transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:h-[var(--calendar-height-px,420px)] lg:max-h-none",
        borderClassName
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium">{formatDisplayDate(date)}</h3>
          <p className={cn("text-xs", over > 0 ? "text-danger" : "text-muted")}>
            {total}분 / {budgetMinutes}분
            {over > 0 && <span> · ▲ {over}분 초과</span>}
          </p>
        </div>
        {showBadge && (
          <span className={cn("flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium", ERROR_TEXT_CLASSNAME)}>
            <IconAlertCircle size={16} stroke={1.75} aria-hidden="true" />
            재조정 필요
          </span>
        )}
      </div>

      <div className="group relative mt-3 min-h-0 flex-1">
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="할 일 목록"
          className={cn("h-full w-full overflow-y-auto outline-none", SCROLLBAR_HIDDEN_CLASSNAME)}
        >
          <div ref={listRef} className="space-y-2">
            {sorted.map((task) => {
              const isSessionPlaced = isReplan && (sessionPlacedTaskIds?.has(task.task_id) ?? false);
              const trailingAction = !isReplan ? "remove" : isSessionPlaced ? "undo" : "none";
              return (
                <TaskRow
                  key={task.task_id}
                  title={task.title}
                  durationMinutes={task.duration_minutes}
                  isDragging={dragState?.taskId === task.task_id}
                  registerRef={(el) => {
                    if (el) rowRefs.current.set(task.task_id, el);
                    else rowRefs.current.delete(task.task_id);
                  }}
                  onHandlePointerDown={(e) => handlePointerDown(task.task_id, e)}
                  onHandlePointerMove={(e) => handlePointerMove(task.task_id, e)}
                  onHandlePointerUp={(e) => handlePointerUp(task.task_id, e)}
                  onRemove={() => onRemove?.(task.task_id)}
                  onChangeDuration={(minutes) => onChangeDuration(task.task_id, minutes)}
                  trailingAction={trailingAction}
                  onUndo={() => onUndoTask?.(task.task_id)}
                />
              );
            })}
          </div>
        </div>

        {canScroll.up && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface to-transparent",
              EDGE_FADE_VISIBILITY_CLASSNAME
            )}
          />
        )}
        {canScroll.down && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent",
              EDGE_FADE_VISIBILITY_CLASSNAME
            )}
          />
        )}

        {canScroll.up && (
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            aria-label="할 일 목록 위로 스크롤"
            className={cn(
              "absolute left-1/2 top-2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur-sm",
              SCROLL_BUTTON_VISIBILITY_CLASSNAME
            )}
          >
            <IconChevronUp size={16} stroke={1.75} className="text-muted" aria-hidden="true" />
          </button>
        )}
        {canScroll.down && (
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            aria-label="할 일 목록 아래로 스크롤"
            className={cn(
              "absolute bottom-2 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur-sm",
              SCROLL_BUTTON_VISIBILITY_CLASSNAME
            )}
          >
            <IconChevronDown size={16} stroke={1.75} className="text-muted" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 shrink-0 space-y-1.5">
        {atCapacity && <p className="text-xs text-muted">하루 최대 {MAX_TASKS_PER_DAY}개까지 추가할 수 있어요.</p>}
        {reconcileError && <p className="text-xs text-danger">{reconcileError}</p>}
        <div className="flex items-center gap-2">
          {!isReplan && (
            <button
              type="button"
              onClick={() => onRequestAdd(date)}
              disabled={atCapacity}
              className={cn(
                "flex h-9 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-btn border px-3 text-sm font-medium transition",
                atCapacity
                  ? "cursor-not-allowed border-border text-muted opacity-60"
                  : "border-border text-accent hover:bg-accent/5"
              )}
            >
              계획 추가
            </button>
          )}
          {isReplan && canPlaceOverdue && (
            <Button
              variant="blueOutline"
              size="icon"
              title="이 날짜에 배치"
              aria-label="이 날짜에 배치"
              onClick={() => onRequestPlace?.(date)}
            >
              <IconPlus size={18} stroke={1.75} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="sapphire"
            size="sm"
            className="h-9 flex-1 shrink-0 whitespace-nowrap"
            // isReconciling is intentionally not part of `disabled` here —
            // the sapphire color scheme must stay full-strength while
            // loading. Re-entry is already blocked inside handleReconcileDay
            // itself. The disabled look now comes from `sapphire`'s own
            // disabled:bg-[#DBEAFE]/disabled:text-[#64748B] (not a dimmed
            // active color), so this variant never needs to switch away
            // from "sapphire" just to look disabled.
            disabled={!(hasUndetermined || (isReplan && needsReconcile))}
            onClick={() => onRequestReconcile(date)}
          >
            {isReconciling ? "재조정 중…" : "재조정"}
          </Button>
        </div>
      </div>
    </div>
  );
}
