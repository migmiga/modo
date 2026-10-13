"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useAuthStore } from "@/lib/auth";
import { setEntryMethod, trackGuestStarted } from "@/lib/analytics";

import { GoogleLoginButton } from "./GoogleLoginButton";
import { KakaoLoginButton } from "./KakaoLoginButton";

const LOGO_SYMBOL_SRC = "/images/Log in - logo.svg";
const LOGO_TEXT_SRC = "/images/Log in - Logo Text.svg";
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function LoginModal({
  open,
  onDismiss,
  onLoginSucceeded,
  onGuestStart,
}: {
  open: boolean;
  /** ESC/바깥 클릭/X — 저장 없이 그냥 닫기. */
  onDismiss: () => void;
  /** 로그인 성공(지금은 개발용 버튼) — 프로필 없으면 설정 팝업으로 이어진다. */
  onLoginSucceeded: () => void;
  /** "로그인 없이 체험하기" 클릭 — guestMode 전환/분석 이벤트는 이 컴포넌트가
   *  직접 처리하고, 호출부(LoginGateProvider)는 팝업만 닫는다. */
  onGuestStart: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const setDevLoggedIn = useAuthStore((s) => s.setDevLoggedIn);
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  const guestMode = useAuthStore((s) => s.guestMode);
  const loginError = useAuthStore((s) => s.loginError);
  const clearLoginError = useAuthStore((s) => s.clearLoginError);

  // "로그인 없이 체험하기" 버튼 클릭 — guestMode 전환, entry_method 속성,
  // guest_started 이벤트까지 한 곳에서 처리한다. 단, 이미 guestMode인
  // 사용자가(예: 체험 중 "Google로 로그인"을 눌러 이 팝업을 다시 열었다가
  // 마음을 바꿔 이 버튼을 또 누르는 경우) 다시 눌러도 entry_method/
  // guest_started를 중복으로 쏘지 않는다 — "최초 선택"이 아니라 "체험
  // 계속하기"일 뿐이다.
  function handleGuestStart() {
    if (!guestMode) {
      setEntryMethod("guest");
      trackGuestStarted();
    }
    enterGuestMode();
    onGuestStart();
  }

  // 외부에서 받은 onDismiss(ESC/바깥 클릭/X 전부 이걸로 모인다)는 그대로
  // 호출하면서, 이 모달이 닫힐 때 안내 문구도 같이 지운다 — 다음에 열렸을 때
  // 지난번 실패 메시지가 남아있지 않게. 아래 effect가 의존성으로 참조하므로
  // useCallback으로 고정한다.
  const handleDismiss = useCallback(() => {
    clearLoginError();
    onDismiss();
  }, [clearLoginError, onDismiss]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    card?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleDismiss();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleDismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
      onMouseDown={handleDismiss}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="로그인"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex min-h-[371px] w-[384px] max-w-[calc(100vw-40px)] flex-col items-center rounded-[24px] bg-white px-6 pt-9 pb-7"
      >
        {/* 심볼 + 워드마크를 세로로 묶은 로고 그룹. 둘 다 순수 벡터 SVG를 원본
            크기(48x48 / 67x21) 그대로 렌더링 — 리사이즈하면 번질 수 있어 하지
            않는다. 심볼은 장식용(alt=""), 워드마크 쪽에만 "MODO" 대체 텍스트를
            둬서 스크린리더가 두 번 읽지 않게 한다. */}
        <div className="flex flex-col items-center gap-[10px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG, SideNav.tsx 로고와 같은 방식(plain img). */}
          <img src={LOGO_SYMBOL_SRC} alt="" width={48} height={48} />
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG, SideNav.tsx 로고와 같은 방식(plain img). */}
          <img src={LOGO_TEXT_SRC} alt="MODO" width={67} height={21} />
        </div>

        {/* "Log in" 구분선 — 로고 그룹에서 48px, 아래 Google 버튼과는 16px. */}
        <div className="mt-12 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-[#F5F5F5]" />
          <span className="text-sm text-black">Log in</span>
          <div className="h-px flex-1 bg-[#F5F5F5]" />
        </div>

        <div className="mt-4 flex w-full flex-col gap-2">
          <GoogleLoginButton />
          <KakaoLoginButton />
        </div>

        {/* 이미 체험 중인 게스트가 이 팝업을 다시 열어 실제 로그인을 시도하는
            경우에만 보여준다 — 최초 선택 시점(guestMode 아직 false)에는 잃을
            체험 데이터가 없으니 불필요한 경고다. */}
        {guestMode && (
          <p className="mt-3 text-center text-xs text-muted">
            로그인하면 지금까지의 체험 데이터는 이어지지 않아요
          </p>
        )}

        {/* Google 동의 화면에서 취소하거나 리다이렉트가 실패해 돌아온 경우의
            안내 — lib/authSync.ts가 URL의 error 쿼리를 보고 채운다. */}
        {loginError && (
          <p className="mt-3 text-center text-xs text-[#DC2626]">{loginError}</p>
        )}

        {/* "Log in" 구분선과 같은 톤의 구분선 — 로그인 버튼군과 체험 경로를
            시각적으로 분리한다. */}
        <div className="mt-5 flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-[#F5F5F5]" />
          <span className="text-sm text-black">또는</span>
          <div className="h-px flex-1 bg-[#F5F5F5]" />
        </div>

        <button type="button" onClick={handleGuestStart} className="mt-4 text-sm font-medium text-muted underline">
          로그인 없이 체험하기
        </button>

        <p className="mt-7 text-center text-xs text-[#D4D4D4]">
          로그인 시 서비스 이용약관에 동의하게 됩니다
        </p>

        {/* 운영 디자인(371px)과 분리된, 개발 환경 전용 영역 — 실제 서비스
            화면에는 없는 임시 테스트 기능이라 일반 플로우에 쌓는 블록으로
            따로 두고(absolute 아님), 조건부 렌더링이라 운영 빌드에는 이
            블록 자체가 DOM에 없어 높이·여백이 전혀 남지 않는다. 카드 높이는
            min-h-[371px]라 이 블록이 더해진 만큼 자연히 늘어난다. */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-6 w-full border-t border-[#F5F5F5] pt-4 text-center">
            <p className="text-[11px] font-medium text-muted">개발자 전용</p>
            <button
              type="button"
              onClick={() => {
                setDevLoggedIn();
                onLoginSucceeded();
              }}
              className="mt-1 text-[11px] text-muted underline"
            >
              임시로 로그인 처리(개발용)
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
