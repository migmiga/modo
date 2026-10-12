"use client";

import { Field, Input } from "@/components/ui/Field";

export function AvailableTimeFields({
  weekdayMinutes,
  weekendMinutes,
  onChangeWeekday,
  onChangeWeekend,
}: {
  weekdayMinutes: number;
  weekendMinutes: number;
  onChangeWeekday: (minutes: number) => void;
  onChangeWeekend: (minutes: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="평일 하루 가능 시간">
        <div className="relative">
          <Input
            borderClassName="border border-ash"
            type="number"
            min={0}
            step={5}
            value={weekdayMinutes}
            onChange={(e) => onChangeWeekday(Number(e.target.value) || 0)}
            className="pr-9"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            분
          </span>
        </div>
      </Field>
      <Field label="주말 하루 가능 시간">
        <div className="relative">
          <Input
            borderClassName="border border-ash"
            type="number"
            min={0}
            step={5}
            value={weekendMinutes}
            onChange={(e) => onChangeWeekend(Number(e.target.value) || 0)}
            className="pr-9"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            분
          </span>
        </div>
      </Field>
    </div>
  );
}
