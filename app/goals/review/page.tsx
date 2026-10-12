"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/layout/AppHeader";
import { AddTaskModal } from "@/components/plan/AddTaskModal";
import { DayGroup } from "@/components/plan/DayGroup";
import { PlanSettingCard } from "@/components/plan/PlanSettingCard";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { dayBudgetFor, enumerateDates, formatWeekdayShort, getDayOfMonth } from "@/lib/dateUtils";
import { reconcileDayTasks } from "@/lib/mockAi";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";

const SWIPE_THRESHOLD_PX = 50;
const RECONCILE_DELAY_MS = 1000;
// lib/mockAi.ts의 MAX_TASKS_PER_DAY와 동일한 기준(이 화면은 항상 draft라 completed/cancelled 구분 불필요).
const MAX_TASKS_PER_DAY = 8;
const RECONCILE_INSUFFICIENT_TIME_MESSAGE =
  "변경한 내용과 가용 시간만으로는 계획을 모두 배치하기 어려워요. 가용 시간을 늘리거나 할 일을 줄여 주세요.";
const DAY_RECONCILE_INSUFFICIENT_TIME_MESSAGE =
  "이 날짜의 가용 시간만으로는 모든 계획의 시간을 배분하기 어려워요. 가용 시간을 늘리거나 계획을 줄여 주세요.";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export default function PlanEditPage() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const draftPlan = useAppStore((s) => s.draftPlan);
  const applyDraftReconciliation = useAppStore((s) => s.applyDraftReconciliation);

  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const [weekdayMinutes, setWeekdayMinutes] = useState(0);
  const [weekendMinutes, setWeekendMinutes] = useState(0);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftTargetDate, setDraftTargetDate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [addTaskDate, setAddTaskDate] = useState<string | null>(null);
  const [reconcilingDates, setReconcilingDates] = useState<Set<string>>(new Set());
  const [dayReconcileErrors, setDayReconcileErrors] = useState<Record<string, string>>({});
  // Dates currently flagged by a FAILED 완료 validation attempt — distinct
  // from "this date currently has an undetermined task" (hasUndeterminedOnDate).
  // Populated only inside handleDone, as a fresh snapshot each time (never
  // just added to), and actively cleared per-date by clearMissingDurationError
  // (below) — not just masked at display time — so a date that was fixed and
  // later gets a brand-new undetermined task doesn't resurrect a stale error
  // without the user clicking 완료 again.
  const [missingDurationErrorDates, setMissingDurationErrorDates] = useState<Set<string>>(new Set());
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // Both the mobile (one active day at a time) and desktop (all days,
  // CSS-hidden below lg) layouts mount a DayGroup for the same date, so a
  // date can have more than one DOM node registered at once — keep every
  // node and pick whichever is actually visible when we need to scroll to it.
  const dayGroupRefs = useRef(new Map<string, HTMLDivElement[]>());

  function registerDayGroupRef(date: string, el: HTMLDivElement | null) {
    const existing = dayGroupRefs.current.get(date) ?? [];
    const alive = existing.filter((node) => node.isConnected && node !== el);
    if (el) alive.push(el);
    dayGroupRefs.current.set(date, alive);
  }

  // Measures the (desktop) calendar card's real rendered height so every
  // date card in the lg+ grid can be locked to the exact same height via
  // the --calendar-height-px CSS variable (set on the grid container below,
  // consumed by DayGroup's own lg:h-[var(--calendar-height-px,...)] class) —
  // not a guessed pixel value, and it stays in sync if the calendar's own
  // height ever changes (e.g. a 4-week vs 6-week month).
  const calendarCardRef = useRef<HTMLDivElement>(null);
  const [calendarHeightPx, setCalendarHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    // Deliberately depends on `initialized`, not `[]`: this component
    // returns <LoadingScreen /> (no calendar in the DOM at all) until
    // `initialized` flips true, so a one-shot effect with empty deps can
    // fire on the very first commit — while calendarCardRef.current is
    // still null — and then never run again, permanently leaving
    // calendarHeightPx at null (and every date card stuck on the
    // var(--calendar-height-px,420px) fallback, regardless of the
    // calendar's real height). Re-running when `initialized` becomes true
    // guarantees we attach the ResizeObserver to the actually-mounted node.
    const el = calendarCardRef.current;
    if (!el) return;
    const update = () => setCalendarHeightPx(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [initialized]);

  function hasUndeterminedOnDate(date: string) {
    return localTasks.some((t) => t.scheduled_date === date && t.duration_minutes <= 0);
  }

  // Drop a date from missingDurationErrorDates — called right at the two
  // event handlers that can resolve it (reconcile success, delete-the-last-
  // undetermined-task), not reactively from an effect: by the time an
  // effect saw localTasks change it would already be one render behind,
  // and setState-in-effect is its own footgun (cascading renders).
  function clearMissingDurationError(date: string) {
    setMissingDurationErrorDates((prev) => {
      if (!prev.has(date)) return prev;
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
  }

  useEffect(() => {
    if (!hydrated || draftPlan) return;
    router.replace("/");
  }, [hydrated, draftPlan, router]);

  if (!initialized && hydrated && draftPlan) {
    setLocalTasks(draftPlan.tasks);
    setWeekdayMinutes(draftPlan.goal.weekday_minutes);
    setWeekendMinutes(draftPlan.goal.weekend_minutes);
    setDraftStartDate(draftPlan.goal.start_date);
    setDraftTargetDate(draftPlan.goal.target_date);
    setInitialized(true);
  }

  const dates = useMemo(() => {
    if (!draftStartDate || !draftTargetDate) return [];
    return enumerateDates(draftStartDate, draftTargetDate);
  }, [draftStartDate, draftTargetDate]);

  const clampedDayIndex = Math.min(activeDayIndex, Math.max(0, dates.length - 1));

  if (!hydrated || !draftPlan || !initialized) {
    return <LoadingScreen />;
  }

  const goalId = draftPlan.goal.goal_id;

  function handleAddTask(date: string, title: string) {
    setLocalTasks((prev) => {
      const dayTasks = prev.filter((t) => t.scheduled_date === date);
      if (dayTasks.length >= MAX_TASKS_PER_DAY) return prev;
      const maxOrder = dayTasks.reduce((max, t) => Math.max(max, t.order), 0);
      const newTask: Task = {
        task_id: `task_${crypto.randomUUID()}`,
        goal_id: goalId,
        title,
        scheduled_date: date,
        duration_minutes: 0,
        order: maxOrder + 1,
        status: "pending",
        original_date: null,
        deferred_at: null,
      };
      return [...prev, newTask];
    });
    setHasChanges(true);
  }

  function handleRequestAdd(date: string) {
    setAddTaskDate(date);
  }

  function handleConfirmAddTask(title: string) {
    if (addTaskDate) handleAddTask(addTaskDate, title);
    setAddTaskDate(null);
  }

  function handleRemove(taskId: string) {
    const removedTask = localTasks.find((t) => t.task_id === taskId);
    setLocalTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    setHasChanges(true);

    if (removedTask) {
      const stillUndetermined = localTasks.some(
        (t) => t.task_id !== taskId && t.scheduled_date === removedTask.scheduled_date && t.duration_minutes <= 0
      );
      if (!stillUndetermined) clearMissingDurationError(removedTask.scheduled_date);
    }
  }

  function handleChangeDuration(taskId: string, minutes: number) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.task_id === taskId ? { ...t, duration_minutes: minutes } : t))
    );
    setHasChanges(true);
  }

  async function handleReconcileDay(date: string) {
    if (reconcilingDates.has(date)) return;

    setReconcilingDates((prev) => new Set(prev).add(date));
    setDayReconcileErrors((prev) => {
      if (!(date in prev)) return prev;
      const next = { ...prev };
      delete next[date];
      return next;
    });

    await sleep(RECONCILE_DELAY_MS);

    const dayTasks = localTasks
      .filter((t) => t.scheduled_date === date)
      .sort((a, b) => a.order - b.order);
    const budget = dayBudgetFor(date, weekdayMinutes, weekendMinutes);

    const result = reconcileDayTasks({
      tasks: dayTasks.map((t) => ({ task_id: t.task_id, title: t.title, order: t.order })),
      budget_minutes: budget,
    });

    setReconcilingDates((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });

    if (result.status === "insufficient_time") {
      setDayReconcileErrors((prev) => ({ ...prev, [date]: DAY_RECONCILE_INSUFFICIENT_TIME_MESSAGE }));
      return;
    }

    const byTaskId = new Map(result.tasks.map((t) => [t.task_id, t.duration_minutes]));
    setLocalTasks((prev) =>
      prev.map((t) => {
        const duration = byTaskId.get(t.task_id);
        return duration === undefined ? t : { ...t, duration_minutes: duration };
      })
    );
    setHasChanges(true);
    // reconcileDayTasks assigns every Task on this date a duration > 0, so a
    // success here always fully resolves it.
    clearMissingDurationError(date);
  }

  function handleReorder(taskId: string, newIndex: number) {
    setLocalTasks((prev) => {
      const task = prev.find((t) => t.task_id === taskId);
      if (!task) return prev;
      const sameDay = prev
        .filter((t) => t.scheduled_date === task.scheduled_date)
        .sort((a, b) => a.order - b.order);
      const fromIndex = sameDay.findIndex((t) => t.task_id === taskId);
      if (fromIndex === -1) return prev;
      const clampedIndex = Math.max(0, Math.min(newIndex, sameDay.length - 1));
      if (clampedIndex === fromIndex) return prev;

      const reordered = [...sameDay];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(clampedIndex, 0, moved);
      const orderByTaskId = new Map(reordered.map((t, i) => [t.task_id, i + 1]));

      return prev.map((t) => {
        const order = orderByTaskId.get(t.task_id);
        return order === undefined ? t : { ...t, order };
      });
    });
    setHasChanges(true);
  }

  function handleChangeRange(start: string, end: string) {
    setDraftStartDate(start);
    setDraftTargetDate(end);
    setHasChanges(true);
  }

  function handleChangeWeekday(minutes: number) {
    setWeekdayMinutes(minutes);
    setHasChanges(true);
  }

  function handleChangeWeekend(minutes: number) {
    setWeekendMinutes(minutes);
    setHasChanges(true);
  }

  function handleBack() {
    if (!hasChanges) {
      router.push("/");
      return;
    }
    setShowDiscardDialog(true);
  }

  function handleDiscard() {
    setShowDiscardDialog(false);
    router.push("/");
  }

  async function handleDone() {
    if (isReconciling) return;
    setReconcileError(null);

    const undeterminedDates = dates.filter((d) => hasUndeterminedOnDate(d));
    if (undeterminedDates.length > 0) {
      // Replace the whole set with exactly today's failures — not a union
      // with whatever was flagged before, so a date that got fixed earlier
      // (and only now has an unrelated NEW undetermined Task) starts clean
      // until this 완료 click says otherwise.
      setMissingDurationErrorDates(new Set(undeterminedDates));
      const firstUndeterminedDate = undeterminedDates[0];
      setActiveDayIndex(dates.indexOf(firstUndeterminedDate));
      await nextAnimationFrame();
      const candidates = dayGroupRefs.current.get(firstUndeterminedDate) ?? [];
      const target = candidates.find((el) => el.getClientRects().length > 0) ?? candidates[0];
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
      return;
    }

    setIsReconciling(true);
    await sleep(RECONCILE_DELAY_MS);
    const result = applyDraftReconciliation({
      tasks: localTasks,
      weekdayMinutes,
      weekendMinutes,
      startDate: draftStartDate,
      targetDate: draftTargetDate,
    });
    setIsReconciling(false);
    if (result === "insufficient_time") {
      setReconcileError(RECONCILE_INSUFFICIENT_TIME_MESSAGE);
      return;
    }
    router.push("/");
  }

  function handleSwipeStart(e: React.PointerEvent) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }

  function handleSwipeEnd(e: React.PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) setActiveDayIndex(Math.min(clampedDayIndex + 1, dates.length - 1));
    else setActiveDayIndex(Math.max(clampedDayIndex - 1, 0));
  }

  const activeDate = dates[clampedDayIndex];

  return (
    <div className="relative mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
      <AppHeader
        breadcrumb={[{ label: "AI 플래너" }, { label: "계획 생성" }, { label: "계획 수정" }]}
        action={
          <>
            <Button variant="header" size="sm" onClick={handleBack} disabled={isReconciling}>
              취소
            </Button>
            <Button size="sm" onClick={handleDone} disabled={isReconciling}>
              완료
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-heading-sm font-medium text-foreground">계획 수정하기</h1>
          <p className="text-sm text-muted">AI가 만든 계획을 내 상황에 맞게 조정해보세요.</p>
        </div>

        {reconcileError && (
          <p className="rounded-btn border border-danger px-3 py-2.5 text-sm text-foreground">
            {reconcileError}
          </p>
        )}

        {/* Mobile: 날짜 Navigation + Swipe로 하루씩 전환 */}
        <div className="space-y-4 lg:hidden">
          <PlanSettingCard
            startDate={draftStartDate}
            endDate={draftTargetDate}
            weekdayMinutes={weekdayMinutes}
            weekendMinutes={weekendMinutes}
            onChangeRange={handleChangeRange}
            onChangeWeekday={handleChangeWeekday}
            onChangeWeekend={handleChangeWeekend}
          />

          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {dates.map((date, i) => (
              <button
                key={date}
                type="button"
                onClick={() => setActiveDayIndex(i)}
                className={
                  i === clampedDayIndex
                    ? "flex flex-1 flex-col items-center gap-0.5 rounded-btn bg-accent/10 py-1.5 text-accent"
                    : "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-muted"
                }
              >
                <span className="text-[11px]">{formatWeekdayShort(date)}</span>
                <span className="text-sm font-medium">{getDayOfMonth(date)}</span>
              </button>
            ))}
          </div>

          {activeDate && (
            <div
              onPointerDown={handleSwipeStart}
              onPointerUp={handleSwipeEnd}
              onPointerCancel={() => {
                swipeStart.current = null;
              }}
              style={{ touchAction: "pan-y" }}
            >
              <DayGroup
                date={activeDate}
                tasks={localTasks.filter((t) => t.scheduled_date === activeDate)}
                budgetMinutes={dayBudgetFor(activeDate, weekdayMinutes, weekendMinutes)}
                isReconciling={reconcilingDates.has(activeDate)}
                reconcileError={dayReconcileErrors[activeDate]}
                showMissingDurationError={missingDurationErrorDates.has(activeDate) && hasUndeterminedOnDate(activeDate)}
                onReorder={handleReorder}
                onRemove={handleRemove}
                onRequestAdd={handleRequestAdd}
                onChangeDuration={handleChangeDuration}
                onRequestReconcile={handleReconcileDay}
                registerRef={registerDayGroupRef}
              />
            </div>
          )}
        </div>

        {/* Desktop: 계획 설정 Card + Daily Plan Card Grid (최대 4열).
            items-start (not the grid default, which is effectively
            "stretch"): without it, the calendar wrapper below — which has
            no explicit height of its own — gets stretched to match
            whatever height the row's date cards resolve to, so measuring
            it would read back that already-stretched (circular, wrong)
            height instead of the calendar's true natural height. With
            items-start, every grid item (including the date cards, which
            have their own explicit lg:h-[...] anyway) sizes to its own
            content/explicit height instead of the row's tallest item. */}
        <div
          className="hidden items-start gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          style={calendarHeightPx ? ({ "--calendar-height-px": `${calendarHeightPx}px` } as React.CSSProperties) : undefined}
        >
          <div ref={calendarCardRef}>
            <PlanSettingCard
              startDate={draftStartDate}
              endDate={draftTargetDate}
              weekdayMinutes={weekdayMinutes}
              weekendMinutes={weekendMinutes}
              onChangeRange={handleChangeRange}
              onChangeWeekday={handleChangeWeekday}
              onChangeWeekend={handleChangeWeekend}
            />
          </div>
          {dates.map((date) => (
            <DayGroup
              key={date}
              date={date}
              tasks={localTasks.filter((t) => t.scheduled_date === date)}
              budgetMinutes={dayBudgetFor(date, weekdayMinutes, weekendMinutes)}
              isReconciling={reconcilingDates.has(date)}
              reconcileError={dayReconcileErrors[date]}
              showMissingDurationError={missingDurationErrorDates.has(date) && hasUndeterminedOnDate(date)}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onRequestAdd={handleRequestAdd}
              onChangeDuration={handleChangeDuration}
              onRequestReconcile={handleReconcileDay}
              registerRef={registerDayGroupRef}
            />
          ))}
        </div>
      </div>

      <AddTaskModal
        open={addTaskDate !== null}
        onClose={() => setAddTaskDate(null)}
        onAdd={handleConfirmAddTask}
      />

      {isReconciling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-5 text-center shadow-pop">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-muted">수정한 내용을 반영하고 있어요.</p>
            <p className="text-sm text-muted">가용 시간에 맞춰 계획을 다시 조정하고 있어요.</p>
          </div>
        </div>
      )}

      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
            <div className="space-y-1">
              <h2 className="text-base font-medium">수정한 내용이 있어요</h2>
              <p className="text-sm text-muted">저장하지 않고 나가면 수정한 내용이 사라져요.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1"
              >
                계속 수정하기
              </Button>
              <Button variant="danger" onClick={handleDiscard} className="flex-1">
                나가기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
