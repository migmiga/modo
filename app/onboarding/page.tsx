"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { useAppStore } from "@/lib/store";

// 더 이상 독립된 프로필 설정 폼을 보여주지 않는다 — 그 UI는 전역
// ProfileSetupModal(components/auth/ProfileSetupModal.tsx)로 옮겨갔고, 로그인
// 성공 직후에만(LoginGateProvider의 체이닝으로) 열린다. 이 경로는 옛 북마크나
// 직접 접속을 안전하게 흘려보내는 리다이렉트 전용 셸이다 — 비로그인 상태로
// 직접 들어와도 폼이 바로 노출되지 않는다.
export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useAppStore((s) => s.hydrated);
  const goal = useAppStore((s) => s.goal);

  useEffect(() => {
    if (!hydrated) return;
    // 기본 진입 화면은 AI 플래너(/)다 — 활성 목표가 있으면 대시보드로 보낸다.
    router.replace(goal ? "/dashboard" : "/");
  }, [hydrated, goal, router]);

  return <LoadingScreen />;
}
