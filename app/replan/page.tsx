"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useRequireLogin } from "@/components/auth/LoginGateProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { DayGroup } from "@/components/plan/DayGroup";
import { OverdueTaskCard, type OverdueItem } from "@/components/replan/OverdueTaskCard";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { addDays, compareDates, dayBudgetFor, enumerateDates, formatWeekdayShort, getDayOfMonth, isWeekend, todayStr } from "@/lib/dateUtils";
import { reconcileDayTasks } from "@/lib/mockAi";
import { useAppStore } from "@/lib/store";
import type { Task } from "@/lib/types";

const SWIPE_THRESHOLD_PX = 50;
const RECONCILE_DELAY_MS = 1000;
const DAY_RECONCILE_INSUFFICIENT_TIME_MESSAGE =
  "이 날짜의 가용 시간만으로는 모든 계획의 시간을 배분하기 어려워요. 가용 시간을 늘리거나 계획을 줄여 주세요.";
const OVERDUE_NOTICE_MESSAGE = "재조정 일정이 아직 남아있어요.";
// Rolling window length used only once goal.target_date has already passed
// (enumerateDates(오늘, target_date) would otherwise be empty) — a temporary
// display range so this screen stays usable. goal.target_date itself is
// never mutated by this.
const FALLBACK_DISPLAY_WINDOW_DAYS = 14;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export default function ReplanPage() {
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const hydrated = useAppStore((s) => s.hydrated);
  const goal = useAppStore((s) => s.goal);
  const liveTasks = useAppStore((s) => s.tasks);
  const commitReplan = useAppStore((s) => s.commitReplan);

  const today = todayStr();

  // target_date가 아직 지나지 않았으면(오늘 포함) 그대로 target_date까지만
  // 보여주고, 이미 지난 경우에만 오늘부터 FALLBACK_DISPLAY_WINDOW_DAYS일짜리
  // 임시 범위로 대체한다 — target_date 값 자체는 어느 쪽도 변경하지 않는다.
  const computeDisplayEndDate = useCallback(
    (targetDate: string) =>
      compareDates(today, targetDate) > 0 ? addDays(today, FALLBACK_DISPLAY_WINDOW_DAYS) : targetDate,
    [today]
  );

  const [initialized, setInitialized] = useState(false);
  const [windowTasks, setWindowTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  // Pristine snapshot of every overdue task as it was at mount — "되돌리기"
  // restores from this, not from overdueTasks' own (possibly stale-by-then)
  // state, so a task's title/original duration always comes back exactly as
  // it was before this session touched anything.
  const [initialOverdueById, setInitialOverdueById] = useState<Map<string, Task>>(new Map());
  const [excludedTaskIds, setExcludedTaskIds] = useState<Set<string>>(new Set());
  const [sessionPlacedTaskIds, setSessionPlacedTaskIds] = useState<Set<string>>(new Set());
  const [selectedOverdueTaskId, setSelectedOverdueTaskId] = useState<string | null>(null);
  const [weekdayMinutes, setWeekdayMinutes] = useState(0);
  const [weekendMinutes, setWeekendMinutes] = useState(0);
  // "재조정 필요" 여부는 매번 다시 계산한다(derived) — 단순히 한 번 켜 두는 플래그가
  // 아니라, 실제로 미정(<=0) 소요 시간을 가진 Task가 그 날짜에 남아있는지를 매
  // 렌더에서 다시 확인한다(아래 hasUndeterminedOnDate). 이 Set은 그것만으로는
  // 설명되지 않는, 명시적으로 강제해야 하는 두 가지 경우만 담는다:
  //   1) 평일/주말 가능 시간이 바뀐 날짜(미정 Task가 없어도 재계산이 필요함)
  //   2) 이번 세션에 이미 한 번 AI 재조정을 마친 날짜에서 되돌리기가 일어난 경우
  //      (남은 Task들의 기존 배분이 더 이상 유효하지 않을 수 있음 — §5-2)
  // 단순 배치/되돌리기 자체는 더 이상 여기 추가하지 않는다 — hasUndeterminedOnDate
  // 가 이미 그 변화를 반영하므로, 추가했다가 바로 제거해도 "재조정 필요"가
  // 잘못 남아있던 버그가 여기서 고쳐진다.
  const [reconcileNeededDates, setReconcileNeededDates] = useState<Set<string>>(new Set());
  // 이번 세션에서 AI 재조정(날짜별)이 최소 한 번 성공한 날짜 — §5-2의 "이미
  // 재조정을 완료한 날짜" 조건을 판단하기 위해서만 쓰인다.
  const [reconciledThisSessionDates, setReconciledThisSessionDates] = useState<Set<string>>(new Set());
  const [completionErrorDates, setCompletionErrorDates] = useState<Set<string>>(new Set());
  const [reconcilingDates, setReconcilingDates] = useState<Set<string>>(new Set());
  const [dayReconcileErrors, setDayReconcileErrors] = useState<Record<string, string>>({});
  const [overdueNotice, setOverdueNotice] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const dayGroupRefs = useRef(new Map<string, HTMLDivElement[]>());

  function registerDayGroupRef(date: string, el: HTMLDivElement | null) {
    const existing = dayGroupRefs.current.get(date) ?? [];
    const alive = existing.filter((node) => node.isConnected && node !== el);
    if (el) alive.push(el);
    dayGroupRefs.current.set(date, alive);
  }

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeightPx, setCardHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => setCardHeightPx(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [initialized]);

  useEffect(() => {
    if (!hydrated) return;
    if (!goal) router.replace("/dashboard");
  }, [hydrated, goal, router]);

  if (!initialized && hydrated && goal) {
    const overdueSeed = liveTasks.filter(
      (t) => t.status === "pending" && (t.scheduled_date < today || t.deferred_at !== null)
    );
    const windowSeed = liveTasks.filter(
      (t) =>
        t.status === "pending" &&
        t.deferred_at === null &&
        t.scheduled_date >= today &&
        t.scheduled_date <= computeDisplayEndDate(goal.target_date)
    );
    setInitialOverdueById(new Map(overdueSeed.map((t) => [t.task_id, t])));
    setOverdueTasks(overdueSeed);
    setWindowTasks(windowSeed);
    setWeekdayMinutes(goal.weekday_minutes);
    setWeekendMinutes(goal.weekend_minutes);
    setInitialized(true);
  }

  const dates = useMemo(() => {
    if (!goal) return [];
    return enumerateDates(today, computeDisplayEndDate(goal.target_date));
  }, [goal, today, computeDisplayEndDate]);

  const clampedDayIndex = Math.min(activeDayIndex, Math.max(0, dates.length - 1));

  if (!hydrated || !goal || !initialized) {
    return <LoadingScreen />;
  }

  function hasUndeterminedOnDate(date: string) {
    return windowTasks.some((t) => t.scheduled_date === date && t.duration_minutes <= 0);
  }

  // "재조정 필요" 판단 기준 — 단순히 총 소요 시간과 하루 가능 시간을 비교하는 게
  // 아니라, 1) 현재 그 날짜에 소요 시간 미정(<=0)인 Task가 있는지(derived,
  // 실시간 재계산) 와 2) 명시적으로 강제된 사유(가능 시간 변경, 재조정 완료 후
  // 되돌리기)가 남아있는지를 함께 본다.
  function needsReconcileOnDate(date: string) {
    return hasUndeterminedOnDate(date) || reconcileNeededDates.has(date);
  }

  function handleSelectOverdue(taskId: string) {
    setSelectedOverdueTaskId((prev) => (prev === taskId ? null : taskId));
  }

  function handleExcludeOverdue(taskId: string) {
    setExcludedTaskIds((prev) => new Set(prev).add(taskId));
    setSelectedOverdueTaskId((prev) => (prev === taskId ? null : prev));
    setHasChanges(true);
  }

  function handleRestoreOverdue(taskId: string) {
    setExcludedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setHasChanges(true);
  }

  function handleRequestPlace(date: string) {
    if (!selectedOverdueTaskId) return;
    const task = overdueTasks.find((t) => t.task_id === selectedOverdueTaskId);
    if (!task) return;

    setWindowTasks((prev) => {
      const dayTasks = prev.filter((t) => t.scheduled_date === date);
      const maxOrder = dayTasks.reduce((max, t) => Math.max(max, t.order), 0);
      const placed: Task = {
        ...task,
        scheduled_date: date,
        duration_minutes: 0,
        order: maxOrder + 1,
      };
      return [...prev, placed];
    });
    setOverdueTasks((prev) => prev.filter((t) => t.task_id !== selectedOverdueTaskId));
    setSessionPlacedTaskIds((prev) => new Set(prev).add(selectedOverdueTaskId));
    // reconcileNeededDates에 따로 추가하지 않는다 — 방금 추가한 Task의 소요
    // 시간이 "미정"(0)이므로 hasUndeterminedOnDate가 이미 이 날짜를 "재조정
    // 필요"로 derive한다. 여기서 강제로 플래그를 세우면, 이후 같은 Task를
    // 되돌렸을 때(다른 변경 없이) "재조정 필요"가 잘못 남아있는 버그가 생긴다.
    setSelectedOverdueTaskId(null);
    setHasChanges(true);
  }

  function handleUndoTask(taskId: string) {
    const task = windowTasks.find((t) => t.task_id === taskId);
    if (!task) return;
    const donorDate = task.scheduled_date;
    const pristine = initialOverdueById.get(taskId);

    setWindowTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    setOverdueTasks((prev) => [...prev, pristine ?? task]);
    setSessionPlacedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    // 이 날짜에서 이번 세션 중 AI 재조정이 한 번이라도 성공한 적이 있다면, 남은
    // Task들의 기존 배분이 더 이상 유효하지 않을 수 있으므로 다시 "재조정
    // 필요"로 강제 표시한다(§5-2). 반대로 아직 한 번도 재조정한 적 없는
    // 날짜라면(흔한 경우 — 방금 배치했다 바로 되돌리는 경우) 강제로 표시하지
    // 않는다 — hasUndeterminedOnDate가 이미 정확한 상태를 derive하므로, 여기서
    // 또 세팅하면 "제거해도 재조정 필요가 안 사라지는" 버그가 재발한다.
    if (reconciledThisSessionDates.has(donorDate)) {
      setReconcileNeededDates((prev) => new Set(prev).add(donorDate));
    }
    setHasChanges(true);
  }

  function handleChangeDuration(taskId: string, minutes: number) {
    setWindowTasks((prev) => prev.map((t) => (t.task_id === taskId ? { ...t, duration_minutes: minutes } : t)));
    setHasChanges(true);
  }

  function handleReorder(taskId: string, newIndex: number) {
    setWindowTasks((prev) => {
      const task = prev.find((t) => t.task_id === taskId);
      if (!task) return prev;
      const sameDay = prev.filter((t) => t.scheduled_date === task.scheduled_date).sort((a, b) => a.order - b.order);
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

  function handleChangeWeekday(minutes: number) {
    setWeekdayMinutes(minutes);
    setReconcileNeededDates((prev) => {
      const next = new Set(prev);
      for (const d of dates) if (!isWeekend(d)) next.add(d);
      return next;
    });
    setHasChanges(true);
  }

  function handleChangeWeekend(minutes: number) {
    setWeekendMinutes(minutes);
    setReconcileNeededDates((prev) => {
      const next = new Set(prev);
      for (const d of dates) if (isWeekend(d)) next.add(d);
      return next;
    });
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

    const dayTasks = windowTasks.filter((t) => t.scheduled_date === date).sort((a, b) => a.order - b.order);
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
    setWindowTasks((prev) =>
      prev.map((t) => {
        const duration = byTaskId.get(t.task_id);
        return duration === undefined ? t : { ...t, duration_minutes: duration };
      })
    );
    setHasChanges(true);
    setReconcileNeededDates((prev) => {
      if (!prev.has(date)) return prev;
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
    setCompletionErrorDates((prev) => {
      if (!prev.has(date)) return prev;
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
    setReconciledThisSessionDates((prev) => (prev.has(date) ? prev : new Set(prev).add(date)));
  }

  function handleBack() {
    if (!hasChanges) {
      router.push("/dashboard");
      return;
    }
    setShowDiscardDialog(true);
  }

  function handleDiscard() {
    setShowDiscardDialog(false);
    router.push("/dashboard");
  }

  async function handleDone() {
    const hasUnprocessedOverdue = overdueTasks.some((t) => !excludedTaskIds.has(t.task_id));
    if (hasUnprocessedOverdue) {
      setOverdueNotice(OVERDUE_NOTICE_MESSAGE);
      return;
    }
    setOverdueNotice(null);

    const datesNeedingReconcile = dates.filter((d) => needsReconcileOnDate(d));
    if (datesNeedingReconcile.length > 0) {
      setCompletionErrorDates(new Set(datesNeedingReconcile));
      const firstDate = datesNeedingReconcile[0];
      setActiveDayIndex(dates.indexOf(firstDate));
      await nextAnimationFrame();
      const candidates = dayGroupRefs.current.get(firstDate) ?? [];
      const target = candidates.find((el) => el.getClientRects().length > 0) ?? candidates[0];
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
      return;
    }

    commitReplan({
      tasks: windowTasks.map((t) => ({
        task_id: t.task_id,
        scheduled_date: t.scheduled_date,
        duration_minutes: t.duration_minutes,
        order: t.order,
      })),
      excludedTaskIds: [...excludedTaskIds],
      weekdayMinutes,
      weekendMinutes,
    });
    router.push("/dashboard");
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

  const overdueItems: OverdueItem[] = overdueTasks.map((t) => ({
    task_id: t.task_id,
    title: t.title,
    duration_minutes: t.duration_minutes,
    state: excludedTaskIds.has(t.task_id) ? "excluded" : selectedOverdueTaskId === t.task_id ? "selected" : "available",
  }));
  const selectedOverdueTitle = overdueTasks.find((t) => t.task_id === selectedOverdueTaskId)?.title ?? "";
  const activeDate = dates[clampedDayIndex];

  return (
    <div className="relative mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
      <AppHeader
        breadcrumb={[{ label: "대시보드" }, { label: "계획 재조정" }]}
        action={
          <>
            <Button variant="header" size="sm" onClick={handleBack}>
              취소
            </Button>
            <Button size="sm" onClick={() => requireLogin(handleDone)()}>
              완료
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-heading-sm font-medium text-foreground">계획 재조정</h1>
          <p className="text-sm text-muted">밀린 할 일을 날짜에 배치하고 시간을 다시 조정해보세요.</p>
        </div>

        {/* Mobile/Tablet: 밀린 할 일 카드 + 날짜 Navigation + Swipe */}
        <div className="space-y-4 lg:hidden">
          <OverdueTaskCard
            items={overdueItems}
            weekdayMinutes={weekdayMinutes}
            weekendMinutes={weekendMinutes}
            onSelect={handleSelectOverdue}
            onExclude={handleExcludeOverdue}
            onRestore={handleRestoreOverdue}
            onChangeWeekday={handleChangeWeekday}
            onChangeWeekend={handleChangeWeekend}
            notice={overdueNotice}
          />

          {selectedOverdueTaskId && (
            <div className="flex items-center justify-between gap-2 rounded-btn bg-accent/10 px-3 py-2 text-sm text-accent">
              <span className="truncate">{selectedOverdueTitle} 배치 대기 중</span>
              <button
                type="button"
                onClick={() => setSelectedOverdueTaskId(null)}
                className="shrink-0 whitespace-nowrap text-xs underline"
              >
                선택 해제
              </button>
            </div>
          )}

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
                tasks={windowTasks.filter((t) => t.scheduled_date === activeDate)}
                budgetMinutes={dayBudgetFor(activeDate, weekdayMinutes, weekendMinutes)}
                isReconciling={reconcilingDates.has(activeDate)}
                reconcileError={dayReconcileErrors[activeDate]}
                onReorder={handleReorder}
                onRequestAdd={() => {}}
                onChangeDuration={handleChangeDuration}
                onRequestReconcile={handleReconcileDay}
                registerRef={registerDayGroupRef}
                variant="replan"
                needsReconcile={needsReconcileOnDate(activeDate)}
                showErrorBorder={completionErrorDates.has(activeDate)}
                canPlaceOverdue={selectedOverdueTaskId !== null}
                onRequestPlace={handleRequestPlace}
                sessionPlacedTaskIds={sessionPlacedTaskIds}
                onUndoTask={handleUndoTask}
              />
            </div>
          )}
        </div>

        {/* Desktop: 밀린 할 일 Card + 날짜별 Card Grid (최대 4열) */}
        <div
          className="hidden items-start gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          style={cardHeightPx ? ({ "--calendar-height-px": `${cardHeightPx}px` } as React.CSSProperties) : undefined}
        >
          <div ref={cardRef}>
            <OverdueTaskCard
              items={overdueItems}
              weekdayMinutes={weekdayMinutes}
              weekendMinutes={weekendMinutes}
              onSelect={handleSelectOverdue}
              onExclude={handleExcludeOverdue}
              onRestore={handleRestoreOverdue}
              onChangeWeekday={handleChangeWeekday}
              onChangeWeekend={handleChangeWeekend}
              notice={overdueNotice}
            />
          </div>
          {dates.map((date) => (
            <DayGroup
              key={date}
              date={date}
              tasks={windowTasks.filter((t) => t.scheduled_date === date)}
              budgetMinutes={dayBudgetFor(date, weekdayMinutes, weekendMinutes)}
              isReconciling={reconcilingDates.has(date)}
              reconcileError={dayReconcileErrors[date]}
              onReorder={handleReorder}
              onRequestAdd={() => {}}
              onChangeDuration={handleChangeDuration}
              onRequestReconcile={handleReconcileDay}
              registerRef={registerDayGroupRef}
              variant="replan"
              needsReconcile={needsReconcileOnDate(date)}
              showErrorBorder={completionErrorDates.has(date)}
              canPlaceOverdue={selectedOverdueTaskId !== null}
              onRequestPlace={handleRequestPlace}
              sessionPlacedTaskIds={sessionPlacedTaskIds}
              onUndoTask={handleUndoTask}
            />
          ))}
        </div>
      </div>

      {showDiscardDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
            <div className="space-y-1">
              <h2 className="text-base font-medium">수정한 내용이 있어요</h2>
              <p className="text-sm text-muted">저장하지 않고 나가면 수정한 내용이 사라져요.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="header" onClick={() => setShowDiscardDialog(false)} className="flex-1">
                계속 수정하기
              </Button>
              <Button variant="primary" onClick={handleDiscard} className="flex-1">
                나가기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
