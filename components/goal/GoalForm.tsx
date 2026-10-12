"use client";

import { useState } from "react";

import { IconCalendar } from "@tabler/icons-react";

import { useLoginGate } from "@/components/auth/LoginGateProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { addDays, enumerateDates, todayStr } from "@/lib/dateUtils";
import { useAppStore } from "@/lib/store";
import type { Goal } from "@/lib/types";

const MAX_CONTEXT_LENGTH = 500;
const MAX_PLAN_DAYS = 7;

// Hides (not removes) the browser's own calendar-picker icon so our Tabler
// IconCalendar overlay doesn't show two icons — the native indicator still
// sits there and still opens the native picker on click, just invisible,
// with our icon (pointer-events-none, so clicks pass through to it) drawn
// in the same spot. webkit-only (Chrome/Edge/Safari); Firefox's date input
// icon isn't stylable this way and will still show its own.
const HIDE_NATIVE_DATE_ICON_CLASSNAME = "[&::-webkit-calendar-picker-indicator]:opacity-0";

export interface GoalFormValues {
  title: string;
  startDate: string;
  targetDate: string;
  weekdayMinutes: number;
  weekendMinutes: number;
  contextText: string | null;
}

export function GoalForm({
  initialGoal,
  initialTitle,
  initialContext,
  isLoading,
  onSubmit,
}: {
  initialGoal: Goal | null;
  initialTitle?: string;
  initialContext?: string | null;
  isLoading: boolean;
  onSubmit: (values: GoalFormValues) => void;
}) {
  const draftError = useAppStore((s) => s.draftError);
  const { isOnboarded, open: openLoginGate } = useLoginGate();

  const [title, setTitle] = useState(initialGoal?.title ?? initialTitle ?? "");
  const [startDate, setStartDate] = useState(initialGoal?.start_date ?? todayStr());
  const [targetDate, setTargetDate] = useState(initialGoal?.target_date ?? "");
  const [weekdayMinutes, setWeekdayMinutes] = useState(
    initialGoal ? String(initialGoal.weekday_minutes) : ""
  );
  const [weekendMinutes, setWeekendMinutes] = useState(
    initialGoal ? String(initialGoal.weekend_minutes) : ""
  );
  const [context, setContext] = useState(initialGoal?.context_text ?? initialContext ?? "");

  const weekday = Number(weekdayMinutes);
  const weekend = Number(weekendMinutes);

  const dayCount =
    startDate && targetDate && targetDate >= startDate
      ? enumerateDates(startDate, targetDate).length
      : 0;
  const exceedsMaxDays = dayCount > MAX_PLAN_DAYS;
  const maxTargetDate = startDate ? addDays(startDate, MAX_PLAN_DAYS - 1) : undefined;

  const canSubmit =
    title.trim().length > 0 &&
    startDate.length > 0 &&
    targetDate.length > 0 &&
    targetDate >= startDate &&
    !exceedsMaxDays &&
    weekdayMinutes.length > 0 &&
    weekendMinutes.length > 0 &&
    weekday >= 0 &&
    weekend >= 0;

  function handleSubmit() {
    if (!canSubmit || isLoading) return;
    if (!isOnboarded) {
      openLoginGate();
      return;
    }
    onSubmit({
      title: title.trim(),
      startDate,
      targetDate,
      weekdayMinutes: weekday,
      weekendMinutes: weekend,
      contextText: context.trim().length > 0 ? context.trim() : null,
    });
  }

  return (
    <Card dataLd="card-ai-planner-form" className="flex h-full flex-col p-5">
      <div className="space-y-1.5 border-b border-border pb-4">
        <h2 className="text-lg font-medium">목표 정보</h2>
        <p className="text-sm text-muted">목표와 현재 상황을 알려주세요.</p>
      </div>

      <div className="mt-6 space-y-6">
        <Field label="목표명" required>
          <Input
            borderClassName="border border-ash"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={(e) => {
              // 클릭이든 Tab으로 들어온 키보드 포커스든 동일하게 가로챈다.
              // 포커스 복귀(restoreFocus) 없이 blur만 하므로, 팝업을 닫아도
              // 이 입력란으로 되돌아와 다시 열리는 루프가 생기지 않는다.
              if (!isOnboarded) {
                e.target.blur();
                openLoginGate({ restoreFocus: false });
              }
            }}
            placeholder="예) 포트폴리오 1개 완성하기"
          />
        </Field>

        {/* 날짜 그룹과 시간 그룹만 예외적으로 16px — 목표일 아래에 항상 확보된
            에러 슬롯(입력창-에러줄 6px gap + 한 줄 높이 ≈16px, 이 div 바깥쪽
            간격과는 별개)은 그대로 두고, 날짜 Grid 바깥쪽에만 이 16px을 추가
            한다. 바깥 space-y-6(24px)은 이 div 자체에는 평소처럼 적용되고,
            안쪽의 이 space-y-4만 두 그룹 사이를 따로 좁힌다 — 같은
            margin-top 속성에 서로 다른 값을 억지로 겹쳐 쓰는 방식(승자가
            불확실) 대신, 중첩된 컨테이너로 두 간격을 완전히 분리했다. */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일" required>
              <div className="relative">
                <Input
                  borderClassName="border border-ash"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={HIDE_NATIVE_DATE_ICON_CLASSNAME}
                />
                <IconCalendar
                  size={16}
                  stroke={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </Field>
            <Field
              label="목표일"
              required
              reserveErrorSpace
              error={
                targetDate && targetDate < startDate
                  ? "목표일은 시작일 이후여야 해요."
                  : exceedsMaxDays
                    ? `최대 ${MAX_PLAN_DAYS}일까지만 가능해요.`
                    : undefined
              }
            >
              <div className="relative">
                <Input
                  borderClassName="border border-ash"
                  type="date"
                  value={targetDate}
                  min={startDate}
                  max={maxTargetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className={HIDE_NATIVE_DATE_ICON_CLASSNAME}
                />
                <IconCalendar
                  size={16}
                  stroke={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="평일 하루 가능 시간(분)" required>
              <Input
                borderClassName="border border-ash"
                type="number"
                min={0}
                step={5}
                value={weekdayMinutes}
                onChange={(e) => setWeekdayMinutes(e.target.value)}
                placeholder="예) 60"
              />
            </Field>
            <Field label="주말 하루 가능 시간(분)" required>
              <Input
                borderClassName="border border-ash"
                type="number"
                min={0}
                step={5}
                value={weekendMinutes}
                onChange={(e) => setWeekendMinutes(e.target.value)}
                placeholder="예) 120"
              />
            </Field>
          </div>
        </div>

        <Field label="현재 상황을 입력해주세요">
          <div className="relative">
            <Textarea
              borderClassName="border border-ash"
              rows={4}
              maxLength={MAX_CONTEXT_LENGTH}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="예) 컴활 1급 3과목 중 컴퓨터 일반은 1회독을 완료했어요. 스프레드시트 일반과 데이터베이스 일반 학습, 문제풀이가 남아 있어요."
              className="pb-6"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted">
              {context.length}/{MAX_CONTEXT_LENGTH}
            </span>
          </div>
        </Field>
      </div>

      <div className="mt-auto space-y-4 pt-6">
        <div className="flex gap-2 rounded-card bg-accent/10 p-4">
          <span aria-hidden="true" className="text-accent">
            ✦
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-accent">AI 계획 팁</p>
            <p className="text-xs text-muted">
              완료한 내용과 남은 일을 알려주시면 더 구체적인 계획을 만들 수 있어요.
            </p>
          </div>
        </div>

        {draftError && (
          <p className="rounded-btn border border-danger px-3 py-2.5 text-sm text-foreground">{draftError}</p>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit || isLoading} className="w-full">
          생성하기
        </Button>
      </div>
    </Card>
  );
}
