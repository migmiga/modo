"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "@tabler/icons-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { afterLayoutSettles, logModalAudit } from "@/lib/debugLayout";
import { formatClock } from "@/lib/format";
import type { Task } from "@/lib/types";

type ExecStatus = "idle" | "running" | "break";
type ViewTab = "all" | "byTask";

interface ExecSegment {
  startAt: number;
  endAt: number | null;
  interruptedTaskId?: string;
}

interface Row {
  key: string;
  type: "task" | "break";
  title?: string;
  segments: ExecSegment[];
}

interface CurrentTask {
  task_id: string;
  title: string;
  duration_minutes: number;
}

// How far past "now" the axis extends while something is still ongoing, so
// the live edge isn't flush against the right edge of the track. A fixed
// amount (not tied to any expected duration) — as real elapsed time grows,
// this becomes a shrinking fraction of the whole axis, which is what reads as
// the track "filling in" over time.
const LIVE_AXIS_PADDING_MS = 5 * 60 * 1000;
// Fixed time scale for the "전체" tab: px-per-minute never changes, so past
// records never shrink as more recording accumulates — the track just grows
// to the right and the viewport scrolls instead.
const PX_PER_MINUTE = 8;
// How close to the live (right) edge counts as "still following" — inside
// this, auto-scroll keeps the current position in view; outside it (the user
// scrolled back to look at history), auto-scroll backs off.
const AUTO_SCROLL_EDGE_PX = 32;

const TOAST_DURATION_MS = 3000;
const BREAK_ROW_KEY = "break";

// Step timeline layout (see StepTimeline below).
const ROW_HEIGHT_PX = 72;
const BAR_HEIGHT_PX = 32;
const BAR_TOP_OFFSET_PX = 28;
// Below this, even the short "작업 N분" text would clip/overlap — skip it
// rather than truncate (no repeated ellipsis).
const MIN_WORK_TEXT_WIDTH_PX = 48;
function formatDiffMinutes(diffMin: number): string {
  if (diffMin > 0) return `+${diffMin}분`;
  if (diffMin < 0) return `${diffMin}분`; // negative numbers already carry "-"
  return "0분";
}

// Step-timeline detail tooltip layout — rendered via a portal (see
// StepTooltipPortal) so it never affects the timeline track's own box size
// or scroll area. The content is always this exact fixed shape (4 short
// rows + a divider), so a constant height estimate is safe to position by —
// no need to measure the tooltip itself before placing it.
const TOOLTIP_WIDTH_PX = 232;
const TOOLTIP_HEIGHT_ESTIMATE_PX = 136;
const TOOLTIP_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

function computeTooltipPosition(triggerEl: HTMLElement): { top: number; left: number } {
  const rect = triggerEl.getBoundingClientRect();
  const placeAbove = rect.bottom + TOOLTIP_GAP_PX + TOOLTIP_HEIGHT_ESTIMATE_PX > window.innerHeight;
  const top = placeAbove ? rect.top - TOOLTIP_GAP_PX - TOOLTIP_HEIGHT_ESTIMATE_PX : rect.bottom + TOOLTIP_GAP_PX;
  let left = rect.left;
  if (left + TOOLTIP_WIDTH_PX + VIEWPORT_MARGIN_PX > window.innerWidth) {
    left = rect.right - TOOLTIP_WIDTH_PX;
  }
  left = Math.max(VIEWPORT_MARGIN_PX, left);
  return { top, left };
}

function StepTooltipPortal({
  top,
  left,
  expectedMin,
  actualWorkRounded,
  actualBreakRounded,
}: {
  top: number;
  left: number;
  expectedMin: number;
  actualWorkRounded: number;
  actualBreakRounded: number;
}) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 w-[232px] rounded-[12px] border border-border bg-chalk p-3 text-[13px] text-foreground shadow-card"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-muted">예상 시간</span>
          <span className="font-semibold text-foreground">{expectedMin}분</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-muted">실제 작업</span>
          <span className="font-semibold text-foreground">{actualWorkRounded}분</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-muted">휴식 시간</span>
          <span className="font-semibold text-foreground">{actualBreakRounded}분</span>
        </div>
        <div className="h-px w-full bg-border" />
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-muted">예상 대비</span>
          <span className="font-semibold text-foreground">{formatDiffMinutes(actualWorkRounded - expectedMin)}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

const FILTER_DROPDOWN_GAP_PX = 8;

// Custom listbox replacing the native <select> for the two timeline filters
// (할 일 상태 / 작업 선택) — same visual language as TodayTaskList's 더보기
// menu (rounded-[8px] panel, shadow-pop, white bg, ash border). Click
// outside, Escape, and arrow-key + Enter navigation are all handled here
// since a native <select>'s own popup can't be restyled this way. Exported
// so other screens (e.g. the archive filter) can reuse this exact dropdown
// instead of re-implementing it.
export function FilterDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  buttonClassName,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? null;

  function openDropdown() {
    // Default guess is "down" (openUpward stays whatever it last was,
    // harmless either way) — corrected below in useLayoutEffect against the
    // panel's REAL rendered height before the browser paints, so there's no
    // visible flicker. The old version estimated the height (options.length
    // * 30px) *before* the panel existed, which is exactly what let the
    // selected row's highlight end up placed outside the panel's actual
    // bottom edge whenever the estimate didn't match the real layout — this
    // panel also now caps at max-h + scrolls, so "real height" has a ceiling.
    setHighlightedIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function closeDropdown(refocusButton: boolean) {
    setOpen(false);
    if (refocusButton) buttonRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    const panel = listRef.current;
    if (!btn || !panel) return;
    const btnRect = btn.getBoundingClientRect();
    const panelHeight = panel.getBoundingClientRect().height;
    const shouldOpenUpward = btnRect.bottom + FILTER_DROPDOWN_GAP_PX + panelHeight > window.innerHeight;
    setOpenUpward((prev) => (prev === shouldOpenUpward ? prev : shouldOpenUpward));
    // Bring the selected option into view inside the (possibly scrollable,
    // max-h-capped) panel immediately, before paint.
    const items = panel.querySelectorAll('[role="option"]');
    const selectedIndex = options.findIndex((o) => o.value === value);
    items[selectedIndex >= 0 ? selectedIndex : 0]?.scrollIntoView({ block: "nearest" });
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlightedIndex];
      if (opt) {
        onChange(opt.value);
        closeDropdown(true);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeDropdown(false) : openDropdown())}
        className={cn(
          "flex h-8 items-center justify-between rounded-input border border-ash bg-surface px-3 text-xs text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20",
          buttonClassName
        )}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? ""}</span>
        <IconChevronDown size={14} stroke={1.75} className="ml-1.5 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className={cn(
            // z-30, not z-20: TaskDetailTimeline's "now" position marker
            // (the blue bar + dot right below, in "할 일별" view) also uses
            // z-20 — equal z-index falls back to DOM order, and that marker
            // comes later in the document, so it was winning and painting
            // through/over this panel. Giving this panel a clearly higher
            // z-index (not touching the marker's own z-20, which it needs
            // for its own purpose inside the graph) removes the tie outright.
            "absolute left-0 z-30 max-h-[240px] min-w-full overflow-y-auto rounded-[8px] border border-ash bg-surface p-1 shadow-pop outline-none",
            openUpward ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            // Selected always wins over hover/keyboard-highlight (never
            // falls back to the gray highlight color), so the two states
            // read as visually distinct per MODO's shared filter-dropdown
            // color rule — mutually exclusive branches, not stacked
            // classes, since cn() is a plain string join and two
            // conflicting bg-* utilities would otherwise race in the
            // compiled stylesheet.
            const stateClassName = isSelected
              ? "bg-[#EFF6FF] font-medium text-accent"
              : i === highlightedIndex
                ? "bg-paper-mist text-foreground"
                : "text-foreground";
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => {
                  onChange(opt.value);
                  closeDropdown(true);
                }}
                className={cn(
                  "cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1.5 text-xs transition",
                  stateClassName
                )}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface WorkPiece {
  kind: "violet" | "amber";
  startAt: number;
  endAt: number;
  // True only for the piece that currently ends at "now" because its source
  // run segment is still open — never for an earlier half of a split piece,
  // which already ended at a fixed cut point regardless of the run overall.
  ongoing: boolean;
}

// Splits a Task's own run segments into "within expected" (violet) and
// "over expected" (amber) pieces, cut at the real timestamp where cumulative
// WORK time (breaks excluded, not wall-clock elapsed) first reaches
// duration_minutes. Cutting by work-time rather than a fixed wall-clock
// offset is what keeps the cut accurate once any break is in the mix.
function splitWorkByExpected(runs: ExecSegment[], expectedMin: number, nowMs: number): WorkPiece[] {
  const pieces: WorkPiece[] = [];
  let cumulativeMin = 0;
  for (const r of runs) {
    const isOpen = r.endAt === null;
    const startAt = r.startAt;
    const endAt = r.endAt ?? nowMs;
    const durationMin = (endAt - startAt) / 60000;
    const endCumulative = cumulativeMin + durationMin;
    if (endCumulative <= expectedMin) {
      pieces.push({ kind: "violet", startAt, endAt, ongoing: isOpen });
    } else if (cumulativeMin >= expectedMin) {
      pieces.push({ kind: "amber", startAt, endAt, ongoing: isOpen });
    } else {
      const splitAt = startAt + (expectedMin - cumulativeMin) * 60000;
      pieces.push({ kind: "violet", startAt, endAt: splitAt, ongoing: false });
      pieces.push({ kind: "amber", startAt: splitAt, endAt, ongoing: isOpen });
    }
    cumulativeMin = endCumulative;
  }
  return pieces;
}

// "전체": one step per Task, in plan order, each one row further down than
// the last — not a shared wall-clock axis. A step's x-position is the sum of
// every earlier step's bar length, so "where Task N starts" always lines up
// with "where Task N-1 ended," whether that end was its expected duration
// (not run yet) or its real recorded time (run/completed). Only real
// actual_start_at/actual_end_at data ever becomes the violet/gray fill; the
// gray base is the planned duration_minutes, never a fabricated record.
function StepTimeline({
  tasks,
  rows,
  breakRow,
  nowMs,
  currentTask,
  status,
}: {
  tasks: Task[];
  rows: Row[];
  breakRow: Row | undefined;
  nowMs: number;
  currentTask: CurrentTask | null;
  status: ExecStatus;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Starts false (not true) on purpose: this component remounts fresh every
  // time 필터 switches from "할 일별" to "전체" (it's only ever rendered
  // behind that conditional), so a default of true was auto-scrolling the
  // freshly-mounted scroll container to its live (right) edge on every
  // switch — even though the user never asked to follow it, just to see the
  // timeline from its start. Auto-follow now only turns on once the user's
  // own scroll brings them within AUTO_SCROLL_EDGE_PX of the live edge (see
  // handleScroll below), same as a chat view that only sticks to "latest"
  // once you're already there.
  const autoFollowRef = useRef(false);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  // Bar elements, keyed by task — looked up to (re)compute the portal
  // tooltip's position against the trigger's real, current screen position.
  const barElRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  function showTooltip(taskId: string) {
    const el = barElRefs.current.get(taskId);
    if (!el) return;
    setActiveTaskId(taskId);
    setTooltipPos(computeTooltipPosition(el));
  }

  function hideTooltip(taskId: string) {
    setActiveTaskId((cur) => (cur === taskId ? null : cur));
  }

  // Keeps the tooltip glued to its trigger while visible — the trigger's
  // on-screen position can change from page scroll, from dragging the
  // timeline's own horizontal scroll, or from a window resize, none of which
  // otherwise re-render this component.
  useEffect(() => {
    if (!activeTaskId) return;
    const taskId = activeTaskId; // narrow once, captured by the listener closure below
    function reposition() {
      const el = barElRefs.current.get(taskId);
      if (!el) return;
      setTooltipPos(computeTooltipPosition(el));
    }
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [activeTaskId]);

  const rowByTaskId = new Map(rows.filter((r) => r.type === "task").map((r) => [r.key, r]));
  const breakSegs = breakRow?.segments ?? [];

  // Computed as a plain derived array (no outer accumulator mutated across
  // iterations) — each step's startMin is the sum of every earlier step's own
  // bar length, purely a function of this render's data.
  const stepBase = tasks.map((task) => {
    const runs = rowByTaskId.get(task.task_id)?.segments ?? [];
    const taskBreaks = breakSegs.filter((s) => s.interruptedTaskId === task.task_id);
    const hasStarted = runs.length > 0;
    const actualWorkMin = runs.reduce((sum, r) => sum + ((r.endAt ?? nowMs) - r.startAt), 0) / 60000;
    const actualBreakMin = taskBreaks.reduce((sum, b) => sum + ((b.endAt ?? nowMs) - b.startAt), 0) / 60000;
    const expectedMin = task.duration_minutes;
    const barLengthMin = hasStarted ? Math.max(expectedMin, actualWorkMin + actualBreakMin) : expectedMin;
    const isRunningNow = currentTask?.task_id === task.task_id && status !== "idle";
    // Chronological run/break order within this one Task's own bar — not an
    // aggregate work-then-break split, so pausing and resuming shows as its
    // own violet (or amber, once over expected) stripe picking back up after
    // the gray gap, in real order.
    const timeline = [
      ...splitWorkByExpected(runs, expectedMin, nowMs),
      ...taskBreaks.map((b) => ({ kind: "break" as const, startAt: b.startAt, endAt: b.endAt ?? nowMs })),
    ].sort((a, b) => a.startAt - b.startAt);
    const firstStartAt = timeline[0]?.startAt ?? 0;
    return { task, barLengthMin, expectedMin, actualWorkMin, actualBreakMin, hasStarted, isRunningNow, timeline, firstStartAt };
  });

  const steps = stepBase.map((s, i) => ({
    ...s,
    i,
    startMin: stepBase.slice(0, i).reduce((sum, x) => sum + x.barLengthMin, 0),
  }));

  const cumulativeMin = steps.reduce((sum, s) => sum + s.barLengthMin, 0);
  const isLiveOverall = currentTask !== null && status !== "idle";

  useEffect(() => {
    if (!isLiveOverall) return;
    const el = scrollRef.current;
    if (!el || !autoFollowRef.current) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [isLiveOverall, nowMs]);

  if (tasks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">오늘 계획된 Task가 없어요.</p>;
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromLiveEdge = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    autoFollowRef.current = distanceFromLiveEdge <= AUTO_SCROLL_EDGE_PX;
  }

  function handlePointerDown(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el || e.pointerType !== "mouse") return;
    dragRef.current = { startX: e.clientX, startScrollLeft: el.scrollLeft };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag) return;
    el.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  const totalWidthPx = cumulativeMin * PX_PER_MINUTE;
  const totalHeightPx = steps.length * ROW_HEIGHT_PX;
  const activeStep = steps.find((s) => s.task.task_id === activeTaskId);

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="cursor-grab scroll-smooth overflow-x-auto [overscroll-behavior-x:contain] active:cursor-grabbing"
        style={{ touchAction: "pan-x" }}
      >
        <div className="relative" style={{ width: `${totalWidthPx}px`, height: `${totalHeightPx}px`, minWidth: "100%" }}>
          {steps.map((step) => {
            const barLeft = step.startMin * PX_PER_MINUTE;
            const barWidth = Math.max(step.barLengthMin * PX_PER_MINUTE, 4);
            const actualWorkRounded = Math.round(step.actualWorkMin);
            const showInlineText = step.hasStarted && barWidth >= MIN_WORK_TEXT_WIDTH_PX;
            const barTop = step.i * ROW_HEIGHT_PX + BAR_TOP_OFFSET_PX;

            return (
              <Fragment key={step.task.task_id}>
                <p
                  className={cn(
                    "absolute whitespace-nowrap text-sm font-medium",
                    step.isRunningNow ? "text-accent" : "text-foreground"
                  )}
                  style={{ left: `${barLeft}px`, top: `${step.i * ROW_HEIGHT_PX}px` }}
                >
                  {step.task.title}
                </p>

                <div
                  ref={(el) => {
                    if (el) barElRefs.current.set(step.task.task_id, el);
                    else barElRefs.current.delete(step.task.task_id);
                  }}
                  className="absolute"
                  style={{ left: `${barLeft}px`, top: `${barTop}px`, width: `${barWidth}px`, height: `${BAR_HEIGHT_PX}px` }}
                  tabIndex={step.hasStarted ? 0 : undefined}
                  onMouseEnter={() => step.hasStarted && showTooltip(step.task.task_id)}
                  onMouseLeave={() => step.hasStarted && hideTooltip(step.task.task_id)}
                  onFocus={() => step.hasStarted && showTooltip(step.task.task_id)}
                  onBlur={() => step.hasStarted && hideTooltip(step.task.task_id)}
                  onClick={() => {
                    if (!step.hasStarted) return;
                    if (activeTaskId === step.task.task_id) hideTooltip(step.task.task_id);
                    else showTooltip(step.task.task_id);
                  }}
                >
                  <div className="absolute inset-0 overflow-hidden rounded-[4px] bg-border">
                    {step.timeline.map((seg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "absolute inset-y-0",
                          // Lighter, less visually heavy than the old near-
                          // black/saturated fills — local to this graph, not
                          // a change to the shared accent/tangerine tokens.
                          seg.kind === "violet" && "bg-[#93C5FD]",
                          seg.kind === "amber" && "bg-[#FDBA74]",
                          seg.kind === "break" && "bg-pebble"
                        )}
                        style={{
                          left: `${((seg.startAt - step.firstStartAt) / 60000) * PX_PER_MINUTE}px`,
                          width: `${Math.max(((seg.endAt - seg.startAt) / 60000) * PX_PER_MINUTE, 2)}px`,
                        }}
                      />
                    ))}
                    {showInlineText && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="whitespace-nowrap rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                          작업 {actualWorkRounded}분
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {activeStep && tooltipPos && (
        <StepTooltipPortal
          top={tooltipPos.top}
          left={tooltipPos.left}
          expectedMin={activeStep.expectedMin}
          actualWorkRounded={Math.round(activeStep.actualWorkMin)}
          actualBreakRounded={Math.round(activeStep.actualBreakMin)}
        />
      )}
    </>
  );
}

// "할일별": one Task's own actual record, fit to the viewport (since a single
// Task's real duration is naturally bounded, unlike the whole day). Run and
// break segments share one row/bar here — Violet for run, Neutral for break —
// since this view's whole purpose is showing that one Task's run/break flow.
function TaskDetailTimeline({
  task,
  taskRow,
  breakRow,
  nowMs,
}: {
  task: Task;
  taskRow: Row | undefined;
  breakRow: Row | undefined;
  nowMs: number;
}) {
  const runs = taskRow?.segments ?? [];
  const breaks = (breakRow?.segments ?? []).filter((s) => s.interruptedTaskId === task.task_id);

  if (runs.length === 0) {
    // Same min-h-16 (64px) footprint as the "has records" return below — the
    // text-xs line + space-y-2 gap + h-10 bar area there add up to exactly
    // that, so switching in/out of this branch never changes the card height.
    return (
      <div className="flex min-h-16 items-center justify-center">
        <p className="text-center text-sm text-muted">아직 실행 기록이 없어요.</p>
      </div>
    );
  }

  const segs = [
    ...splitWorkByExpected(runs, task.duration_minutes, nowMs).map((p) => ({
      kind: p.kind,
      start: p.startAt,
      end: p.endAt,
      ongoing: p.ongoing,
    })),
    ...breaks.map((s) => ({
      kind: "break" as const,
      start: s.startAt,
      end: s.endAt ?? nowMs,
      ongoing: s.endAt === null,
    })),
  ].sort((a, b) => a.start - b.start);

  const axisStart = segs[0].start;
  const last = segs[segs.length - 1];
  const axisEnd = last.ongoing ? nowMs + LIVE_AXIS_PADDING_MS : last.end;
  const span = Math.max(axisEnd - axisStart, 1);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - axisStart) / span) * 100));
  const nowPct = last.ongoing ? pct(nowMs) : null;

  const totalRunMin = Math.round(runs.reduce((s, r) => s + ((r.endAt ?? nowMs) - r.startAt), 0) / 60000);
  const totalBreakMin = Math.round(breaks.reduce((s, b) => s + ((b.endAt ?? nowMs) - b.startAt), 0) / 60000);
  const overtimeMin = Math.max(0, totalRunMin - task.duration_minutes);

  return (
    <div className="min-h-16 space-y-2">
      <div className="relative h-10">
        {segs.map((seg, i) => {
          const left = pct(seg.start);
          const width = Math.max(pct(seg.end) - left, 0.6);
          return (
            <div
              key={i}
              className={cn(
                "absolute inset-y-0",
                // Same 3 colors as the overview graph above (StepTimeline) —
                // local to the graph, not the shared accent/tangerine tokens.
                seg.kind === "violet" && "bg-[#93C5FD]",
                seg.kind === "amber" && "bg-[#FDBA74]",
                seg.kind === "break" && "bg-pebble"
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
        {nowPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-20"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-accent/70" />
            <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        예상 {task.duration_minutes}분 · 실제 {totalRunMin}분{overtimeMin > 0 ? ` (+${overtimeMin}분)` : ""}
        {totalBreakMin > 0 ? ` · 휴식 ${totalBreakMin}분` : ""}
      </p>
    </div>
  );
}

function StatusIndicator({ status, focusedMs }: { status: ExecStatus; focusedMs: number }) {
  if (status === "idle") {
    return <span className="text-sm text-muted">대기 중</span>;
  }
  const running = status === "running";
  return (
    <span className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          running ? "animate-pulse bg-tangerine motion-reduce:animate-none" : "bg-muted"
        )}
      />
      <span>{running ? "실행 중" : "휴식 중"}</span>
      <span className="inline-block w-[64px] text-right font-medium tabular-nums">
        {formatClock(Math.floor(focusedMs / 1000))}
      </span>
    </span>
  );
}

export function ExecutionTimeline({
  hasGoal,
  todayTasks,
  onCompleteTask,
}: {
  hasGoal: boolean;
  todayTasks: Task[];
  onCompleteTask: (taskId: string) => void;
}) {
  const [status, setStatus] = useState<ExecStatus>("idle");
  const [currentTask, setCurrentTask] = useState<CurrentTask | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("byTask");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // TEMPORARY layout-debug instrumentation — see lib/debugLayout.ts.
  const wasBreakModalOpenRef = useRef(false);
  const wasCompleteModalOpenRef = useRef(false);

  // 렌더를 매 초 강제로 갱신하기 위한 용도일 뿐, 값 자체는 쓰지 않는다 —
  // 실제 시간 값은 매 렌더 Date.now()/segment의 startAt·endAt에서 다시 계산한다.
  const [, bumpTick] = useState(0);

  useEffect(() => {
    if (status === "idle") return;
    const interval = setInterval(() => bumpTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!currentTask) return;
    const latest = todayTasks.find((t) => t.task_id === currentTask.task_id);
    if (latest?.status !== "completed") return;

    const completedTaskId = currentTask.task_id;
    const timeoutId = setTimeout(() => {
      closeRowSegment(completedTaskId);
      setStatus("idle");
      setCurrentTask(null);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [todayTasks, currentTask]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // TEMPORARY layout-debug instrumentation — see lib/debugLayout.ts. Logs
  // OPEN once the modal's DOM/layout change has committed, and CLOSED once
  // it reverts — BEFORE is logged synchronously at the click site instead,
  // since that must capture the pre-click DOM.
  useEffect(() => {
    if (showBreakModal) {
      wasBreakModalOpenRef.current = true;
      afterLayoutSettles(() => logModalAudit("OPEN", "잠시 쉬기"));
    } else if (wasBreakModalOpenRef.current) {
      wasBreakModalOpenRef.current = false;
      afterLayoutSettles(() => logModalAudit("CLOSED", "잠시 쉬기"));
    }
  }, [showBreakModal]);

  useEffect(() => {
    if (showCompleteModal) {
      wasCompleteModalOpenRef.current = true;
      afterLayoutSettles(() => logModalAudit("OPEN", "완료하기"));
    } else if (wasCompleteModalOpenRef.current) {
      wasCompleteModalOpenRef.current = false;
      afterLayoutSettles(() => logModalAudit("CLOSED", "완료하기"));
    }
  }, [showCompleteModal]);

  const nowMs = Date.now();
  const nextPendingTask = todayTasks.find((t) => t.status === "pending");

  function closeRowSegment(key: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key || row.segments.length === 0) return row;
        const last = row.segments[row.segments.length - 1];
        if (last.endAt !== null) return row;
        return { ...row, segments: [...row.segments.slice(0, -1), { ...last, endAt: Date.now() }] };
      })
    );
  }

  function pushTaskSegment(taskId: string, title: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === taskId);
      const newSeg: ExecSegment = { startAt: Date.now(), endAt: null };
      if (idx === -1) {
        return [...prev, { key: taskId, type: "task" as const, title, segments: [newSeg] }];
      }
      const row = prev[idx];
      const updated: Row = { ...row, segments: [...row.segments, newSeg] };
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    });
  }

  function pushBreakSegment(interruptedTaskId: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === BREAK_ROW_KEY);
      const newSeg: ExecSegment = { startAt: Date.now(), endAt: null, interruptedTaskId };
      if (idx === -1) {
        return [...prev, { key: BREAK_ROW_KEY, type: "break" as const, segments: [newSeg] }];
      }
      const row = prev[idx];
      const updated: Row = { ...row, segments: [...row.segments, newSeg] };
      return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    });
  }

  function handleStart() {
    if (!nextPendingTask) return;
    setCurrentTask({
      task_id: nextPendingTask.task_id,
      title: nextPendingTask.title,
      duration_minutes: nextPendingTask.duration_minutes,
    });
    setStatus("running");
    pushTaskSegment(nextPendingTask.task_id, nextPendingTask.title);
  }

  function handleConfirmBreak() {
    if (!currentTask) return;
    setShowBreakModal(false);
    closeRowSegment(currentTask.task_id);
    pushBreakSegment(currentTask.task_id);
    setStatus("break");
    // TODO: 휴식 사유 선택(단순 휴식 / 예상보다 어려움 / 집중력 저하 / 다른 일정 발생 /
    // 컨디션 문제 / 기타)은 실행 흐름을 방해하지 않기 위해 M1에서는 구현하지 않음 — 추후 검토.
  }

  function handleResume() {
    if (!currentTask) return;
    closeRowSegment(BREAK_ROW_KEY);
    pushTaskSegment(currentTask.task_id, currentTask.title);
    setStatus("running");
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setShowResumeToast(true);
    toastTimeoutRef.current = setTimeout(() => setShowResumeToast(false), TOAST_DURATION_MS);
  }

  function handleRequestComplete() {
    if (!currentTask) return;
    logModalAudit("BEFORE", "완료하기"); // TEMPORARY layout-debug instrumentation
    setShowCompleteModal(true);
  }

  function handleConfirmComplete() {
    if (!currentTask) return; // a second click lands here with currentTask already null
    setShowCompleteModal(false);
    if (status === "running") closeRowSegment(currentTask.task_id);
    if (status === "break") closeRowSegment(BREAK_ROW_KEY);
    onCompleteTask(currentTask.task_id);
    setStatus("idle");
    setCurrentTask(null);
    // Clear any manual Task-dropdown pin so "할일별" falls back to the next
    // pending Task automatically instead of staying on the just-completed one.
    setSelectedTaskKey(null);
  }

  const taskRows = rows.filter((r) => r.type === "task");
  const breakRow = rows.find((r) => r.key === BREAK_ROW_KEY);

  const focusedMs = taskRows
    .flatMap((r) => r.segments)
    .reduce((sum, s) => sum + ((s.endAt ?? nowMs) - s.startAt), 0);

  const todayTasksSorted = [...todayTasks].sort((a, b) => a.order - b.order);

  const firstPendingTaskId = todayTasksSorted.find((t) => t.status === "pending")?.task_id ?? null;
  const effectiveSelectedKey =
    selectedTaskKey ?? currentTask?.task_id ?? firstPendingTaskId ?? todayTasksSorted[0]?.task_id ?? null;
  const selectedTask = todayTasksSorted.find((t) => t.task_id === effectiveSelectedKey) ?? null;
  const selectedTaskRow = selectedTask ? rows.find((r) => r.key === selectedTask.task_id) : undefined;

  return (
    <section className="min-h-[244px] space-y-5 rounded-card border border-border bg-surface p-5 shadow-card lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium">타임라인</h2>
          <StatusIndicator status={status} focusedMs={focusedMs} />
        </div>

        <div className="flex items-center gap-2">
          {!hasGoal ? (
            // 활성 목표가 없으면 시작할 Task 자체가 없다 — 버튼은 같은
            // 자리에 그대로 두고 비활성화만 한다(숨기거나 다른 문구로
            // 바꾸지 않음). Button의 disabled가 클릭을 막고, 네이티브
            // <button disabled>이라 Tab으로 포커스조차 가지 않아
            // 키보드로도 실행되지 않는다.
            <Button size="sm" disabled>
              시작하기
            </Button>
          ) : status === "idle" ? (
            nextPendingTask ? (
              <Button onClick={handleStart} size="sm">
                시작하기
              </Button>
            ) : (
              <span className="text-sm text-muted">오늘 Task를 모두 완료했어요.</span>
            )
          ) : (
            <>
              {status === "running" ? (
                <Button
                  variant="header"
                  size="sm"
                  onClick={() => {
                    logModalAudit("BEFORE", "잠시 쉬기"); // TEMPORARY layout-debug instrumentation
                    setShowBreakModal(true);
                  }}
                >
                  휴식하기
                </Button>
              ) : (
                <Button variant="blueOutline" size="sm" onClick={handleResume}>
                  마저하기
                </Button>
              )}
              <Button variant="sapphireSolid" size="sm" onClick={handleRequestComplete}>
                완료하기
              </Button>
            </>
          )}
        </div>
      </div>

      <hr className="border-border/60" />

      <div className="flex items-center gap-2">
        <FilterDropdown
          value={viewTab}
          onChange={(v) => setViewTab(v as ViewTab)}
          ariaLabel="할 일 상태 필터"
          options={[
            { value: "byTask", label: "할 일별" },
            { value: "all", label: "전체" },
          ]}
        />

        {/* Names which Task the view below shows — no separate title/expected-
            time block repeating the same thing. Only shown in "할 일별". */}
        {viewTab === "byTask" && todayTasksSorted.length > 0 && (
          <FilterDropdown
            value={effectiveSelectedKey ?? ""}
            onChange={(v) => setSelectedTaskKey(v)}
            ariaLabel="작업 선택 필터"
            buttonClassName="w-[140px]"
            options={todayTasksSorted.map((t) => ({ value: t.task_id, label: t.title }))}
          />
        )}
      </div>

      {!hasGoal ? (
        <p className="py-10 text-center text-sm text-muted">실행할 계획이 없어요.</p>
      ) : viewTab === "all" ? (
        <StepTimeline
          tasks={todayTasksSorted}
          rows={rows}
          breakRow={breakRow}
          nowMs={nowMs}
          currentTask={currentTask}
          status={status}
        />
      ) : todayTasksSorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">오늘 계획된 Task가 없어요.</p>
      ) : (
        selectedTask && (
          <TaskDetailTimeline task={selectedTask} taskRow={selectedTaskRow} breakRow={breakRow} nowMs={nowMs} />
        )
      )}

      {showBreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
            <div className="space-y-1">
              <h3 className="text-base font-medium">잠시 쉬어갈까요?</h3>
              <p className="text-sm text-muted">잠깐 쉬어가도 괜찮아요. 준비되면 다시 시작해요.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowBreakModal(false)} className="flex-1">
                취소
              </Button>
              <Button onClick={handleConfirmBreak} className="flex-1">
                휴식 시작
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
            <div className="space-y-1">
              <h3 className="text-base font-medium">할 일을 완료할까요?</h3>
              <p className="text-sm text-muted">완료하면 실행 시간이 기록되고 다음 할 일로 넘어가요.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="header" onClick={() => setShowCompleteModal(false)} className="flex-1">
                취소
              </Button>
              <Button onClick={handleConfirmComplete} className="flex-1">
                완료하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {showResumeToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-card bg-foreground px-4 py-3 text-sm text-background shadow-pop">
          잘 쉬고 오셨나요? 다시 이어서 시작해볼까요?
        </div>
      )}
    </section>
  );
}
