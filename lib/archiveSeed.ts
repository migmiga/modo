import { enumerateDates } from "./dateUtils";
import type { ArchivedPlan, Task } from "./types";

// 보관함 M1 단계의 Mock 시드 데이터. 실제 "계획 완료 시 보관함에 저장" 플로우가
// 아직 없으므로, 화면을 데모할 수 있도록 고정된(랜덤이 아닌) 과거 계획 목록을
// 한 번만 만들어 둔다. 날짜/완료 개수를 직접 지정해 진행률을 다양하게 분산한다.

function makeTasks(
  goalId: string,
  archiveId: string,
  dates: string[],
  titles: string[],
  completedCount: number,
  durationMinutes: number
): Task[] {
  return dates.map((date, i) => ({
    task_id: `${archiveId}_task_${i + 1}`,
    goal_id: goalId,
    title: titles[i],
    scheduled_date: date,
    duration_minutes: durationMinutes,
    order: i + 1,
    status: i < completedCount ? "completed" : "pending",
    original_date: null,
    deferred_at: null,
  }));
}

export function buildArchiveSeed(): ArchivedPlan[] {
  return [
    {
      archive_id: "archive_1",
      category: "자격증",
      created_at: "2026-09-18T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_1",
        user_id: "local-user",
        title: "검찰 1급 필기 준비하기",
        context_text: null,
        start_date: "2026-09-20",
        target_date: "2026-09-24",
        weekday_minutes: 90,
        weekend_minutes: 150,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_1",
        "archive_1",
        enumerateDates("2026-09-20", "2026-09-24"),
        ["형법 기출 1회독", "형사소송법 요약 정리", "오답노트 작성", "모의고사 풀이", "취약 과목 복습"],
        5,
        60
      ),
    },
    {
      archive_id: "archive_2",
      category: "자격증",
      created_at: "2026-08-01T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_2",
        user_id: "local-user",
        title: "토익 900점 넘기기",
        context_text: null,
        start_date: "2026-08-03",
        target_date: "2026-08-07",
        weekday_minutes: 60,
        weekend_minutes: 120,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_2",
        "archive_2",
        enumerateDates("2026-08-03", "2026-08-07"),
        ["파트5 문법 정리", "리스닝 모의고사", "어휘 500개 암기", "리딩 지문 분석", "오답 복습"],
        3,
        45
      ),
    },
    {
      archive_id: "archive_3",
      category: "커리어",
      created_at: "2026-08-27T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_3",
        user_id: "local-user",
        title: "포트폴리오 1개 완성하기",
        context_text: null,
        start_date: "2026-08-29",
        target_date: "2026-09-07",
        weekday_minutes: 120,
        weekend_minutes: 180,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_3",
        "archive_3",
        enumerateDates("2026-08-29", "2026-09-07"),
        [
          "레퍼런스 조사하기",
          "컨셉 기획하기",
          "와이어프레임 그리기",
          "메인 화면 디자인",
          "상세 화면 디자인",
          "인터랙션 정리하기",
          "프로토타입 제작",
          "소개 문구 작성",
          "포트폴리오 사이트 배포",
          "피드백 반영하기",
        ],
        9,
        60
      ),
    },
    {
      archive_id: "archive_4",
      category: "학습",
      created_at: "2026-07-11T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_4",
        user_id: "local-user",
        title: "책 5권 읽기",
        context_text: null,
        start_date: "2026-07-13",
        target_date: "2026-07-17",
        weekday_minutes: 30,
        weekend_minutes: 60,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_4",
        "archive_4",
        enumerateDates("2026-07-13", "2026-07-17"),
        ["1권 완독하기", "2권 완독하기", "3권 완독하기", "4권 완독하기", "5권 완독하기"],
        1,
        45
      ),
    },
    {
      archive_id: "archive_5",
      category: "운동",
      created_at: "2026-09-26T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_5",
        user_id: "local-user",
        title: "5km 러닝 습관 만들기",
        context_text: null,
        start_date: "2026-09-28",
        target_date: "2026-10-02",
        weekday_minutes: 40,
        weekend_minutes: 60,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_5",
        "archive_5",
        enumerateDates("2026-09-28", "2026-10-02"),
        ["3km 러닝하기", "호흡법 연습하기", "4km 러닝하기", "스트레칭 루틴 만들기", "5km 완주하기"],
        2,
        30
      ),
    },
    {
      archive_id: "archive_6",
      category: "자격증",
      created_at: "2026-05-02T09:00:00.000Z",
      goal: {
        goal_id: "archive_goal_6",
        user_id: "local-user",
        title: "정보처리기사 필기",
        context_text: null,
        start_date: "2026-05-04",
        target_date: "2026-05-07",
        weekday_minutes: 90,
        weekend_minutes: 120,
        status: "active",
      },
      tasks: makeTasks(
        "archive_goal_6",
        "archive_6",
        enumerateDates("2026-05-04", "2026-05-07"),
        ["1과목 핵심이론 정리", "2과목 핵심이론 정리", "기출문제 3개년 풀이", "최종 모의고사"],
        4,
        60
      ),
    },
  ];
}

export const FAVORITED_ARCHIVE_IDS = ["archive_1", "archive_3"];
