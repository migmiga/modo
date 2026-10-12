"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical } from "lucide-react";

import { cn } from "@/lib/cn";
import type { Task } from "@/lib/types";

// Same "portal + viewport-relative flip" technique as ExecutionTimeline.tsx's
// StepTooltipPortal/computeTooltipPosition — the menu is rendered into
// document.body (position: fixed) instead of as an absolutely-positioned
// child of the task row, so it can never be clipped by DateTaskPanel's
// TaskTrack `overflow-hidden` pager or the card's own fixed height. Content
// is always the same two fixed-height items, so (like StepTooltipPortal) a
// constant height estimate is safe to position by without measuring first.
const MENU_GAP_PX = 8;
const MENU_HEIGHT_ESTIMATE_PX = 72; // p-[6px]×2 + 2 × h-[30px] items, no gap between
const VIEWPORT_MARGIN_PX = 8;

function computeMenuPosition(triggerEl: HTMLElement): { top: number; right: number } {
  const rect = triggerEl.getBoundingClientRect();
  const placeAbove = rect.bottom + MENU_GAP_PX + MENU_HEIGHT_ESTIMATE_PX > window.innerHeight;
  const top = placeAbove ? rect.top - MENU_GAP_PX - MENU_HEIGHT_ESTIMATE_PX : rect.bottom + MENU_GAP_PX;
  const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - rect.right);
  return { top, right };
}

function TaskMenuPortal({
  top,
  right,
  registerRef,
  onDefer,
  onExclude,
}: {
  top: number;
  right: number;
  registerRef: (el: HTMLDivElement | null) => void;
  onDefer: () => void;
  onExclude: () => void;
}) {
  return createPortal(
    <div
      ref={registerRef}
      role="menu"
      className="fixed z-50 flex flex-col whitespace-nowrap rounded-[12px] border border-border bg-surface p-[6px] shadow-pop"
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onDefer}
        className="flex h-[30px] min-w-[92px] items-center rounded-[6px] p-[6px] text-left text-[13px] text-foreground transition hover:bg-foreground/5"
      >
        나중에 하기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onExclude}
        className="flex h-[30px] min-w-[92px] items-center rounded-[6px] p-[6px] text-left text-[13px] text-foreground transition hover:bg-foreground/5"
      >
        일정에서 제외
      </button>
    </div>,
    document.body
  );
}

export function TodayTaskList({
  tasks,
  onToggleComplete,
  onExclude,
  onDefer,
  minRows = 0,
}: {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onExclude: (taskId: string) => void;
  onDefer: (taskId: string) => void;
  /** Pads the list with invisible placeholder rows (same markup, so identical
   * rendered height) up to this count, so the list's own natural height never
   * depends on how many real tasks are on the current page. */
  minRows?: number;
}) {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const placeholderCount = Math.max(0, minRows - sorted.length);

  // Was a native <details>/<summary> before — that only closes on a second
  // click of its own <summary>, never on an outside click or Escape. Now a
  // single "which task's menu is open" id, so opening one always implies
  // closing whichever other one was open (at most one at a time).
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const menuButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!openMenuTaskId) return;
    function handlePointerDown(e: MouseEvent) {
      const trigger = menuButtonRefs.current.get(openMenuTaskId as string);
      const target = e.target as Node;
      if (trigger?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      setOpenMenuTaskId(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuTaskId(null);
    }
    // Scrolling anywhere (the page, or an ancestor scroll container) closes
    // the menu rather than trying to live-reposition it — simplest way to
    // avoid a stale fixed-position menu drifting away from its trigger.
    function handleScroll() {
      setOpenMenuTaskId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openMenuTaskId]);

  // Computed directly in this click handler (not an effect) — same reasoning
  // as ExecutionTimeline.tsx's showTooltip: a DOM measurement triggered by a
  // real event, not a derived-state effect, so there's nothing to
  // synchronize reactively and no risk of cascading-render lint warnings.
  function handleToggleMenu(taskId: string) {
    if (openMenuTaskId === taskId) {
      setOpenMenuTaskId(null);
      return;
    }
    const triggerEl = menuButtonRefs.current.get(taskId);
    setMenuPosition(triggerEl ? computeMenuPosition(triggerEl) : null);
    setOpenMenuTaskId(taskId);
  }

  function runMenuAction(action: () => void) {
    action();
    setOpenMenuTaskId(null);
  }

  return (
    <ul className="space-y-3">
      {sorted.map((task) => {
        const done = task.status === "completed";
        const menuOpen = openMenuTaskId === task.task_id;
        return (
          <li
            key={task.task_id}
            className={cn(
              "flex h-[69px] w-[358px] items-center gap-4 rounded-card border p-4 transition",
              done ? "border-transparent bg-ash" : "border-border bg-surface"
            )}
          >
            <button
              type="button"
              onClick={() => onToggleComplete(task.task_id)}
              disabled={done}
              aria-label={done ? "완료됨" : "완료 체크"}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border-2 text-xs",
                done
                  ? "animate-pop-check cursor-not-allowed border-fog bg-fog text-white"
                  : "border-border text-transparent"
              )}
            >
              ✓
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
              <p className={cn("truncate text-sm leading-none", done && "text-steel")} title={task.title}>
                {task.title}
              </p>
              <p className={cn("text-xs leading-none", done ? "text-fog" : "text-muted")}>
                {task.duration_minutes}분
              </p>
            </div>

            {/* 완료된 Task는 메뉴 자체를 숨긴다 — 나중에 하기/일정에서 제외 등
                완료 상태를 더 이상 바꿀 수 있는 조작이 없으므로. */}
            {!done && (
              <>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) menuButtonRefs.current.set(task.task_id, el);
                    else menuButtonRefs.current.delete(task.task_id);
                  }}
                  onClick={() => handleToggleMenu(task.task_id)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="더보기"
                  className="flex h-6 w-6 shrink-0 items-center justify-center text-muted"
                >
                  <EllipsisVertical size={16} />
                </button>
                {menuOpen && menuPosition && (
                  <TaskMenuPortal
                    top={menuPosition.top}
                    right={menuPosition.right}
                    registerRef={(el) => {
                      menuPanelRef.current = el;
                    }}
                    onDefer={() => runMenuAction(() => onDefer(task.task_id))}
                    onExclude={() => runMenuAction(() => onExclude(task.task_id))}
                  />
                )}
              </>
            )}
          </li>
        );
      })}
      {Array.from({ length: placeholderCount }, (_, i) => (
        <li
          key={`placeholder-${i}`}
          aria-hidden="true"
          className="invisible flex h-[69px] w-[358px] items-center gap-4 rounded-card border p-4"
        >
          <span className="h-5 w-5 shrink-0 rounded-[4px] border-2" />
          <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
            <p className="truncate text-sm leading-none">placeholder</p>
            <p className="text-xs leading-none">0분</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
