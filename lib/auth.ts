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
  /** Supabase 세션의 사용자 UUID. "google"일 때만 채워지고, lib/store.ts의
   *  계정별 저장소 키(`modo-storage:${userId}`)를 결정하는 기준이 된다. */
  userId: string | null;
  /** Google 로그인 취소/실패 시 LoginModal에 보여줄 안내 문구. */
  loginError: string | null;
  setLoggedIn: (value: boolean) => void;
  /** 개발용 임시 로그인 전용 — 실제 Google/카카오 버튼은 연동 전까지 이 상태를
   *  건드리지 않는다(가짜 로그인 성공 처리 금지). */
  setDevLoggedIn: () => void;
  /** 실제 Supabase Google 로그인 성공 시 lib/authSync.ts만 호출한다. */
  setGoogleSession: (session: { userId: string; email: string | null }) => void;
  /** 로그아웃/세션 만료 시 lib/authSync.ts만 호출한다. */
  clearSession: () => void;
  setLoginError: (message: string) => void;
  clearLoginError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      provider: null,
      email: null,
      userId: null,
      loginError: null,
      setLoggedIn: (value) => set({ isLoggedIn: value }),
      setDevLoggedIn: () => set({ isLoggedIn: true, provider: "dev", email: null, userId: null }),
      setGoogleSession: ({ userId, email }) =>
        set({ isLoggedIn: true, provider: "google", email, userId }),
      clearSession: () => set({ isLoggedIn: false, provider: null, email: null, userId: null }),
      setLoginError: (message) => set({ loginError: message }),
      clearLoginError: () => set({ loginError: null }),
    }),
    {
      name: "modo-auth-storage",
      storage: createJSONStorage(() => localStorage),
      // loginError는 그 순간의 리다이렉트 결과를 보여주는 1회성 안내일 뿐이라
      // 다음 방문까지 남아있으면 안 된다 — 저장 대상에서 제외한다.
      partialize: (state) => {
        const { loginError, ...rest } = state;
        void loginError; // 의도적으로 저장 대상에서 제외 — 다음 방문까지 남으면 안 되는 1회성 안내.
        return rest;
      },
    }
  )
);
