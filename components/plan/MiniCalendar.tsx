"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import {
  addDays,
  addMonths,
  getDayOfMonth,
  getMonthGridCells,
  getWeekday,
  getYearMonthLabel,
  startOfMonth,
  todayStr,
} from "@/lib/dateUtils";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_RANGE_DAYS = 7;

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

export function MiniCalendar({
  mode = "range",
  startDate,
  endDate,
  onChangeRange,
  selectedDate,
  onSelectDate,
  today,
  planStartDate,
  planEndDate,
}: {
  mode?: "range" | "single";
  startDate?: string;
  endDate?: string;
  onChangeRange?: (start: string, end: string) => void;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  today?: string;
  /** "single" mode only — the dashboard's current active plan's date range,
   *  shown as a light-blue band purely for visual reference (no editing,
   *  unlike "range" mode's own startDate/endDate, which stay a separate
   *  concept). Ignored in "range" mode. Omit both to fall back to the
   *  plain selected-date-only calendar. */
  planStartDate?: string;
  planEndDate?: string;
}) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(mode === "single" ? selectedDate ?? todayStr() : startDate ?? todayStr())
  );
  const [anchor, setAnchor] = useState<string | null>(null);

  const cells = getMonthGridCells(viewMonth);
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  function handleDateClick(date: string) {
    if (mode === "single") {
      onSelectDate?.(date);
      return;
    }
    if (anchor) {
      let newStart = anchor;
      let newEnd = date;
      if (newEnd < newStart) [newStart, newEnd] = [newEnd, newStart];
      const maxEnd = addDays(newStart, MAX_RANGE_DAYS - 1);
      if (newEnd > maxEnd) newEnd = maxEnd;
      onChangeRange?.(newStart, newEnd);
      setAnchor(null);
    } else {
      setAnchor(date);
      onChangeRange?.(date, date);
    }
  }

  return (
    // Single mode: nav row, weekday header and date grid all live inside one
    // 280px wrapper centered with margin:auto, so the month label/arrows line
    // up with the same edges as the date columns instead of each piece being
    // centered independently within a wider card.
    // Fixed 280px (7 × 40px cells) for both modes now — range mode used to
    // stretch to its container (`aspect-square w-full`), which is exactly
    // why its day cells didn't match the dashboard's fixed 40×40px cells.
    <div className="mx-auto w-[280px] space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] bg-transparent p-2 text-muted transition hover:bg-foreground/5"
          aria-label="이전 달"
        >
          <ChevronIcon direction="left" />
        </button>
        <p className="flex h-[38px] w-[156px] items-center justify-center text-base font-medium text-muted">
          {getYearMonthLabel(viewMonth)}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[8px] bg-transparent p-2 text-muted transition hover:bg-foreground/5"
          aria-label="다음 달"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div>
        <div className="grid grid-cols-[repeat(7,40px)] gap-0">
          {WEEKDAY_LABELS.map((w) => (
            <span
              key={w}
              className="flex h-[40px] w-[40px] items-center justify-center text-[14px] text-muted"
            >
              {w}
            </span>
          ))}
        </div>

        {mode === "single" ? (
          // Per-row (not one flat grid) — same technique "range" mode uses
          // below — so the plan-period band naturally breaks at week
          // boundaries instead of needing special-case logic for it. Visually
          // identical to the old flat auto-rows grid when no plan range is
          // given (0 gap, same 40px cells, rows simply stack).
          <div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[repeat(7,40px)] gap-0">
                {row.map((cell) => {
                  const weekday = getWeekday(cell.date);
                  const weekdayTextClass =
                    weekday === 0 ? "text-sunday" : weekday === 6 ? "text-saturday" : "text-foreground";
                  const isToday = cell.date === today;
                  const isSelected = cell.date === selectedDate;
                  const isDarkHighlight = isToday || isSelected;
                  const inPlanRange =
                    cell.inCurrentMonth &&
                    !!planStartDate &&
                    !!planEndDate &&
                    cell.date >= planStartDate &&
                    cell.date <= planEndDate;
                  const isPlanStart = inPlanRange && cell.date === planStartDate;
                  const isPlanEnd = inPlanRange && cell.date === planEndDate;

                  const textClassName = !cell.inCurrentMonth
                    ? "text-muted/40"
                    : isToday
                      ? "font-medium text-accent-foreground"
                      : isSelected
                        ? "font-medium text-accent"
                        : weekdayTextClass;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!cell.inCurrentMonth}
                      onClick={() => handleDateClick(cell.date)}
                      className={cn(
                        // The button itself IS the plan-period band layer —
                        // driven purely by inPlanRange/isPlanStart/isPlanEnd,
                        // never by today/selected state, so the band's shape
                        // (and its edge-only rounding) never breaks or shifts
                        // depending on which date is highlighted. Today/
                        // selected get their own rounded overlay layer on
                        // top (below), independent of this band shape.
                        "group relative flex h-10 w-10 min-h-10 min-w-10 shrink-0 items-center justify-center text-sm transition",
                        inPlanRange && "bg-[#DBEAFE]",
                        isPlanStart && "rounded-l-[8px]",
                        isPlanEnd && "rounded-r-[8px]"
                      )}
                    >
                      {/* 일반 날짜만 회색 Hover — 계획 기간 띠(연한 블루) 위에는 별도
                          Hover 오버레이를 얹지 않는다. 얹으면 색이 섞이거나 Hover
                          시 띠가 끊겨 보일 위험이 있어, 계획 기간 안에서는 기존 블루
                          배경을 그대로 두는 쪽이 "끊기지 않는다"를 가장 확실히
                          보장한다. */}
                      {cell.inCurrentMonth && !isDarkHighlight && !inPlanRange && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-[8px] bg-[#F5F5F5] opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      )}
                      {isDarkHighlight && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none absolute inset-0 rounded-[8px]",
                            // Today wins when a date is both today and
                            // selected — a single overlay, so the two never
                            // stack/double up. Selected (non-today) has no
                            // fill of its own, so the plan-period band
                            // underneath still shows through its border.
                            isToday ? "bg-accent" : "border-2 border-accent"
                          )}
                        />
                      )}
                      <span className={cn("relative z-10", textClassName)}>{getDayOfMonth(cell.date)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* 각 Date Cell이 직접 range-start / range-middle / range-end 상태를 가진다.
             Range Background를 별도의 absolute 레이어로 띄우지 않고, Cell 자체의 배경/radius로
             하나의 이어진 띠처럼 보이게 한다. Cell 사이 gap은 항상 0.
             라운딩은 상태별로 분리한다 — 시작/끝 날짜(진한 배경)만 rounded-l/r-[8px]로
             바깥쪽 두 모서리만 깎고 안쪽(기간 내부로 향하는 쪽)은 사각 그대로 둬서, 그
             안쪽에 맞붙는 중간 날짜(연한 배경, radius 없음)와 틈 없이 이어지게 한다.
             모든 Cell에 공통으로 radius를 주면 중간 날짜까지 둥글어져 기간 배경이
             날짜별로 끊어져 보이므로, 절대 공통 처리하지 않는다. */
          <div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-[repeat(7,40px)] gap-0">
                {row.map((cell) => {
                  const weekday = getWeekday(cell.date);
                  const weekdayTextClass =
                    weekday === 0 ? "text-sunday" : weekday === 6 ? "text-saturday" : "text-foreground";
                  const inRange = cell.date >= (startDate ?? "") && cell.date <= (endDate ?? "");
                  const isStart = cell.date === startDate;
                  const isEnd = cell.date === endDate;
                  const isRangeEdge = isStart || isEnd;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={!cell.inCurrentMonth}
                      onClick={() => handleDateClick(cell.date)}
                      className={cn(
                        "relative flex h-10 w-10 min-h-10 min-w-10 shrink-0 items-center justify-center text-sm transition",
                        !cell.inCurrentMonth && "text-muted/40",
                        cell.inCurrentMonth && !isRangeEdge && weekdayTextClass,
                        cell.inCurrentMonth && !isRangeEdge && !inRange && "hover:bg-accent/5",
                        inRange && !isRangeEdge && "bg-accent/20",
                        isStart && "rounded-l-[8px]",
                        isEnd && "rounded-r-[8px]",
                        isRangeEdge && "bg-accent font-medium text-accent-foreground"
                      )}
                    >
                      {getDayOfMonth(cell.date)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
