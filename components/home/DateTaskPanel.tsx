"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { TodayTaskList } from "@/components/home/TodayTaskList";
import { cn } from "@/lib/cn";
import { formatDisplayDate, getDayOfMonth, getMonthLabel } from "@/lib/dateUtils";
import type { Task } from "@/lib/types";

const TASKS_PER_PAGE = 4;
// Minimum horizontal movement before a pointer-down is treated as a drag
// rather than a tap/click — below this, checkbox/menu taps pass through
// untouched; at or above it we take over the gesture for paging.
const DRAG_LOCK_PX = 6;
// Horizontal gap between pages, outside the cards themselves.
const PAGE_GAP_PX = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

export function DateTaskPanel({
  hasGoal,
  selectedDate,
  today,
  tasks,
  nextUpcomingDate,
  onToggleComplete,
  onExclude,
  onDefer,
}: {
  hasGoal: boolean;
  selectedDate: string;
  today: string;
  tasks: Task[];
  nextUpcomingDate: string | null;
  onToggleComplete: (taskId: string) => void;
  onExclude: (taskId: string) => void;
  onDefer: (taskId: string) => void;
}) {
  const isToday = selectedDate === today;
  const heading = isToday
    ? "오늘 할 일"
    : `${getMonthLabel(selectedDate)} ${getDayOfMonth(selectedDate)}일 할 일`;

  return (
    <div className="relative flex h-[392px] flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
      {/* key={selectedDate} remounts this on date change, which resets pageIndex
          back to 0 for free — no effect needed to sync it. */}
      <TaskPagerSection
        key={selectedDate}
        heading={heading}
        hasGoal={hasGoal}
        isToday={isToday}
        tasks={tasks}
        nextUpcomingDate={nextUpcomingDate}
        onToggleComplete={onToggleComplete}
        onExclude={onExclude}
        onDefer={onDefer}
      />
    </div>
  );
}

function TaskPagerSection({
  heading,
  hasGoal,
  isToday,
  tasks,
  nextUpcomingDate,
  onToggleComplete,
  onExclude,
  onDefer,
}: {
  heading: string;
  hasGoal: boolean;
  isToday: boolean;
  tasks: Task[];
  nextUpcomingDate: string | null;
  onToggleComplete: (taskId: string) => void;
  onExclude: (taskId: string) => void;
  onDefer: (taskId: string) => void;
}) {
  // Always at least one (possibly empty) page, so TaskTrack still renders its
  // normal 4-placeholder-row TodayTaskList and reserves the usual content-area
  // height — otherwise the empty-state text below has a 0px-tall box to center
  // in, since there'd be nothing to reserve that height for.
  const pages = tasks.length === 0 ? [[]] : chunk(tasks, TASKS_PER_PAGE);
  const [pageIndex, setPageIndex] = useState(0);

  // Defensive clamp for the same date's task list shrinking in place (e.g. the
  // last task on the last page gets excluded) — not relied on for date changes,
  // which remount this component entirely via the key above.
  const clampedIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const hasPrev = clampedIndex > 0;
  const hasNext = clampedIndex < pages.length - 1;
  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(pages.length - 1, i + 1));

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">{heading}</h2>
        {pages.length > 1 && (
          <div className="flex items-center gap-[6px]">
            {pages.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn("h-2 w-2 rounded-full", i === clampedIndex ? "bg-accent-strong" : "bg-border")}
              />
            ))}
          </div>
        )}
      </div>

      <div className="group relative">
        <TaskTrack
          pages={pages}
          pageIndex={clampedIndex}
          onToggleComplete={onToggleComplete}
          onExclude={onExclude}
          onDefer={onDefer}
          onSwipePrev={hasPrev ? goPrev : undefined}
          onSwipeNext={hasNext ? goNext : undefined}
        />
        {tasks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <DateTaskEmptyState hasGoal={hasGoal} isToday={isToday} nextUpcomingDate={nextUpcomingDate} />
          </div>
        )}
        {hasPrev && <PagerHoverButton direction="prev" onClick={goPrev} />}
        {hasNext && <PagerHoverButton direction="next" onClick={goNext} />}
      </div>
    </>
  );
}

function PagerHoverButton({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "이전 Task 묶음" : "다음 Task 묶음"}
      className={cn(
        "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px]",
        "border border-border bg-surface text-muted opacity-0 pointer-events-none",
        "transition hover:bg-foreground/5 group-hover:pointer-events-auto group-hover:opacity-100",
        direction === "prev" ? "left-2" : "right-2"
      )}
    >
      <Icon size={18} />
    </button>
  );
}

function TaskTrack({
  pages,
  pageIndex,
  onToggleComplete,
  onExclude,
  onDefer,
  onSwipePrev,
  onSwipeNext,
}: {
  pages: Task[][];
  pageIndex: number;
  onToggleComplete: (taskId: string) => void;
  onExclude: (taskId: string) => void;
  onDefer: (taskId: string) => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
}) {
  // All pages render side by side in one track; the visible page is picked by
  // translateX in px, plus a live px offset while dragging. This is what lets
  // the list "follow the finger" during a drag instead of just jump-cutting
  // between pages. Page width is measured (not percentage-of-track) because a
  // real PAGE_GAP_PX gap between pages makes "100/n% of the track" and "one
  // viewport-width step" two different numbers — px math keeps them in sync.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const pointerState = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const wheelLocked = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handlePointerDown(e: React.PointerEvent) {
    pointerState.current = { startX: e.clientX, startY: e.clientY, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const start = pointerState.current;
    if (!start) return;
    const dx = e.clientX - start.startX;
    const dy = e.clientY - start.startY;
    if (!start.moved) {
      // Below the lock threshold (or more vertical than horizontal so far),
      // this still might just be a tap or a vertical scroll — don't commit.
      if (Math.abs(dx) < DRAG_LOCK_PX || Math.abs(dx) < Math.abs(dy)) return;
      start.moved = true;
      setIsDragging(true);
    }
    e.preventDefault();
    const blockedPrev = dx > 0 && !onSwipePrev;
    const blockedNext = dx < 0 && !onSwipeNext;
    setDragX(blockedPrev || blockedNext ? 0 : dx);
  }

  function endDrag(e: React.PointerEvent) {
    const start = pointerState.current;
    pointerState.current = null;
    if (start?.moved) {
      justDraggedRef.current = true;
      const dx = e.clientX - start.startX;
      if (Math.abs(dx) > containerWidth / 4) {
        if (dx < 0) onSwipeNext?.();
        else onSwipePrev?.();
      }
    }
    setIsDragging(false);
    setDragX(0);
  }

  // Swallows the click a drag's pointerup leaves behind — fired in the
  // capture phase, so it reaches this ancestor before the checkbox/summary's
  // own click handler, even though the pointer may have ended up over a
  // different task row than it started on once the track shifted under it.
  function handleClickCapture(e: React.MouseEvent) {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      justDraggedRef.current = false;
    }
  }

  function handleWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    if (wheelLocked.current) return;
    e.preventDefault();
    if (e.deltaX > 0) onSwipeNext?.();
    else onSwipePrev?.();
    wheelLocked.current = true;
    setTimeout(() => {
      wheelLocked.current = false;
    }, 350);
  }

  const step = containerWidth + PAGE_GAP_PX;

  return (
    <div ref={containerRef} className="overflow-hidden" style={{ touchAction: "pan-y" }}>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        onWheel={handleWheel}
        className="flex"
        style={{
          gap: `${PAGE_GAP_PX}px`,
          transform: `translateX(${-pageIndex * step + dragX}px)`,
          transition: isDragging ? "none" : "transform 300ms ease",
        }}
      >
        {pages.map((pageTasks, i) => (
          <div key={i} className="shrink-0" style={{ width: containerWidth }}>
            <TodayTaskList
              tasks={pageTasks}
              minRows={4}
              onToggleComplete={onToggleComplete}
              onExclude={onExclude}
              onDefer={onDefer}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DateTaskEmptyState({
  hasGoal,
  isToday,
  nextUpcomingDate,
}: {
  hasGoal: boolean;
  isToday: boolean;
  nextUpcomingDate: string | null;
}) {
  if (!hasGoal) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <p className="text-sm font-medium text-foreground">아직 진행 중인 계획이 없어요.</p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center justify-center rounded-btn bg-accent-strong px-4 py-3 text-sm font-medium text-accent-foreground transition hover:brightness-95 active:brightness-90"
        >
          + 새 계획 만들기
        </Link>
      </div>
    );
  }

  if (isToday && nextUpcomingDate) {
    return (
      <p className="px-4 text-center text-sm text-muted">
        오늘 예정된 일이 없어요. 다음 계획은 {formatDisplayDate(nextUpcomingDate)}에 있어요.
      </p>
    );
  }

  return <p className="px-4 text-center text-sm text-muted">이 날짜에 계획된 일이 없어요.</p>;
}
