"use client";

import { AvailableTimeFields } from "@/components/plan/AvailableTimeFields";
import { MiniCalendar } from "@/components/plan/MiniCalendar";

export function PlanSettingCard({
  startDate,
  endDate,
  weekdayMinutes,
  weekendMinutes,
  onChangeRange,
  onChangeWeekday,
  onChangeWeekend,
}: {
  startDate: string;
  endDate: string;
  weekdayMinutes: number;
  weekendMinutes: number;
  onChangeRange: (start: string, end: string) => void;
  onChangeWeekday: (minutes: number) => void;
  onChangeWeekend: (minutes: number) => void;
}) {
  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <MiniCalendar startDate={startDate} endDate={endDate} onChangeRange={onChangeRange} />

      <hr className="border-border/60" />

      <AvailableTimeFields
        weekdayMinutes={weekdayMinutes}
        weekendMinutes={weekendMinutes}
        onChangeWeekday={onChangeWeekday}
        onChangeWeekend={onChangeWeekend}
      />
    </div>
  );
}
