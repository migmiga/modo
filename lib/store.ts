"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { buildArchiveSeed, FAVORITED_ARCHIVE_IDS } from "./archiveSeed";
import { generatePlan, reconcilePlan } from "./mockAi";
import { MOMO_SETS } from "./momoSets";
import type {
  ArchivedPlan,
  Goal,
  Occupation,
  Profile,
  ProfileField,
  Retrospective,
  Task,
} from "./types";

interface NewGoalInput {
  title: string;
  startDate: string;
  targetDate: string;
  weekdayMinutes: number;
  weekendMinutes: number;
  contextText: string | null;
}

export interface DraftPlan {
  goal: Goal;
  tasks: Task[];
}

interface ReplanCommitTaskEdit {
  task_id: string;
  scheduled_date: string;
  duration_minutes: number;
  order: number;
}

export interface ReplanCommitInput {
  tasks: ReplanCommitTaskEdit[];
  excludedTaskIds: string[];
  weekdayMinutes: number;
  weekendMinutes: number;
}

export interface ReferenceGoalDraft {
  title: string;
  contextText: string | null;
}

const MAX_FAVORITE_ARCHIVES = 5;

// --- 계정별 저장 데이터 (merge/partialize가 다루는 대상) ---
interface AppData {
  hydrated: boolean;
  profile: Profile | null;
  goal: Goal | null;
  tasks: Task[];
  draftPlan: DraftPlan | null;
  draftError: string | null;
  archivedPlans: ArchivedPlan[];
  favoriteArchiveIds: string[];
  archiveSeeded: boolean;
  referenceGoalDraft: ReferenceGoalDraft | null;
  retrospectives: Retrospective[];
  // `${goal_id}:${date}` of the last incomplete-task check dialog shown —
  // goal-scoped (not date-only) so a new goal's own never-reviewed overdue
  // tasks aren't suppressed just because some *other*, since-replaced goal's
  // dialog was already shown earlier the same day. See markIncompleteCheckShown.
  lastIncompleteCheckShownKey: string | null;
  // Count of *new* full-type retrospective submissions ever recorded — the
  // single source of truth the celebration screen's "모모의 7가지 변신" cycles
  // on. Deliberately a success counter, not a date/weekday: it only moves
  // forward from submitRetrospective itself (see there), so a failed or
  // duplicate submission can never advance it, and it survives refresh via
  // the same persisted storage as everything else in this store.
  fullRetroSubmitCount: number;
}

// Named apart from the creator's own object literal so `merge` (below) can
// fall back to it directly — every account switch resolves to either real
// stored data for that exact key, or this exact constant, never to whatever
// happened to still be in memory from the previous account.
const INITIAL_STATE: AppData = {
  hydrated: false,
  profile: null,
  goal: null,
  tasks: [],
  draftPlan: null,
  draftError: null,
  archivedPlans: [],
  favoriteArchiveIds: [],
  archiveSeeded: false,
  referenceGoalDraft: null,
  retrospectives: [],
  lastIncompleteCheckShownKey: null,
  fullRetroSubmitCount: 0,
};

interface AppState extends AppData {
  setHydrated: () => void;
  setProfile: (nickname: string, field: ProfileField, occupation: Occupation) => void;
  createDraftGoal: (input: NewGoalInput) => "success" | "insufficient_time";
  applyDraftReconciliation: (edits: {
    tasks: Task[];
    weekdayMinutes: number;
    weekendMinutes: number;
    startDate: string;
    targetDate: string;
  }) => "success" | "insufficient_time";
  confirmPlan: () => void;
  toggleTaskComplete: (taskId: string) => void;
  excludeTask: (taskId: string) => void;
  deferTask: (taskId: string) => void;
  commitReplan: (edits: ReplanCommitInput) => void;
  // Permanently deletes the current active goal and everything scoped to
  // it (tasks, its own retrospectives) — distinct from deleteArchivedPlans,
  // which only ever touches the separate archive list. No-op if there's no
  // active goal. Other goals' archived data is untouched by design, since
  // `tasks`/`retrospectives` only ever hold this one active goal's records.
  deleteActiveGoal: () => void;
  ensureArchiveSeed: () => void;
  toggleFavoriteArchive: (archiveId: string) => "added" | "removed" | "limit_reached";
  deleteArchivedPlans: (archiveIds: string[]) => void;
  setReferenceGoalDraft: (draft: ReferenceGoalDraft) => void;
  clearReferenceGoalDraft: () => void;
  // Returns the 0-based "모모" celebration-set index to show for this
  // submission when it recorded a *new* full-type retrospective, or null for
  // a partial-type submission (no celebration screen) or a same
  // goal/date resubmission (defensive — the dashboard's own gating should
  // prevent this from ever actually happening).
  submitRetrospective: (input: Omit<Retrospective, "retrospective_id" | "submitted_at">) => number | null;
  markIncompleteCheckShown: (goalId: string, date: string) => void;
}

const INSUFFICIENT_TIME_MESSAGE =
  "현재 기간과 가용 시간만으로는 목표를 위한 계획을 모두 배치하기 어려워요. 목표일이나 하루 가용 시간을 조정해 주세요.";

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

// --- 계정별 저장소 전환 (components/auth/LoginGateProvider.tsx 와는 무관,
// lib/authSync.ts만 호출한다) ---
//
// 비로그인 상태는 레거시 `modo-storage`가 아니라 별도의 게스트 키를 쓴다 —
// requireLogin으로 막혀 있어 비로그인 상태에서 실제로 쓰기가 일어난 적이
// 없긴 하지만, 레거시 키를 "읽기조차" 하지 않아야 그 데이터를 절대 건드리지
// 않는다는 보장이 코드만 봐도 명백해진다.
export const GUEST_STORAGE_KEY = "modo-storage:guest";

export function accountStorageKey(userId: string): string {
  return `modo-storage:${userId}`;
}

// 지금 안전하게 쓸 수 있는 키 — 전환 중(= 아직 rehydrate가 끝나지 않음)에는
// null이라, 그 사이에 어떤 set()이 호출되든(다른 클릭, 혹은 나중에 비동기
// 액션이 생기면 그 늦게 끝나는 콜백까지) storage에는 전혀 반영되지 않는다.
// zustand persist는 모든 액션의 set() 호출마다 즉시
// storage.setItem(그 순간의 options.name, 전체 state)를 실행하므로(소스
// 확인됨), "메모리만 리셋"하는 액션으로는 이 틈을 막을 수 없다 — 그래서
// merge(아래)가 아니라 storage 자체를 감싸는 이 가드가 핵심 안전장치다.
let settledKey: string | null = null;

function readRawStorage(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

const guardedRawStorage = {
  getItem: readRawStorage,
  setItem: (name: string, value: string) => {
    if (name !== settledKey) return; // 전환 중이거나 다른 계정 키 — 디스크에 닿지 않게 버린다.
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // 프라이빗 모드/용량 초과 — 기존 createJSONStorage(() => localStorage)와 동일하게 조용히 무시.
    }
  },
  removeItem: (name: string) => {
    if (name !== settledKey) return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

let pendingHydrationUnsub: (() => void) | null = null;

// lib/authSync.ts가 로그인/로그아웃/계정 전환마다(그리고 앱 최초 부팅 시)
// 호출하는 단 하나의 진입점. "settledKey=null로 모든 쓰기를 먼저 잠그고 →
// 키를 바꾸고 → rehydrate → 그 rehydrate가 실제로 끝난 뒤에만 다시 쓰기를
// 연다" 순서를 한 곳에 캡슐화해, 호출부가 순서를 틀릴 여지를 없앤다.
// zustand persist 자체의 hydrationVersion 가드(소스 확인됨)가 "더 최신
// 전환이 이미 시작됐으면 이전 전환의 완료 콜백은 호출되지 않는다"를 보장해,
// 전환이 연달아 겹쳐도 가장 마지막 호출만 settledKey를 설정하게 된다.
export function switchAccountStorage(key: string): Promise<void> {
  settledKey = null;
  pendingHydrationUnsub?.();
  pendingHydrationUnsub = null;

  // 전환 시작과 동시에 메모리 상태를 완전히 비운다 — 그렇지 않으면 이
  // rehydrate가 끝나기 전까지(비동기 구간) 이전 계정의 profile/goal/tasks가
  // 그대로 화면에 남아있는다. settledKey가 이미 null이라 이 setState가
  // 트리거하는 setItem()은 guardedRawStorage가 막아 디스크에는 쓰이지
  // 않는다 — 메모리만 비운다. hydrated를 다시 false로 내려서, 이미 거의
  // 모든 화면(SideNav/dashboard/archive 등)이 쓰고 있는 "아직 안 끝남" 가드가
  // 최초 부팅 때처럼 이번 전환 중에도 똑같이 걸리게 한다.
  useAppStore.setState({ ...INITIAL_STATE, hydrated: false });

  useAppStore.persist.setOptions({ name: key });

  return new Promise<void>((resolve) => {
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub();
      pendingHydrationUnsub = null;
      settledKey = key;
      resolve();
    });
    pendingHydrationUnsub = unsub;
    void useAppStore.persist.rehydrate();
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setHydrated: () => set({ hydrated: true }),

      setProfile: (nickname, field, occupation) => {
        const profile: Profile = {
          user_id: "local-user",
          email: null,
          nickname,
          field,
          occupation,
          created_at: new Date().toISOString(),
        };
        set({ profile });
      },

      createDraftGoal: (input) => {
        const profile = get().profile;
        if (!profile) return "insufficient_time";

        const result = generatePlan({
          profile: { status: profile.status, job_role: profile.job_role },
          goal: {
            title: input.title,
            context: input.contextText,
            start_date: input.startDate,
            target_date: input.targetDate,
          },
          available_time: {
            weekday_minutes: input.weekdayMinutes,
            weekend_minutes: input.weekendMinutes,
          },
        });

        if (result.status === "insufficient_time") {
          set({ draftError: INSUFFICIENT_TIME_MESSAGE, draftPlan: null });
          return "insufficient_time";
        }

        const goalId = newId("goal");
        const goal: Goal = {
          goal_id: goalId,
          user_id: profile.user_id,
          title: input.title,
          context_text: input.contextText,
          start_date: input.startDate,
          target_date: input.targetDate,
          weekday_minutes: input.weekdayMinutes,
          weekend_minutes: input.weekendMinutes,
          status: "draft",
        };
        const tasks: Task[] = result.tasks.map((t) => ({
          task_id: newId("task"),
          goal_id: goalId,
          title: t.title,
          scheduled_date: t.date,
          duration_minutes: t.duration_minutes,
          order: t.order,
          status: "pending",
          original_date: null,
          deferred_at: null,
        }));

        set({ draftPlan: { goal, tasks }, draftError: null });
        return "success";
      },

      applyDraftReconciliation: (edits) => {
        const draft = get().draftPlan;
        if (!draft) return "insufficient_time";

        const result = reconcilePlan({
          tasks: edits.tasks.map((t) => ({
            task_id: t.task_id,
            title: t.title,
            scheduled_date: t.scheduled_date,
            duration_minutes: t.duration_minutes,
            order: t.order,
          })),
          start_date: edits.startDate,
          target_date: edits.targetDate,
          available_time: {
            weekday_minutes: edits.weekdayMinutes,
            weekend_minutes: edits.weekendMinutes,
          },
        });

        if (result.status === "insufficient_time") {
          return "insufficient_time";
        }

        const byId = new Map(edits.tasks.map((t) => [t.task_id, t]));
        const tasks: Task[] = result.tasks
          .map((r) => {
            const original = byId.get(r.task_id);
            if (!original) return null;
            return {
              ...original,
              scheduled_date: r.scheduled_date,
              duration_minutes: r.duration_minutes,
              order: r.order,
            };
          })
          .filter((t): t is Task => t !== null);

        set({
          draftPlan: {
            goal: {
              ...draft.goal,
              start_date: edits.startDate,
              target_date: edits.targetDate,
              weekday_minutes: edits.weekdayMinutes,
              weekend_minutes: edits.weekendMinutes,
            },
            tasks,
          },
        });
        return "success";
      },

      confirmPlan: () => {
        const draft = get().draftPlan;
        if (!draft) return;
        set({
          goal: { ...draft.goal, status: "active" },
          tasks: draft.tasks,
          draftPlan: null,
          draftError: null,
        });
      },

      // One-way: pending -> completed only. A completed (or cancelled) Task
      // is a no-op here — MODO 0.7 never lets a completed Task un-complete,
      // regardless of which UI path (checkbox or timeline 완료하기) called
      // this, so the lock lives in the state transition itself, not just in
      // each caller's own disabled-button styling.
      toggleTaskComplete: (taskId) => {
        set({
          tasks: get().tasks.map((t) => {
            if (t.task_id !== taskId || t.status !== "pending") return t;
            return { ...t, status: "completed" };
          }),
        });
      },

      // No-op on an already-completed Task — completing a Task locks it
      // against every other status-changing action, exclude included.
      excludeTask: (taskId) => {
        set({
          tasks: get().tasks.map((t) =>
            t.task_id === taskId && t.status !== "completed" ? { ...t, status: "cancelled" } : t
          ),
        });
      },

      deferTask: (taskId) => {
        set({
          tasks: get().tasks.map((t) =>
            t.task_id === taskId && t.status === "pending"
              ? { ...t, deferred_at: new Date().toISOString() }
              : t
          ),
        });
      },

      commitReplan: (edits) => {
        const goal = get().goal;
        if (!goal) return;
        const editsById = new Map(edits.tasks.map((t) => [t.task_id, t]));
        const excludedSet = new Set(edits.excludedTaskIds);
        set({
          goal: {
            ...goal,
            weekday_minutes: edits.weekdayMinutes,
            weekend_minutes: edits.weekendMinutes,
          },
          tasks: get().tasks.map((t) => {
            if (excludedSet.has(t.task_id)) {
              return t.status === "cancelled" ? t : { ...t, status: "cancelled" };
            }
            const edit = editsById.get(t.task_id);
            if (!edit) return t;
            const moved = edit.scheduled_date !== t.scheduled_date;
            return {
              ...t,
              scheduled_date: edit.scheduled_date,
              duration_minutes: edit.duration_minutes,
              order: edit.order,
              original_date: moved ? t.original_date ?? t.scheduled_date : t.original_date,
              deferred_at: moved ? null : t.deferred_at,
            };
          }),
        });
      },

      deleteActiveGoal: () => {
        const goal = get().goal;
        if (!goal) return;
        set({
          goal: null,
          tasks: [],
          retrospectives: get().retrospectives.filter((r) => r.goal_id !== goal.goal_id),
          lastIncompleteCheckShownKey: null,
        });
      },

      ensureArchiveSeed: () => {
        if (get().archiveSeeded) return;
        set({
          archivedPlans: buildArchiveSeed(),
          favoriteArchiveIds: FAVORITED_ARCHIVE_IDS,
          archiveSeeded: true,
        });
      },

      toggleFavoriteArchive: (archiveId) => {
        const current = get().favoriteArchiveIds;
        if (current.includes(archiveId)) {
          set({ favoriteArchiveIds: current.filter((id) => id !== archiveId) });
          return "removed";
        }
        if (current.length >= MAX_FAVORITE_ARCHIVES) return "limit_reached";
        set({ favoriteArchiveIds: [...current, archiveId] });
        return "added";
      },

      deleteArchivedPlans: (archiveIds) => {
        const idSet = new Set(archiveIds);
        set({
          archivedPlans: get().archivedPlans.filter((p) => !idSet.has(p.archive_id)),
          favoriteArchiveIds: get().favoriteArchiveIds.filter((id) => !idSet.has(id)),
        });
      },

      setReferenceGoalDraft: (draft) => set({ referenceGoalDraft: draft }),

      clearReferenceGoalDraft: () => set({ referenceGoalDraft: null }),

      submitRetrospective: (input) => {
        const existing = get().retrospectives;
        // A fresh (goal_id, date) pair, not a resubmission for one already
        // recorded — only this case advances the momo cycle below.
        const isNewSubmission = !existing.some((r) => r.goal_id === input.goal_id && r.date === input.date);
        const retrospective: Retrospective = {
          ...input,
          retrospective_id: newId("retro"),
          submitted_at: new Date().toISOString(),
        };
        const advanceMomoCycle = input.type === "full" && isNewSubmission;
        const nextFullRetroSubmitCount = advanceMomoCycle
          ? get().fullRetroSubmitCount + 1
          : get().fullRetroSubmitCount;

        set({
          // Upsert by (goal_id, date) — NOT date alone. A new goal created
          // the same calendar day as a previous goal's retrospective is a
          // distinct retrospective target: this app replaces `goal`/`tasks`
          // wholesale on confirming a new plan (see confirmPlan), so "same
          // date" alone can no longer stand in for "same plan" the moment a
          // second goal exists for that date. Defensive only — the
          // dashboard's own gating logic should prevent a second submission
          // for the same (goal_id, date) from ever actually firing.
          retrospectives: [
            ...existing.filter((r) => !(r.goal_id === input.goal_id && r.date === input.date)),
            retrospective,
          ],
          fullRetroSubmitCount: nextFullRetroSubmitCount,
        });

        return advanceMomoCycle ? (nextFullRetroSubmitCount - 1) % MOMO_SETS.length : null;
      },

      markIncompleteCheckShown: (goalId, date) => set({ lastIncompleteCheckShownKey: `${goalId}:${date}` }),
    }),
    {
      name: GUEST_STORAGE_KEY,
      storage: createJSONStorage(() => guardedRawStorage),
      skipHydration: true,
      // hydrated는 로딩 게이트일 뿐 계정 데이터가 아니다 — 저장되는 JSON에서
      // 완전히 빼서, 전환 중 hydrated=false를 켜는 행위 자체가 애초에 디스크에
      // 닿을 데이터가 아니게 만든다(위 storage 가드와는 별개의 이중 보호).
      partialize: (state) => {
        const { hydrated, ...rest } = state;
        void hydrated; // 의도적으로 저장 대상에서 제외 — 로딩 게이트일 뿐 계정 데이터가 아니다.
        return rest;
      },
      // 기본 merge(= {...currentState, ...persistedState})는 그 키에 저장된
      // 값이 아직 없을 때 "지금 메모리에 떠 있던 값 그대로"를 결과로 남겨버린다
      // — 전환 전 계정의 데이터가 새 계정에도 그대로 보이는 바로 그 버그다.
      // INITIAL_STATE를 currentState보다 뒤에 덮어써서, 저장된 값이 있으면 그
      // 값(+누락 필드는 초기값으로 보완), 없으면 무조건 INITIAL_STATE가 되도록
      // 고정한다 — 결과가 "그 순간 메모리에 뭐가 있었는지"에 전혀 의존하지
      // 않게 만드는 것이 핵심이다.
      merge: (persistedState, currentState) => {
        const stored =
          persistedState && typeof persistedState === "object"
            ? (persistedState as Partial<AppState>)
            : undefined;
        return { ...currentState, ...INITIAL_STATE, ...stored };
      },
    }
  )
);
