# PRD: MODO(모두)

## 1. 한 줄 정의

> 목표를 실행 가능한 일일 계획으로 만들고, 실행 상황에 맞춰 다시 조정해주는 AI 목표 관리 서비스

## 2. 문제와 타깃

**문제**

사용자는 목표를 세운 뒤 이를 구체적인 할 일로 나누고, 각 할 일의 소요 시간과 하루에 수행 가능한 계획량을 판단하는 데 어려움을 겪는다.

또한 실제 수행 과정에서 예상보다 시간이 오래 걸리거나 일정·컨디션이 달라져 계획이 틀어지면, 남은 계획을 다시 계산하고 배분해야 하는 번거로움을 경험한다.

**타깃**

학습, 취업 준비, 개인 프로젝트 등 일정 기간 지속적으로 수행해야 하는 개인 목표가 있으며, 이를 일일 실행 계획으로 구체화하거나 계획이 틀어진 뒤 다시 조정하는 데 어려움을 겪는 사용자

## 3. 핵심 시나리오

1. **프로필 설정:** 최초 이용 시 현재 상태와 현재/관심 직무를 입력한다. (입력한 정보는 이후 AI 계획 생성 시 기본 맥락으로 활용한다.)
2. **목표 생성 및 현재 상황 입력:** 목표, 기간, 평일/주말 가용 시간을 입력한다. (필요하면 현재 진행 상태나 이미 완료한 내용 등 목표와 관련된 상황을 추가로 입력한다.)
3. **AI 계획 생성:** AI가 사용자 프로필과 목표의 현재 상황을 참고해 목표를 실행 가능한 세부 할 일로 나누고, 가용 시간에 맞춰 일별로 배분한다.
4. **계획 확인 및 간편 수정:** 생성된 전체 계획을 확인하고, 필요 없는 할 일을 삭제하거나 동일 날짜 내 순서를 변경한다. (AI가 제안한 권장 소요 시간이 자신의 상황과 다르다면 직접 수정한 뒤 계획을 확정한다.)
5. **오늘의 계획 실행:** 오늘 해야 할 일과 권장 소요 시간을 확인하고 완료 체크한다. (더 이상 필요하지 않은 할 일은 `[일정에서 제외]`한다.)
6. **계획 수동 재조정:** 지난 날짜의 미완료 할 일이 발생하면 `[남은 계획 재조정하기]`를 누른다. (미완료 할 일 중 여전히 필요한 일을 선택하면 AI가 남은 기간과 가용 시간을 기준으로 계획을 다시 배치하고, 사용자가 확인 후 적용한다.)

**핵심 Loop:** `Context → Plan → Do → Adjust → Do`

## 4. 기능 범위

### Must (v0.7)

1. **Context 기반 AI 계획 생성 및 간편 수정**
   - Profile Context: 현재 상태(학생/취업 준비/직장인/프리랜서/기타), 현재/관심 직무 — 최초 1회 입력, 이후 계획 생성 시 기본 정보로 활용
   - 목표 정보: 목표명, 시작일, 목표일, 평일/주말 하루 가용 시간
   - 계획 기간: 시작일을 포함해 최대 7일(캘린더 날짜 기준)로 제한
   - Goal Context: 선택 입력, 최대 500자, 미입력 시에도 계획 생성 가능
   - AI 계획 생성: 목표를 세부 Task로 분해, Task별 권장 소요 시간 제안, 평일/주말 가용 시간에 맞춰 일별 배분
   - 계획 확정 전 수정 가능 범위: Task 삭제, 동일 날짜 내 순서 변경, 권장 소요 시간 수정 (초과 시 안내), `[이 계획으로 시작하기]`로 확정
2. **오늘의 계획 실행 및 진행 관리**
   - 오늘 Task 표시, 권장 소요 시간 표시, 완료 체크, 진행률 표시, `[일정에서 제외]`
   - Task 상태: `pending` / `completed` / `cancelled`
   - 진행률(MVP): `completed / (completed + pending + cancelled) × 100`
3. **AI 계획 재조정**
   - 미완료 판단: `scheduled_date < today AND status = pending`
   - 미완료 존재 시 홈에 "밀린 할 일이 N개 있어요." 배너 노출
   - 각 미완료 Task에 대해 `[다시 계획에 넣기]` / `[일정에서 제외]` 선택
   - AI는 선택된 미완료 Task + 앞으로 예정된 pending Task만 재배치
   - 재조정 원칙: 미완료 감지 → 사용자 판단 → 재조정 요청 → AI 재배치 → 사용자 확인 → 적용

### Won't (v0.7)

Goal Context 태그/칩 선택, 주간/월간 수행 리포트, 수행 패턴 AI 분석, 집중 타이머, 푸시 알림, 외부 캘린더/Notion 연동, AI 챗봇, 보상/스트릭, 복수 목표 관리 및 우선순위 조정, 목표 달성 가능성 예측.

## 5. 화면 구성

- 화면 0 · 프로필 설정
- 화면 1 · 목표 생성
- 화면 2 · AI 계획 확인 및 수정
- 화면 3 · 홈 / 오늘의 계획
- 화면 4 · 계획 재조정 (Step1 미완료 확인 / Step2 재조정 결과 확인)

(세부 문구/구성은 원본 PRD 참조)

### PC Navigation (IA)

PC 화면에는 좌측 Side Navigation으로 3개 메뉴를 둔다.

- **AI 플래너**(`/goals/new`, `/goals/review`): 새 목표를 입력해 AI 계획을 만드는 공간(화면 1·2).
- **대시보드**(`/`): 적용된 계획을 실행·관리하는 공간 — 기존 화면 3(홈)과 동일. `/plan`(전체 계획 보기)·`/replan`(계획 재조정)도 대시보드 하위로 취급한다.
- **보관함**(`/archive`): 저장해둔 이전 계획을 다시 확인하는 공간. **MVP(v0.7)에서는 조회 전용 진입점만 존재** — 계획을 보관함에 저장하는 기능, 복사해서 새 계획 만들기, 재적용 등은 아직 구현하지 않는다.

모바일에는 이 Side Navigation이 없다(별도 모바일 네비게이션은 추후 과제).

## 6. AI 동작 정의

- **AI 01 · 계획 생성:** `{profile, goal, available_time}` → `{status:'success', tasks:[...]}` 또는 `{status:'insufficient_time', tasks:[]}`
- **AI 02 · 계획 재조정:** `{current_date, target_date, incomplete_tasks, remaining_tasks, available_time}` → `{status:'success', rescheduled_tasks:[...]}` 또는 `{status:'insufficient_time', rescheduled_tasks:[]}`
- **AI 03 · 계획 수정 반영(재조정):** 계획 수정하기 화면에서 `[완료]`를 누르면 `{tasks, start_date, target_date, available_time}` → `{status:'success', tasks:[...]}` 또는 `{status:'insufficient_time', tasks:[]}`. 사용자가 유지/추가/삭제/순서 변경한 Task와 변경된 가용 시간을 입력으로 받아, 소요시간이 미정인 신규 Task에 소요시간을 배정하고 가용 시간을 넘는 날짜의 Task만 뒤로 재배치한다.
- 실패 처리 문구 및 프롬프트 방향은 원본 PRD 6장 참조. M1에서는 `lib/mockAi.ts`가 동일한 입출력 스키마를 따르는 규칙 기반 더미 로직(`generatePlan`/`replanTasks`/`reconcilePlan`)으로 이를 대체한다.
- **계획 수정하기 화면의 편집 원칙:** 이 화면에서 사용자는 "무엇을 할지"(Task 추가/삭제/같은 날짜 내 순서 변경)와 가용 시간만 바꾸고, Task 소요시간은 직접 조정하지 않는다. 편집 중에는 AI가 실시간으로 개입하지 않으며, `[완료]`를 누른 뒤에만 AI(M1: `reconcilePlan` 더미 / M2: 실제 AI)가 소요시간 산정과 날짜 재배치를 수행한다. `[완료]`는 Dashboard에 즉시 반영하는 Action이 아니라 수정된 계획을 다시 Preview에서 확인하게 하는 Action이다(최종 반영은 Preview의 `[적용하기]`에서만 일어난다).

**Task 제목 생성 원칙 (M2 실제 AI 연결 시 프롬프트에 반영):**
1. 각 Task는 사용자가 바로 실행할 수 있는 구체적인 행동 단위여야 한다. "실행 1단계", "준비하기", "진행하기"처럼 실제 행동을 알 수 없는 추상적인 제목은 생성하지 않는다.
2. "자료 조사하기", "내용 정리하기"처럼 작업 대상이 드러나지 않는 지나치게 추상적인 이름도 피한다 — 무엇에 대한 조사/정리인지가 제목만으로 드러나야 한다.
3. Task 제목에 Goal title을 반복 포함하지 않는다. (화면 상단에 Goal title이 이미 표시되므로 중복 불필요)
4. Goal Context(`context_text`)에 입력된 현재 진행 상태·이미 완료한 내용·필요한 산출물을 계획 생성에 적극 반영하고, 이미 완료했다고 입력된 작업은 다시 계획하지 않는다.
5. Task 제목은 짧은 행동형 문장(예: "~하기")으로 작성하며, 15자 내외를 기준으로 하되 의미 전달에 필요하면 더 길어져도 된다. 불필요한 수식어나 반복 표현은 제거한다.
6. 사용자가 직접 작성했거나 수정한 기존 Task 제목은 재생성 시 임의로 변경하지 않는다.

## 7. 기술 스택

- Framework: Next.js (App Router, TypeScript)
- Styling: Tailwind CSS
- Database / Auth: Supabase (M3)
- AI API: OpenAI API — 구조화된 출력을 안정적으로 지원하는 모델 선택 (M2)
- Deployment: Vercel (M3)
- M1 범위: Supabase/OpenAI 미연동. 상태는 Zustand + localStorage, AI는 `lib/mockAi.ts` 더미 로직으로 대체.

## 8. 데이터

### User Profile
`user_id, email, nickname, status, job_role, created_at`

### Goal
`goal_id, user_id, title, context_text, start_date, target_date, weekday_minutes, weekend_minutes, status`

### Task
`task_id, goal_id, title, scheduled_date, duration_minutes, order, status, original_date`

### Task Status
`pending | completed | cancelled` — `cancelled` Task는 AI 재조정 대상에서 제외한다.

### original_date 규칙
- 최초 생성 시: `original_date = null`, `scheduled_date = 최초 계획일`
- 최초 재조정 시: `original_date = 기존 scheduled_date`, `scheduled_date = 새 계획일`
- 2차 이후 재조정 시: `original_date` 변경하지 않음, `scheduled_date = 새 계획일`

### 하루 Task 개수 제한
하루(`scheduled_date` 기준)에 배치되는 Task는 최대 8개(`completed` 포함, `cancelled` 제외)로 제한한다.
AI 계획 생성(AI 01)·계획 수정 반영(AI 03)·계획 재조정(AI 02) 모두 동일한 기준을 적용하며, 8개 제한으로
정상 배치할 수 없으면 Task를 임의로 삭제·병합하지 않고 `insufficient_time`을 반환한다.

## 9. 마일스톤과 완료 기준

- [x] **M1 · 더미 데이터 기반 프로토타입:** `프로필 설정 → 목표/현재 상황 입력 → AI 계획 확인 및 수정 → 계획 확정 → 오늘의 계획 → 완료/일정 제외 → 미완료 계획 재조정` 전체 Flow가 더미 데이터로 동작한다.
  - 완료: Next.js(App Router) + Tailwind + Zustand(localStorage persist) 기반으로 화면 0~4 전체 구현, `lib/mockAi.ts`가 PRD 6장 입출력 스키마와 동일한 더미 계획 생성/재조정 로직 제공. `npm run build`/`npm run lint` 통과.
- [ ] **M2 · 실제 AI API 연결:** Profile/Goal Context 기반 계획 생성, 구조화된 JSON 처리, `success / insufficient_time`, 사용자 수정 소요 시간 반영, 계획 재조정 및 실패 처리를 구현한다.
- [ ] **M3 · DB / 인증 / 배포:** Supabase CRUD/Auth, Task 상태 및 `original_date` 규칙을 적용하고 Vercel에 배포하여 실제 UT가 가능한 상태로 만든다.
- **완료 기준:** 처음 사용하는 사용자가 별도의 설명 없이 자신의 목표·현재 상황·가용 시간을 입력하고, AI가 만든 계획을 자신의 상황에 맞게 수정·확정한 뒤 오늘의 할 일을 수행하고, 계획이 밀렸을 때 필요한 일을 판단하여 남은 계획을 다시 배치·적용할 수 있다.

### 에이전트 작업 규칙

- `M1 → M2 → M3` 순서로만 작업할 것.
- 각 마일스톤 시작 전 구현 계획을 먼저 보여줄 것.
- `Won't (v0.7)` 기능은 이번 버전에서 제안하거나 구현하지 말 것.
- PRD에 정의되지 않은 기능을 임의로 추가하지 말 것.
- AI 출력은 정의된 JSON 형식을 준수할 것.
- AI가 생성한 최초 계획은 사용자가 `[이 계획으로 시작하기]`를 누르기 전까지 확정하지 말 것.
- AI 재조정 결과는 사용자가 `[새 계획 적용하기]`를 누르기 전까지 기존 계획에 반영하지 말 것.
- 마일스톤 완료 시 체크박스를 갱신할 것.
