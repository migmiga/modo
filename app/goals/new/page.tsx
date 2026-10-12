"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/ui/LoadingScreen";

// AI 플래너는 이제 기본 진입 경로(/)에서 보여준다. 이 경로는 옛 북마크나
// 직접 접속을 안전하게 흘려보내는 리다이렉트 전용 셸이다.
export default function NewGoalRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <LoadingScreen />;
}
