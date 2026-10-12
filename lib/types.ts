// PRD 8장 데이터 스키마를 그대로 타입화한다.

// 레거시 — 이전 버전 온보딩("현재 상태" 5지선다 버튼)에서만 쓰였다. 새 가입
// 흐름은 더 이상 이 값을 쓰지 않지만, 이미 저장된 사용자 데이터를 보존하기
// 위해 타입과 옵션 목록(lib/constants.ts의 PROFILE_STATUS_OPTIONS) 모두 남긴다.
export type ProfileStatus =
  | "job_seeker"
  | "employee"
  | "student"
  | "freelancer"
  | "other";

// 분야 — 프로필 설정의 "분야" 드롭다운.
export type ProfileField =
  | "humanities_social"
  | "business_economics"
  | "engineering_it"
  | "natural_science"
  | "medicine_health"
  | "law"
  | "education"
  | "arts_sports"
  | "design"
  | "media_content"
  | "public_administration"
  | "agriculture_fishery"
  | "service"
  | "none"
  | "other";

// 직종 — 프로필 설정의 "직종" 드롭다운. 주부·군인은 별도 항목 없이 "기타"로 분류.
export type Occupation =
  | "middle_high_school"
  | "university"
  | "graduate_school"
  | "employee"
  | "professional"
  | "public_servant"
  | "self_employed_freelancer"
  | "job_seeker"
  | "startup_prep"
  | "unemployed"
  | "other";

export interface Profile {
  user_id: string;
  email: string | null;
  nickname: string;
  // --- 레거시 필드 — 새 가입 흐름은 더 이상 쓰지 않지만, 이미 저장된 사용자
  // 데이터를 그대로 보존하기 위해 옵셔널로 남긴다. ---
  status?: ProfileStatus;
  job_role?: string;
  // --- 신규 필드 ---
  field?: ProfileField;
  occupation?: Occupation;
  created_at: string;
}

export type GoalStatus = "draft" | "active";

export interface Goal {
  goal_id: string;
  user_id: string;
  title: string;
  context_text: string | null;
  start_date: string; // yyyy-mm-dd
  target_date: string; // yyyy-mm-dd
  weekday_minutes: number;
  weekend_minutes: number;
  status: GoalStatus;
}

export type TaskStatus = "pending" | "completed" | "cancelled";

export interface Task {
  task_id: string;
  goal_id: string;
  title: string;
  scheduled_date: string; // yyyy-mm-dd
  duration_minutes: number;
  order: number;
  status: TaskStatus;
  original_date: string | null;
  deferred_at: string | null; // 보류("나중에 하기") 시각(ISO). null이면 보류 아님.
}

export interface AvailableTime {
  weekday_minutes: number;
  weekend_minutes: number;
}

// --- AI 01 · 계획 생성 ---

export interface AiPlanInput {
  // 신규 가입 흐름은 status/job_role을 더 이상 쓰지 않아 옵셔널로 둔다 — 아래
  // generatePlan(mockAi.ts)은 애초에 이 값을 읽지 않는 목(mock) 구현이라
  // 영향이 없다. 실제 AI 연동 시 field/occupation 기반으로 다시 설계될 값.
  profile: {
    status?: ProfileStatus;
    job_role?: string;
  };
  goal: {
    title: string;
    context: string | null;
    start_date: string;
    target_date: string;
  };
  available_time: AvailableTime;
}

export interface AiPlanTask {
  title: string;
  date: string;
  duration_minutes: number;
  order: number;
}

export type AiPlanResult =
  | { status: "success"; tasks: AiPlanTask[] }
  | { status: "insufficient_time"; tasks: [] };

// AI 02(계획 재조정 일괄 배치)는 /replan 화면 개편으로 제거됐다 — 카드형 수동
// 배치 + 날짜별 AI 04 재조정으로 대체.

// --- AI 03 · 계획 수정 반영(재조정) ---
// 계획 수정하기 화면에서 "완료"를 눌렀을 때: 사용자가 유지/추가/삭제/순서 변경한
// Task와 변경된 가용 시간을 받아, 소요시간 미정(<=0)인 신규 Task에 소요시간을
// 배정하고 가용 시간을 넘는 날짜의 Task만 뒤로 재배치한다.

export interface AiReconcileTaskInput {
  task_id: string;
  title: string;
  scheduled_date: string;
  duration_minutes: number;
  order: number;
}

export interface AiReconcileInput {
  tasks: AiReconcileTaskInput[];
  start_date: string;
  target_date: string;
  available_time: AvailableTime;
}

export interface AiReconciledTask {
  task_id: string;
  scheduled_date: string;
  duration_minutes: number;
  order: number;
}

export type AiReconcileResult =
  | { status: "success"; tasks: AiReconciledTask[] }
  | { status: "insufficient_time"; tasks: [] };

// --- AI 04 · 날짜별 수동 재조정 (M1 신규 — PRD 6장의 AI 01~03과는 별도로, 계획
// 수정 화면에서 사용자가 날짜별 [재조정] 버튼을 눌렀을 때만 실행된다) ---
// 해당 날짜의 Task(기존 + 신규)만 대상으로 소요 시간을 다시 배분한다. AI 03과
// 달리 다른 날짜로 넘기지 않으며, 해당 날짜 가용 시간 안에 전부 들어가지
// 않으면 insufficient_time을 반환하고 기존 값을 그대로 보존한다.

export interface AiDayReconcileTaskInput {
  task_id: string;
  title: string;
  order: number;
}

export interface AiDayReconcileInput {
  tasks: AiDayReconcileTaskInput[];
  budget_minutes: number;
}

export interface AiDayReconciledTask {
  task_id: string;
  duration_minutes: number;
}

export type AiDayReconcileResult =
  | { status: "success"; tasks: AiDayReconciledTask[] }
  | { status: "insufficient_time"; tasks: [] };

// --- 메모장 (Mock/local state 전용 — store에는 포함하지 않음) ---
// 날짜와 분리된 영역 — 선택 날짜로 필터링하지 않는다. created_at은 기록만 하고
// 현재 UI에는 노출하지 않음(추후 별도 메모 관리 화면에서 활용 예정).

export interface Note {
  id: string;
  title: string;
  url?: string;
  content?: string;
  tags?: string[]; // registration order preserved; absent/empty = no tags
  created_at: string; // ISO datetime
}

// --- 하루 회고 (MODO 0.7) ---

export type RetrospectiveType = "full" | "partial";
export type WorkloadChip = "very_low" | "low" | "appropriate" | "high" | "very_high";
export type ConditionLevel = 1 | 2 | 3 | 4 | 5;

export interface Retrospective {
  retrospective_id: string;
  goal_id: string;
  date: string; // 제출 시점의 오늘 날짜(yyyy-mm-dd) — partial도 "체크인 수행일" 기준
  type: RetrospectiveType;
  condition: ConditionLevel | null; // full만, partial은 항상 null
  workload_chip: WorkloadChip;
  satisfaction_rating: 1 | 2 | 3 | 4 | 5;
  free_text: string | null; // 선택 입력 — full/partial 모두 작성 시에만 값이 있음
  completed_task_ids: string[];
  incomplete_task_ids: string[]; // partial만, full은 항상 []
  submitted_at: string; // ISO
}

// --- 보관함 ---

export interface ArchivedPlan {
  archive_id: string;
  goal: Goal;
  tasks: Task[];
  category: string; // Mock 카테고리 풀 — 카테고리 체계는 아직 확정되지 않음
  created_at: string; // ISO datetime — 생성순 정렬 기준
}
