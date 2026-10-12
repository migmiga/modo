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

interface AppState {
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      name: "modo-storage",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
