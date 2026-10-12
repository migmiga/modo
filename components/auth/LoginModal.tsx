"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useAuthStore } from "@/lib/auth";

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
}: {
  open: boolean;
  /** ESC/바깥 클릭/X — 저장 없이 그냥 닫기. */
  onDismiss: () => void;
  /** 로그인 성공(지금은 개발용 버튼) — 프로필 없으면 설정 팝업으로 이어진다. */
  onLoginSucceeded: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const setDevLoggedIn = useAuthStore((s) => s.setDevLoggedIn);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    card?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
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
  }, [open, onDismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
      onMouseDown={onDismiss}
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
