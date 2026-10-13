"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/lib/auth";
import { useAppStore } from "@/lib/store";

import { LoginModal } from "./LoginModal";
import { ProfileSetupModal } from "./ProfileSetupModal";

interface OpenOptions {
  /** false일 때는 팝업을 닫을 때 포커스를 복귀시키지 않는다 — 입력란의
   *  onFocus가 직접 호출하는 경우(아래 LoginModal 사용처 참고) 트리거 자체가
   *  그 입력란이라, 그대로 복귀시키면 다시 포커스 → 다시 팝업이 열리는
   *  무한 루프가 생긴다. */
  restoreFocus?: boolean;
}

// `any[]` (not `never[]`) is required here so TS infers T's real parameter
// types from the function literal passed in, instead of collapsing them to
// `never` — see https://github.com/microsoft/TypeScript/issues/27387.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequireLogin = <T extends (...args: any[]) => unknown>(
  fn: T
) => (...args: Parameters<T>) => ReturnType<T> | undefined;

interface LoginGateContextValue {
  /** 로그인 + 프로필 설정까지 모두 끝난 상태. */
  isOnboarded: boolean;
  open: (options?: OpenOptions) => void;
  requireLogin: RequireLogin;
  /** 이미 온보딩된 사용자가 프로필을 다시 열어 고치는 용도 — open()은 이미
   *  로그인+프로필이 끝난 상태면 아무것도 하지 않으므로 별도로 둔다. */
  openProfileEdit: () => void;
}

const LoginGateContext = createContext<LoginGateContextValue | null>(null);

// 로그인 팝업과 프로필 설정 팝업은 이 하나의 상태로만 전환된다 — 둘이 동시에
// 뜨는 경우가 구조적으로 불가능하다("none"이 아닌 값은 항상 하나뿐).
type GateModal = "none" | "login" | "profile";

export function LoginGateProvider({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const profile = useAppStore((s) => s.profile);
  const hydrated = useAppStore((s) => s.hydrated);
  const loginError = useAuthStore((s) => s.loginError);
  const isOnboarded = isLoggedIn && profile !== null;

  const [modal, setModal] = useState<GateModal>("none");
  const triggerRef = useRef<HTMLElement | null>(null);

  // 실제 Google 로그인은 전체 페이지 리다이렉트로 완료되기 때문에(콜백 prop을
  // 불러줄 컴포넌트가 그 순간 없다), 개발자 임시 로그인용 handleLoginSucceeded
  // 콜백 체인과는 별개로 이 효과가 "상태 자체의 변화"를 구독해 반응한다.
  //
  // - hydrated를 함께 확인하는 이유: isLoggedIn이 true가 되는 시점에 그
  //   계정의 저장된 profile이 아직 복원되기 전이면 profile이 잠깐 null로
  //   보여, 기존 사용자에게도 프로필 생성 화면이 깜빡 뜰 수 있다. hydrated는
  //   lib/store.ts의 switchAccountStorage()가 그 계정 키로의 rehydrate를
  //   끝낸 뒤에만 true가 되므로(app/providers.tsx의 onFinishHydration), 이
  //   조건이 있어야 "복원된 뒤의 진짜 profile 값"으로만 판단하게 된다.
  // - modal은 의도적으로 의존성에서 뺐다 — 사용자가 ESC/바깥 클릭으로 직접
  //   닫아 modal이 "none"으로 바뀌어도 isLoggedIn/hydrated/profile/loginError
  //   자체는 안 바뀌었으니 이 효과가 다시 실행되지 않고, 그래서 닫자마자
  //   바로 재오픈되지 않는다.
  useEffect(() => {
    // 이 효과는 로컬 UI 상태가 아니라 Supabase/authSync가 비동기로 갱신하는
    // 외부 인증 상태를 반영하는 용도다 — react-hooks 규칙이 기본적으로
    // 권장하는 "렌더 중 계산"으로는 표현할 수 없다(로그인은 이 컴포넌트
    // 트리 바깥, 페이지 리다이렉트 이후에 완료된다).
    if (loginError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModal("login");
      return;
    }
    if (isLoggedIn && hydrated && profile === null) {
      setModal("profile");
    }
  }, [isLoggedIn, hydrated, profile, loginError]);

  const closeAndRestoreFocus = useCallback(() => {
    setModal("none");
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  // 이미 로그인 + 프로필 설정까지 끝났으면 아무것도 하지 않고, 아니라면 둘 중
  // 아직 안 끝난 단계(로그인 → 프로필 설정 순서)를 연다.
  const open = useCallback((options: OpenOptions = {}) => {
    const loggedIn = useAuthStore.getState().isLoggedIn;
    const hasProfile = useAppStore.getState().profile !== null;
    if (loggedIn && hasProfile) return;

    const active = document.activeElement;
    triggerRef.current =
      options.restoreFocus === false ? null : active instanceof HTMLElement ? active : null;
    setModal(loggedIn ? "profile" : "login");
  }, []);

  // ESC/바깥 클릭/X — 저장 없이 그냥 닫는다. 로그인 필요 기능은 실행되지
  // 않고, 프로필이 비어 있으면 비어 있는 채로 남아 다음에 다시 뜬다.
  const dismiss = useCallback(() => {
    closeAndRestoreFocus();
  }, [closeAndRestoreFocus]);

  // open()과 달리 "이미 로그인+프로필 완료" 상태를 막지 않는다 — 계정 메뉴의
  // "프로필 수정하기"가 호출하는 유일한 경로.
  const openProfileEdit = useCallback(() => {
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;
    setModal("profile");
  }, []);

  // 로그인 성공(지금은 개발용 버튼만 가능) — 프로필이 아직 없는 최초 가입자라면
  // 곧바로 프로필 설정 팝업으로 이어지고, 이미 프로필이 있는 기존 회원이라면
  // 그대로 닫힌다.
  const handleLoginSucceeded = useCallback(() => {
    if (useAppStore.getState().profile === null) {
      setModal("profile");
    } else {
      closeAndRestoreFocus();
    }
  }, [closeAndRestoreFocus]);

  const handleProfileCompleted = useCallback(() => {
    closeAndRestoreFocus();
  }, [closeAndRestoreFocus]);

  const requireLogin = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see RequireLogin's own note above.
    function requireLogin<T extends (...args: any[]) => unknown>(fn: T) {
      return (...args: Parameters<T>): ReturnType<T> | undefined => {
        const loggedIn = useAuthStore.getState().isLoggedIn;
        const hasProfile = useAppStore.getState().profile !== null;
        if (loggedIn && hasProfile) {
          return fn(...args) as ReturnType<T>;
        }
        open();
        return undefined;
      };
    },
    [open]
  );

  return (
    <LoginGateContext.Provider value={{ isOnboarded, open, requireLogin, openProfileEdit }}>
      {children}
      <LoginModal open={modal === "login"} onDismiss={dismiss} onLoginSucceeded={handleLoginSucceeded} />
      <ProfileSetupModal
        open={modal === "profile"}
        onDismiss={dismiss}
        onComplete={handleProfileCompleted}
      />
    </LoginGateContext.Provider>
  );
}

export function useLoginGate() {
  const ctx = useContext(LoginGateContext);
  if (!ctx) throw new Error("useLoginGate must be used within LoginGateProvider");
  return ctx;
}

/** 로그인 + 프로필 설정까지 끝난 상태면 즉시 실행, 아니면 필요한 단계의
 *  팝업만 열고 원래 동작은 실행하지 않는다. */
export function useRequireLogin() {
  return useLoginGate().requireLogin;
}
