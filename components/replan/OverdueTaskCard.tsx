"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { IconAlertCircle, IconChevronDown, IconChevronUp } from "@tabler/icons-react";

import { AvailableTimeFields } from "@/components/plan/AvailableTimeFields";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Same hidden-but-functional scrollbar + edge-fade + floating chevron
// pattern as components/plan/DayGroup.tsx's task list — copied rather than
// shared since it's tightly coupled to each component's own row measuring,
// not pulled out into a reusable primitive anywhere else in this codebase.
const SCROLLBAR_HIDDEN_CLASSNAME = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const SCROLL_BUTTON_VISIBILITY_CLASSNAME = cn(
  "opacity-100 pointer-events-auto transition-opacity",
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
  "[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto",
  "focus-visible:opacity-100 focus-visible:pointer-events-auto"
);

const EDGE_FADE_VISIBILITY_CLASSNAME = cn(
  "opacity-0 transition-opacity",
  "[@media(hover:hover)]:opacity-100",
  "[@media(hover:hover)]:group-hover:opacity-0"
);

const ROW_FALLBACK_HEIGHT_PX = 84;
const ROW_GAP_PX = 8;

export interface OverdueItem {
  task_id: string;
  title: string;
  duration_minutes: number;
  state: "available" | "selected" | "excluded";
}

export function OverdueTaskCard({
  items,
  weekdayMinutes,
  weekendMinutes,
  onSelect,
  onExclude,
  onRestore,
  onChangeWeekday,
  onChangeWeekend,
  notice,
}: {
  items: OverdueItem[];
  weekdayMinutes: number;
  weekendMinutes: number;
  onSelect: (taskId: string) => void;
  onExclude: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onChangeWeekday: (minutes: number) => void;
  onChangeWeekend: (minutes: number) => void;
  /** 완료 시도가 처리 안 된 밀린 할 일 때문에 막혔을 때만 세팅 (§8-3). */
  notice?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const [canScroll, setCanScroll] = useState({ up: false, down: false });

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
    const rowHeight = sampleRow?.getBoundingClientRect().height ?? ROW_FALLBACK_HEIGHT_PX;
    const step = rowHeight + ROW_GAP_PX;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ top: direction * step, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div
      className={cn(
        "flex min-h-[260px] max-h-[60vh] flex-col rounded-card border border-border bg-surface p-5 shadow-card",
        "lg:h-[var(--calendar-height-px,420px)] lg:max-h-none"
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="text-sm font-medium">
          밀린 할 일 <span className="font-bold text-accent">{items.length}</span>
        </h3>
        {notice && (
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-[#DC2626]">
            <IconAlertCircle size={16} stroke={1.75} aria-hidden="true" />
            {notice}
          </span>
        )}
      </div>

      <div className="group relative mt-3 min-h-0 flex-1">
        <div
          ref={scrollRef}
          tabIndex={0}
          role="region"
          aria-label="밀린 할 일 목록"
          className={cn("h-full w-full overflow-y-auto outline-none", SCROLLBAR_HIDDEN_CLASSNAME)}
        >
          <div ref={listRef} className="space-y-2">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">밀린 할 일이 없어요.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.task_id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(item.task_id, el);
                    else rowRefs.current.delete(item.task_id);
                  }}
                  className={cn(
                    "space-y-2 rounded-card border px-3 py-2.5 transition-colors",
                    item.state === "selected"
                      ? "border-[#93C5FD] bg-[#EFF6FF]"
                      : item.state === "excluded"
                        ? "border-border bg-surface opacity-60"
                        : "border-border bg-surface"
                  )}
                >
                  {/* 제목이 길어지면 "· 예상 N분"이 자연스럽게 다음 줄로 내려가도록
                      flex가 아닌 한 덩어리의 줄바꿈 가능한 텍스트로 둔다. */}
                  <p className="break-words leading-snug">
                    <span className="text-sm font-medium text-foreground">{item.title}</span>{" "}
                    <span className="text-xs text-fog">· 예상 {item.duration_minutes}분</span>
                  </p>
                  {item.state === "excluded" ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 rounded-badge bg-ash px-3 py-1.5 text-center text-xs font-medium text-steel">
                        제외됨
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="flex-1"
                        onClick={() => onRestore(item.task_id)}
                      >
                        복구
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outlineBlue"
                        size="xs"
                        className="flex-1"
                        onClick={() => onSelect(item.task_id)}
                      >
                        {item.state === "selected" ? "선택됨" : "계획에 넣기"}
                      </Button>
                      <Button
                        variant="outlineGray"
                        size="xs"
                        className="flex-1"
                        onClick={() => onExclude(item.task_id)}
                      >
                        일정에서 제외
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
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
            aria-label="밀린 할 일 목록 위로 스크롤"
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
            aria-label="밀린 할 일 목록 아래로 스크롤"
            className={cn(
              "absolute bottom-2 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur-sm",
              SCROLL_BUTTON_VISIBILITY_CLASSNAME
            )}
          >
            <IconChevronDown size={16} stroke={1.75} className="text-muted" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-3 shrink-0 space-y-3">
        <hr className="border-border/60" />
        <AvailableTimeFields
          weekdayMinutes={weekdayMinutes}
          weekendMinutes={weekendMinutes}
          onChangeWeekday={onChangeWeekday}
          onChangeWeekend={onChangeWeekend}
        />
      </div>
    </div>
  );
}
