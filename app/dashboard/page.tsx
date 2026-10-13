"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useLoginGate, useRequireLogin } from "@/components/auth/LoginGateProvider";
import { DateTaskPanel } from "@/components/home/DateTaskPanel";
import { ExecutionTimeline } from "@/components/home/ExecutionTimeline";
import { MemoCard } from "@/components/home/MemoCard";
import type { NoteModalValues } from "@/components/home/NoteModal";
import { AppHeader } from "@/components/layout/AppHeader";
import { MiniCalendar } from "@/components/plan/MiniCalendar";
import { ContinuePlanDialog } from "@/components/retro/ContinuePlanDialog";
import { DeletePlanConfirmDialog } from "@/components/retro/DeletePlanConfirmDialog";
import { IncompleteCheckDialog } from "@/components/retro/IncompleteCheckDialog";
import { IncompleteConfirmStep } from "@/components/retro/IncompleteConfirmStep";
import { ReplanNoticeDialog } from "@/components/retro/ReplanNoticeDialog";
import { RetroModal } from "@/components/retro/RetroModal";
import { Button } from "@/components/ui/Button";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { addDays, localDateStrFromIso, todayStr } from "@/lib/dateUtils";
import { afterLayoutSettles, logPageAudit } from "@/lib/debugLayout";
import { useAppStore } from "@/lib/store";
import type { Note } from "@/lib/types";

type RetroFlowState =
  | { kind: "none" }
  // "나중에 하기"를 선택했지만 재조정을 안 끝낸 작업이 있다는 안내 — 날짜
  // 무관, 일반 미완료와 분리된 별도 풀(deferredAwaitingReplan).
  | { kind: "replanNotice" }
  // 2일 이상 지난 "일반"(나중에 하기 아닌) 미완료 작업이 있을 때의 강제 선택.
  | { kind: "continuePlan" }
  | { kind: "continuePlanDeleteConfirm" }
  // 아래 네 가지는 모두 "어제(today - 1일)"의 일반 미완료 작업 전용 — 오늘
  // 자신의 회고와는 완전히 분리되어 date: yesterday로 제출된다.
  | { kind: "incompleteCheck" }
  | { kind: "incompleteConfirmChecklist" }
  | { kind: "fullRetroYesterday"; extraCompletedTaskIds: string[] }
  | { kind: "partialRetroYesterday"; extraCompletedTaskIds: string[] }
  // 오늘 자신의 작업이 전부 완료됐을 때의 자동 전체 회고 — date: today.
  | { kind: "fullRetroToday" };

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const requireLogin = useRequireLogin();
  const { isOnboarded } = useLoginGate();
  const hydrated = useAppStore((s) => s.hydrated);
  const profile = useAppStore((s) => s.profile);
  const goal = useAppStore((s) => s.goal);
  const tasks = useAppStore((s) => s.tasks);
  const toggleTaskComplete = useAppStore((s) => s.toggleTaskComplete);
  const excludeTask = useAppStore((s) => s.excludeTask);
  const deferTask = useAppStore((s) => s.deferTask);
  const retrospectives = useAppStore((s) => s.retrospectives);
  const lastIncompleteCheckShownKey = useAppStore((s) => s.lastIncompleteCheckShownKey);
  const submitRetrospective = useAppStore((s) => s.submitRetrospective);
  const markIncompleteCheckShown = useAppStore((s) => s.markIncompleteCheckShown);
  const deleteActiveGoal = useAppStore((s) => s.deleteActiveGoal);

  // Local-calendar-day state, not a plain `todayStr()` call — a render
  // triggered by something else (a click, a store update) would already
  // pick up a fresh value either way, but if the tab sits idle straight
  // through local midnight with no interaction at all, nothing would ever
  // re-render HomePage to recompute it. The effect below (placed after
  // `retroFlow` exists, see "Local midnight rollover" further down) is what
  // actually keeps this current.
  const [today, setToday] = useState(() => todayStr());
  const yesterday = addDays(today, -1);
  const [selectedDate, setSelectedDate] = useState(today);
  const [notes, setNotes] = useState<Note[]>([]);

  // TEMPORARY layout-debug instrumentation — see lib/debugLayout.ts.
  useEffect(() => {
    if (!hydrated || !profile) return;
    afterLayoutSettles(() => logPageAudit(pathname));
  }, [hydrated, profile, pathname]);

  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.scheduled_date === today && t.status !== "cancelled" && t.deferred_at === null
      ),
    [tasks, today]
  );

  const selectedDateTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            t.scheduled_date === selectedDate && t.status !== "cancelled" && t.deferred_at === null
        )
        .sort((a, b) => a.order - b.order),
    [tasks, selectedDate]
  );

  const replanTargetCount = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "pending" && (t.scheduled_date < today || t.deferred_at !== null)
      ).length,
    [tasks, today]
  );

  const nextUpcomingDate = useMemo(() => {
    const dates = tasks
      .filter((t) => t.status === "pending" && t.scheduled_date > today)
      .map((t) => t.scheduled_date)
      .sort();
    return dates[0] ?? null;
  }, [tasks, today]);

  const hasGoal = goal !== null;

  // Scoped by (goal_id, date), not date alone — creating a new goal the same
  // day replaces `goal`/`tasks` wholesale (see confirmPlan in lib/store.ts),
  // so a retrospective already submitted for a *previous* goal on this same
  // date must not suppress the offer for the current goal's own completion.
  const todaysRetrospective = useMemo(
    () => retrospectives.find((r) => r.date === today && r.goal_id === goal?.goal_id) ?? null,
    [retrospectives, today, goal]
  );

  const completedToday = useMemo(
    () => todayTasks.filter((t) => t.status === "completed"),
    [todayTasks]
  );

  const allTodayDone =
    todayTasks.length > 0 && completedToday.length > 0 && todayTasks.every((t) => t.status === "completed");

  // "나중에 하기"를 선택했지만 아직 새 날짜로 재조정되지 않은 작업 중,
  // 그 선택을 "오늘보다 이전"에 한 것만 재조정 안내 팝업 대상으로 모은다.
  // deferred_at(나중에 하기를 누른 시각)의 로컬 날짜를 today와 비교 —
  // 오늘 막 나중에 하기를 누른 작업은 아직 "당일 재조정 흐름"(대시보드
  // 카드/재조정 화면 — 둘 다 날짜 무관하게 그대로 보여줌, 변경 없음) 안에
  // 있는 것으로 보고 이 팝업에는 하루의 유예를 둔다. 일반 미완료 집계
  // (pastPlainIncomplete, 아래)에서는 날짜와 무관하게 항상 전부 제외된다.
  const deferredAwaitingReplan = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "pending" && t.deferred_at !== null && localDateStrFromIso(t.deferred_at) < today
      ),
    [tasks, today]
  );

  // "일반" 미완료 — 나중에 하기를 선택하지 않은, 그냥 수행되지 않은 지난
  // 날짜 작업만. deferred_at !== null인 것은 위 deferredAwaitingReplan 쪽
  // 책임이라 여기서 명시적으로 제외한다.
  const pastPlainIncomplete = useMemo(
    () => tasks.filter((t) => t.status === "pending" && t.deferred_at === null && t.scheduled_date < today),
    [tasks, today]
  );
  // 정확히 "어제" — 다음 방문 시의 전날 회고 대상.
  const yesterdayPlainIncomplete = useMemo(
    () => pastPlainIncomplete.filter((t) => t.scheduled_date === yesterday),
    [pastPlainIncomplete, yesterday]
  );
  // 어제보다 더 과거(2일 이상 지남) — 전날 회고로 누적하지 않고, 계획
  // 지속 여부 팝업 하나로 묶어서 처리한다.
  const staleIncomplete = useMemo(
    () => pastPlainIncomplete.filter((t) => t.scheduled_date < yesterday),
    [pastPlainIncomplete, yesterday]
  );
  const yesterdayCompletedTasks = useMemo(
    () => tasks.filter((t) => t.scheduled_date === yesterday && t.status === "completed"),
    [tasks, yesterday]
  );

  const [retroFlow, setRetroFlow] = useState<RetroFlowState>({ kind: "none" });
  // Which goal's full-retro offer was dismissed-without-submitting this
  // session — scoped by goal_id (not a plain boolean) for the same reason
  // todaysRetrospective is: dismissing goal A's offer must not also suppress
  // goal B's offer if a new goal gets created/completed the same day.
  const [dismissedFullOfferGoalId, setDismissedFullOfferGoalId] = useState<string | null>(null);
  // Same idea as dismissedFullOfferGoalId, for the dismissible replanNotice
  // popup — without this, closing it (X) would reopen it on the very next
  // effect re-run within the same visit, since nothing else about
  // deferredAwaitingReplan changed. Resets on remount (e.g. leaving for
  // /replan and coming back), so it reappears on the next visit as required.
  const [dismissedReplanNoticeGoalId, setDismissedReplanNoticeGoalId] = useState<string | null>(null);

  // Mirrors retroFlow.kind into a ref purely so the midnight/wake timer
  // below (mount-once effect, stable callback) can read the *current* kind
  // without needing retroFlow itself in its dependency array — that would
  // tear down and reschedule the midnight setTimeout on every single retro
  // step change, which is exactly the drift this is trying to avoid.
  const retroFlowKindRef = useRef(retroFlow.kind);
  useEffect(() => {
    retroFlowKindRef.current = retroFlow.kind;
  }, [retroFlow.kind]);

  const syncToday = useCallback(() => {
    setToday((prev) => {
      const next = todayStr();
      return prev === next ? prev : next;
    });
  }, []);

  // Local midnight rollover — keeps `today` current even if the tab sits
  // idle with no other interaction. Re-derives "how long until the next
  // local midnight" from the actual clock every time (rather than a fixed
  // 24h repeat), so it self-corrects after sleep/background throttling
  // instead of drifting. visibilitychange/focus cover the case where the
  // computer slept or the tab was backgrounded straight through midnight —
  // a suspended setTimeout can fire late (or, per spec, not at all until
  // resumed), so waking/refocusing always re-checks regardless of the timer.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function maybeSyncToday() {
      // Defer while a retro/replan/continue-plan dialog is on screen, so its
      // already-rendered task lists and the user's in-progress answers
      // don't shift to a different day out from under them mid-interaction.
      // The effect below catches this up the moment the dialog closes.
      if (retroFlowKindRef.current !== "none") return;
      syncToday();
    }

    function scheduleMidnightRefresh() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
      const delay = Math.max(nextMidnight.getTime() - now.getTime(), 1000);
      timeoutId = setTimeout(() => {
        maybeSyncToday();
        scheduleMidnightRefresh();
      }, delay);
    }
    scheduleMidnightRefresh();

    document.addEventListener("visibilitychange", maybeSyncToday);
    window.addEventListener("focus", maybeSyncToday);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", maybeSyncToday);
      window.removeEventListener("focus", maybeSyncToday);
    };
  }, [syncToday]);

  // Catches up whatever the check above deferred while a dialog was open —
  // runs right as retroFlow returns to "none" (dialog closed/submitted).
  // Deferred via setTimeout(0), same pattern as the priority effect below.
  useEffect(() => {
    if (retroFlow.kind !== "none") return;
    const timeoutId = setTimeout(syncToday, 0);
    return () => clearTimeout(timeoutId);
  }, [retroFlow.kind, syncToday]);

  useEffect(() => {
    // profile 대신 isOnboarded(로그인+프로필 완료 또는 guestMode)로 판단한다
    // — 그래야 프로필이 없는 게스트도 날짜/완료 조건을 충족하면 회고
    // 다이얼로그가 열린다. 로그인 사용자 쪽은 isOnboarded가 기존 profile
    // truthy 조건과 완전히 동일해 동작이 바뀌지 않는다.
    if (!hydrated || !isOnboarded || !hasGoal || !goal) return;
    if (retroFlow.kind !== "none") return;

    // Deferred via setTimeout(0) — same pattern as ExecutionTimeline.tsx's
    // auto-complete effect — so the setState calls below aren't synchronous
    // within the effect body (react-hooks/set-state-in-effect).
    //
    // Priority order (highest first) — each pool is disjoint from the
    // others, so resolving one and looping back through "none" always falls
    // through to the next without skipping anything:
    //   1) deferred-but-not-rescheduled tasks (any date)
    //   2) plain incomplete tasks 2+ days old (forced continue/delete choice)
    //   3) yesterday's own plain incomplete tasks (existing check→retro flow)
    //   4) today's own tasks, all done → automatic full retro
    const timeoutId = setTimeout(() => {
      if (deferredAwaitingReplan.length > 0 && dismissedReplanNoticeGoalId !== goal.goal_id) {
        setRetroFlow({ kind: "replanNotice" });
        return;
      }
      if (staleIncomplete.length > 0) {
        setRetroFlow({ kind: "continuePlan" });
        return;
      }
      if (yesterdayPlainIncomplete.length > 0 && lastIncompleteCheckShownKey !== `${goal.goal_id}:${yesterday}`) {
        markIncompleteCheckShown(goal.goal_id, yesterday);
        setRetroFlow({ kind: "incompleteCheck" });
        return;
      }
      if (allTodayDone && !todaysRetrospective && dismissedFullOfferGoalId !== goal.goal_id) {
        setRetroFlow({ kind: "fullRetroToday" });
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [
    hydrated,
    isOnboarded,
    hasGoal,
    goal,
    retroFlow.kind,
    deferredAwaitingReplan.length,
    dismissedReplanNoticeGoalId,
    staleIncomplete.length,
    yesterdayPlainIncomplete.length,
    lastIncompleteCheckShownKey,
    yesterday,
    today,
    allTodayDone,
    todaysRetrospective,
    dismissedFullOfferGoalId,
    markIncompleteCheckShown,
  ]);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  function handleAddNote(values: NoteModalValues) {
    setNotes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: values.title,
        url: values.url || undefined,
        content: values.content || undefined,
        tags: values.tags,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function handleUpdateNote(id: string, values: NoteModalValues) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              title: values.title,
              url: values.url || undefined,
              content: values.content || undefined,
              tags: values.tags,
            }
          : n
      )
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
      <div className="space-y-8">
        <AppHeader
          breadcrumb={[{ label: "대시보드" }]}
          action={
            <Button variant="header" size="sm">
              도움말
            </Button>
          }
        />

        <div className="space-y-2">
          <h1 data-ld="page-title" className="font-heading text-heading-sm font-medium text-foreground">대시보드</h1>
          <p className="text-sm text-muted">오늘 해야 할 일을 확인하고 계획을 이어가세요.</p>
        </div>

        <div
          data-ld="page-body"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[320px_400px_1fr] lg:items-stretch"
        >
        <div
          data-ld="card-dashboard"
          className="mx-auto flex h-[392px] w-full max-w-[320px] flex-col justify-start rounded-card border border-border bg-surface p-5 shadow-card"
        >
          {/* No flex-1/justify-center here — the calendar and (optional) footer
              below it keep their natural sizes and pack at the top; any leftover
              slack from the fixed card height collects below them, not between
              the calendar grid and the footer. */}
          <MiniCalendar
            mode="single"
            today={today}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            planStartDate={goal?.start_date}
            planEndDate={goal?.target_date}
          />
          {/* Footer, not a nested card: no background/border/radius of its own —
              just a divider off the card's own border-color token, so the card's
              white surface reads as one continuous container. Always rendered
              (not conditional on replanTargetCount) so the calendar card's
              internal layout never shifts depending on whether there's anything
              to reconcile. */}
          <div className="mt-4 flex shrink-0 items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">
              {replanTargetCount > 0 ? (
                <>
                  재조정할 일정이 <span className="font-semibold text-tangerine">{replanTargetCount}개</span> 있어요.
                </>
              ) : (
                "재조정할 일정이 없어요."
              )}
            </p>
            {replanTargetCount > 0 ? (
              // Light tangerine tint (same bg-tangerine/10 + text-tangerine pattern
              // already used for accent badges elsewhere, e.g. ArchiveCard's "완료"
              // chip) instead of a solid fill — keeps the CTA legible without
              // out-competing the dashboard's primary (dark) actions.
              <Link
                href="/replan"
                className="inline-flex shrink-0 items-center justify-center rounded-btn border border-tangerine/30 bg-tangerine/10 px-3 py-1.5 text-xs font-medium text-tangerine transition hover:bg-tangerine/15"
              >
                재조정하기
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex shrink-0 cursor-not-allowed items-center justify-center rounded-btn border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted opacity-60"
              >
                재조정하기
              </span>
            )}
          </div>
        </div>

        <DateTaskPanel
          hasGoal={hasGoal}
          selectedDate={selectedDate}
          today={today}
          tasks={selectedDateTasks}
          nextUpcomingDate={nextUpcomingDate}
          onToggleComplete={requireLogin(toggleTaskComplete)}
          onExclude={requireLogin(excludeTask)}
          onDefer={requireLogin(deferTask)}
        />

        <MemoCard
          notes={notes}
          onAddNote={requireLogin(handleAddNote)}
          onUpdateNote={requireLogin(handleUpdateNote)}
        />
        </div>
      </div>

      <div className="mt-4">
        <ExecutionTimeline
          hasGoal={hasGoal}
          todayTasks={todayTasks}
          onCompleteTask={requireLogin(toggleTaskComplete)}
        />
      </div>

      {retroFlow.kind === "replanNotice" && (
        <ReplanNoticeDialog
          count={deferredAwaitingReplan.length}
          onClose={() => {
            setDismissedReplanNoticeGoalId(goal!.goal_id);
            setRetroFlow({ kind: "none" });
          }}
          onGoToReplan={() => {
            setRetroFlow({ kind: "none" });
            router.push("/replan");
          }}
        />
      )}

      {retroFlow.kind === "continuePlan" && (
        <ContinuePlanDialog
          incompleteCount={staleIncomplete.length}
          onDelete={() => setRetroFlow({ kind: "continuePlanDeleteConfirm" })}
          onContinue={() => {
            setRetroFlow({ kind: "none" });
            router.push("/replan");
          }}
        />
      )}

      {retroFlow.kind === "continuePlanDeleteConfirm" && (
        <DeletePlanConfirmDialog
          onCancel={() => setRetroFlow({ kind: "continuePlan" })}
          onConfirmDelete={() => {
            deleteActiveGoal();
            setNotes([]);
            setRetroFlow({ kind: "none" });
          }}
        />
      )}

      {retroFlow.kind === "incompleteCheck" && (
        <IncompleteCheckDialog
          overdueTasks={yesterdayPlainIncomplete}
          onConfirmCompleted={() => setRetroFlow({ kind: "incompleteConfirmChecklist" })}
          onStillRemaining={() => setRetroFlow({ kind: "partialRetroYesterday", extraCompletedTaskIds: [] })}
        />
      )}

      {retroFlow.kind === "incompleteConfirmChecklist" && (
        <IncompleteConfirmStep
          overdueTasks={yesterdayPlainIncomplete}
          onBack={() => setRetroFlow({ kind: "incompleteCheck" })}
          onClose={() => setRetroFlow({ kind: "none" })}
          onConfirm={(checkedTaskIds) => {
            checkedTaskIds.forEach((id) => toggleTaskComplete(id));
            // Full (vs partial) only when every one of yesterday's own plain
            // incomplete tasks shown here ends up checked — scoped strictly
            // to yesterday, never mixed with today's or older tasks.
            const allResolved = checkedTaskIds.length === yesterdayPlainIncomplete.length;
            if (allResolved) {
              setRetroFlow({ kind: "fullRetroYesterday", extraCompletedTaskIds: checkedTaskIds });
            } else {
              setRetroFlow({ kind: "partialRetroYesterday", extraCompletedTaskIds: checkedTaskIds });
            }
          }}
        />
      )}

      {retroFlow.kind === "fullRetroToday" && (
        <RetroModal
          mode="full"
          isToday
          completedTasks={completedToday}
          onClose={() => {
            setRetroFlow({ kind: "none" });
            setDismissedFullOfferGoalId(goal!.goal_id);
          }}
          onSubmitFull={(answers) =>
            requireLogin(() =>
              submitRetrospective({
                goal_id: goal!.goal_id,
                date: today,
                type: "full",
                condition: answers.condition,
                workload_chip: answers.workloadChip,
                satisfaction_rating: answers.satisfactionRating,
                free_text: answers.freeText,
                completed_task_ids: completedToday.map((t) => t.task_id),
                incomplete_task_ids: [],
              })
            )() ?? null
          }
        />
      )}

      {retroFlow.kind === "fullRetroYesterday" && (
        <RetroModal
          mode="full"
          isToday={false}
          // yesterdayCompletedTasks is recomputed from the latest `tasks` on
          // every render, so by the time this renders it already includes
          // whatever onConfirm just toggled to "completed" above — spreading
          // `tasks.filter(extraCompletedTaskIds...)` on top of it re-added
          // those same tasks a second time (duplicate task_id → React key
          // collision in TaskCard). No other data is needed here.
          completedTasks={yesterdayCompletedTasks}
          onClose={() => setRetroFlow({ kind: "none" })}
          onSubmitFull={(answers) =>
            requireLogin(() =>
              submitRetrospective({
                goal_id: goal!.goal_id,
                date: yesterday,
                type: "full",
                condition: answers.condition,
                workload_chip: answers.workloadChip,
                satisfaction_rating: answers.satisfactionRating,
                free_text: answers.freeText,
                completed_task_ids: yesterdayCompletedTasks.map((t) => t.task_id),
                incomplete_task_ids: [],
              })
            )() ?? null
          }
        />
      )}

      {retroFlow.kind === "partialRetroYesterday" && (
        <RetroModal
          mode="partial"
          isToday={false}
          // Same reasoning as fullRetroYesterday above — yesterdayCompletedTasks
          // alone already reflects every just-checked task.
          completedTasks={yesterdayCompletedTasks}
          incompleteTasks={yesterdayPlainIncomplete}
          onClose={() => setRetroFlow({ kind: "none" })}
          onSubmitPartial={requireLogin((answers) => {
            submitRetrospective({
              goal_id: goal!.goal_id,
              date: yesterday,
              type: "partial",
              condition: null,
              workload_chip: answers.workloadChip,
              satisfaction_rating: answers.satisfactionRating,
              free_text: answers.freeText,
              completed_task_ids: yesterdayCompletedTasks.map((t) => t.task_id),
              incomplete_task_ids: yesterdayPlainIncomplete.map((t) => t.task_id),
            });
            setRetroFlow({ kind: "none" });
            router.push("/replan");
          })}
        />
      )}
    </div>
  );
}
