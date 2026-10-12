"use client";

import { GoalPlanningScreen } from "@/components/goal/GoalPlanningScreen";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAppStore } from "@/lib/store";

// MODO의 기본 진입 화면 — AI 플래너. 이전에는 이 자리가 대시보드였다(지금은
// app/dashboard/page.tsx). 로그인·프로필 설정은 여기서도 여전히 클릭한 액션이
// 가로채서 팝업을 띄우는 방식 그대로이며, 이 라우트 자체는 그 흐름에 관여하지
// 않는다.
export default function HomePage() {
  const hydrated = useAppStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingScreen />;
  }

  return <GoalPlanningScreen />;
}
