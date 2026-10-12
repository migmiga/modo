"use client";

// 실제 OAuth 연동 전 단계의 로그인 "상태"만 보관한다. 기존 `lib/store.ts`의
// `modo-storage`(목표/작업/회고 등 실제 데이터)와는 별도 키로 분리해, 이번
// 작업이 기존 데이터 구조에 전혀 손대지 않도록 한다.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthProvider = "google" | "kakao" | "dev";

interface AuthState {
  isLoggedIn: boolean;
  /** null이면 아직 어떤 수단으로도 로그인하지 않은 상태. "dev"는 실제 OAuth가
   *  아닌 개발용 임시 로그인 — 화면에 "연결 완료"로 표시해서는 안 된다. */
  provider: AuthProvider | null;
  /** OAuth에서 받은 이메일만 담는다 — 없으면 null이고, 임의로 채우지 않는다. */
  email: string | null;
  setLoggedIn: (value: boolean) => void;
  /** 개발용 임시 로그인 전용 — 실제 Google/카카오 버튼은 연동 전까지 이 상태를
   *  건드리지 않는다(가짜 로그인 성공 처리 금지). */
  setDevLoggedIn: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      provider: null,
      email: null,
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      setDevLoggedIn: () => set({ isLoggedIn: true, provider: "dev", email: null }),
    }),
    {
      name: "modo-auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
