"use client";

import { useEffect } from "react";

import { LoginGateProvider } from "@/components/auth/LoginGateProvider";
import { startAuthSync } from "@/lib/authSync";
import { useAppStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 어떤 전환(최초 부팅 포함)이 끝나든 공통으로 hydrated를 켠다 — 최초
    // rehydrate는 더 이상 여기서 직접 부르지 않고, startAuthSync()가 Supabase
    // 세션을 먼저 확인한 뒤 올바른 키로 전환하면서 호출한다(lib/store.ts의
    // switchAccountStorage). 그래야 로그인된 사용자가 새로고침해도 게스트
    // 데이터가 잠깐 그려지는 틈이 없다.
    const unsubHydration = useAppStore.persist.onFinishHydration(() => {
      useAppStore.getState().setHydrated();
    });
    const stopAuthSync = startAuthSync();
    return () => {
      unsubHydration();
      stopAuthSync();
    };
  }, []);

  return <LoginGateProvider>{children}</LoginGateProvider>;
}
