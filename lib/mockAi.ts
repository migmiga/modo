// M1 더미 AI 모듈.
//
// generatePlan()의 시그니처와 입출력 스키마는 PRD 6장(AI 01)을 그대로 따른다.
// M2에서는 이 함수의 내부만 실제 OpenAI 호출로 교체하면 되고, 화면/상태(store)
// 로직은 변경할 필요가 없도록 설계했다.
//
// AI 02(replanTasks, 계획 재조정 일괄 배치)는 /replan 화면이 카드형 수동 배치 +
// 날짜별 AI 04 재조정 흐름으로 개편되면서 더 이상 쓰이지 않아 제거됐다.

import { dayBudgetFor, enumerateDates } from "./dateUtils";
import type {
  AiDayReconcileInput,
  AiDayReconcileResult,
  AiPlanInput,
  AiPlanResult,
  AiPlanTask,
  AiReconcileInput,
  AiReconcileResult,
  AiReconciledTask,
  AvailableTime,
} from "./types";

const DEFAULT_NEW_TASK_MINUTES = 30;

const MIN_TOTAL_MINUTES = 30;
const MAX_GENERATED_TASKS = 200;
// MVP 제약: 하루에 배치되는 Task는 최대 8개(완료 포함, 제외 제외) — 생성/수정/재조정 전부 동일 기준.
const MAX_TASKS_PER_DAY = 8;

function dayBudget(date: string, availableTime: AvailableTime): number {
  return dayBudgetFor(date, availableTime.weekday_minutes, availableTime.weekend_minutes);
}

function taskUnitMinutes(availableTime: AvailableTime): number {
  const base = Math.max(availableTime.weekday_minutes, availableTime.weekend_minutes, 15);
  return Math.min(45, Math.max(15, Math.round(base / 2)));
}

// 실제 구체적 Task 생성(목표 내용 해석, Goal Context 반영, 완료 항목 제외,
// 15자 내외의 간결하고 구체적인 제목)은 M2에서 실제 AI 호출로 구현한다.
// PRD.md 6장의 Task 제목 생성 원칙 참고. 더미 단계는 Goal 내용을 전혀 모르므로
// "무엇에 대한 조사/정리인지"가 드러나는 진짜 구체성은 낼 수 없다 — "실행 N단계"식
// 추상적 반복 대신 범용 행동형 문구를 순환시켜 최소한의 가독성(짧은 행동형 문장,
// Goal title 비반복)만 보장하며, 이 한계는 M2에서 실제 AI로 교체될 때 해소된다.
const ACTION_TEMPLATES = [
  "현황 파악하기",
  "자료 조사하기",
  "세부 내용 정리하기",
  "초안 작성하기",
  "구성 설계하기",
  "핵심 내용 작성하기",
  "검토 및 수정하기",
  "디테일 보완하기",
  "최종본 다듬기",
  "마무리 점검하기",
];

function placeholderTitle(taskIndex: number): string {
  return ACTION_TEMPLATES[taskIndex % ACTION_TEMPLATES.length];
}

export function generatePlan(input: AiPlanInput): AiPlanResult {
  const { goal, available_time } = input;
  const days = enumerateDates(goal.start_date, goal.target_date);
  if (days.length === 0) {
    return { status: "insufficient_time", tasks: [] };
  }

  const totalBudget = days.reduce((sum, d) => sum + dayBudget(d, available_time), 0);
  if (totalBudget < MIN_TOTAL_MINUTES) {
    return { status: "insufficient_time", tasks: [] };
  }

  const unit = taskUnitMinutes(available_time);
  const tasks: AiPlanTask[] = [];

  for (const date of days) {
    const budget = dayBudget(date, available_time);
    const countForDay = Math.min(Math.floor(budget / unit), MAX_TASKS_PER_DAY);
    for (let i = 0; i < countForDay; i += 1) {
      if (tasks.length >= MAX_GENERATED_TASKS) break;
      tasks.push({
        title: placeholderTitle(tasks.length),
        date,
        duration_minutes: unit,
        order: i + 1,
      });
    }
    if (tasks.length >= MAX_GENERATED_TASKS) break;
  }

  if (tasks.length === 0) {
    return { status: "insufficient_time", tasks: [] };
  }

  return { status: "success", tasks };
}

export function reconcilePlan(input: AiReconcileInput): AiReconcileResult {
  const { tasks, start_date, target_date, available_time } = input;
  const days = enumerateDates(start_date, target_date);
  if (days.length === 0) {
    return { status: "insufficient_time", tasks: [] };
  }

  const normalized = tasks.map((t) => ({
    ...t,
    duration_minutes: t.duration_minutes > 0 ? t.duration_minutes : DEFAULT_NEW_TASK_MINUTES,
  }));

  const byDate = new Map<string, typeof normalized>();
  for (const day of days) byDate.set(day, []);
  const overflow: typeof normalized = [];

  for (const t of normalized) {
    const list = byDate.get(t.scheduled_date);
    if (list) list.push(t);
    else overflow.push(t);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.order - b.order);

  const remainingBudget = new Map<string, number>(days.map((d) => [d, dayBudget(d, available_time)]));
  const orderCounter = new Map<string, number>(days.map((d) => [d, 0]));
  const taskCounter = new Map<string, number>(days.map((d) => [d, 0]));
  const placed: AiReconciledTask[] = [];

  function place(day: string, task: (typeof normalized)[number]) {
    remainingBudget.set(day, (remainingBudget.get(day) ?? 0) - task.duration_minutes);
    taskCounter.set(day, (taskCounter.get(day) ?? 0) + 1);
    const order = (orderCounter.get(day) ?? 0) + 1;
    orderCounter.set(day, order);
    placed.push({
      task_id: task.task_id,
      scheduled_date: day,
      duration_minutes: task.duration_minutes,
      order,
    });
  }

  for (const day of days) {
    for (const t of byDate.get(day) ?? []) {
      const budget = remainingBudget.get(day) ?? 0;
      const count = taskCounter.get(day) ?? 0;
      if (t.duration_minutes <= budget && count < MAX_TASKS_PER_DAY) {
        place(day, t);
      } else {
        overflow.push(t);
      }
    }
  }

  for (const t of overflow) {
    const targetDay = days.find(
      (d) => (remainingBudget.get(d) ?? 0) >= t.duration_minutes && (taskCounter.get(d) ?? 0) < MAX_TASKS_PER_DAY
    );
    if (!targetDay) {
      return { status: "insufficient_time", tasks: [] };
    }
    place(targetDay, t);
  }

  return { status: "success", tasks: placed };
}

// 10분 단위 — TaskRow의 수동 시간 조절 단위(DURATION_STEP_MIN)와 동일하게 맞춰,
// 재조정 후에도 +/- 조절이 어색하지 않게 한다.
const DAY_RECONCILE_STEP_MIN = 10;
const DAY_RECONCILE_MIN_PER_TASK = 10;

export function reconcileDayTasks(input: AiDayReconcileInput): AiDayReconcileResult {
  const { tasks, budget_minutes } = input;
  if (tasks.length === 0) {
    return { status: "success", tasks: [] };
  }

  const perTaskFloor =
    Math.floor(budget_minutes / tasks.length / DAY_RECONCILE_STEP_MIN) * DAY_RECONCILE_STEP_MIN;
  if (perTaskFloor < DAY_RECONCILE_MIN_PER_TASK) {
    return { status: "insufficient_time", tasks: [] };
  }

  // 균등 배분 후 남는 10분 단위 조각은 순서가 앞선 Task부터 하나씩 더 준다 —
  // 그래야 가용 시간을 최대한 활용하면서도 각 Task는 여전히 10분 단위를 유지한다.
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const remainder = budget_minutes - perTaskFloor * sorted.length;
  const extraSlots = Math.floor(remainder / DAY_RECONCILE_STEP_MIN);

  return {
    status: "success",
    tasks: sorted.map((t, i) => ({
      task_id: t.task_id,
      duration_minutes: perTaskFloor + (i < extraSlots ? DAY_RECONCILE_STEP_MIN : 0),
    })),
  };
}
