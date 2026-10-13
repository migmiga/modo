"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical } from "lucide-react";

import { useAuthStore } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

import { useLoginGate } from "./LoginGateProvider";

// SideNav 프로필 블록은 사이드바 맨 아래(mt-auto)에 고정돼 있어, 이 메뉴는
// 항상 트리거 위쪽으로 연다 — TodayTaskList.tsx의 TaskMenuPortal과 같은
// "포탈 + fixed 위치" 방식을 그대로 가져와, SideNav 자체에는 overflow 제한이
// 없지만 혹시라도 생길 경계에 잘리지 않게 한다.
const MENU_GAP_PX = 8;
const MENU_HEIGHT_ESTIMATE_PX = 80; // p-[6px]×2 + 2 × h-[34px] items, no gap between
const VIEWPORT_MARGIN_PX = 8;

function computeMenuPosition(triggerEl: HTMLElement): { top: number; right: number } {
  const rect = triggerEl.getBoundingClientRect();
  const top = Math.max(VIEWPORT_MARGIN_PX, rect.top - MENU_GAP_PX - MENU_HEIGHT_ESTIMATE_PX);
  const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - rect.right);
  return { top, right };
}

function AccountMenuPortal({
  top,
  right,
  registerRef,
  onEditProfile,
  onLogout,
  isSigningOut,
  logoutError,
}: {
  top: number;
  right: number;
  registerRef: (el: HTMLDivElement | null) => void;
  onEditProfile: () => void;
  onLogout: () => void;
  isSigningOut: boolean;
  logoutError: string | null;
}) {
  return createPortal(
    <div
      ref={registerRef}
      role="menu"
      className="fixed z-50 flex flex-col whitespace-nowrap rounded-[12px] border border-border bg-surface p-[6px] shadow-pop"
      style={{ top: `${top}px`, right: `${right}px` }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={onEditProfile}
        className="flex h-[34px] min-w-[150px] items-center rounded-[6px] px-3 text-left text-[13px] text-foreground transition hover:bg-foreground/5"
      >
        프로필 수정하기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onLogout}
        disabled={isSigningOut}
        // 삭제 버튼(archive 선택 모드) 등 기존 UI에서 쓰는 '진짜 빨강'
        // #DC2626 — text-danger(이 디자인 시스템의 danger 토큰)는 실제로는
        // Tangerine(주황)이라 요청한 "빨간색"과 다르다.
        className="flex h-[34px] min-w-[150px] items-center rounded-[6px] px-3 text-left text-[13px] text-[#DC2626] transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSigningOut ? "로그아웃 중..." : "로그아웃하기"}
      </button>
      {logoutError && <p className="px-3 pt-1 text-[11px] text-[#DC2626]">{logoutError}</p>}
    </div>,
    document.body
  );
}

// SideNav 하단 프로필 영역의 "더보기(⋮)" 계정 메뉴. 프로필 수정은
// LoginGateProvider.openProfileEdit()로 기존 ProfileSetupModal을 그대로
// 열고, 로그아웃은 기존 Supabase signOut만 호출한다 — 계정별 저장소 전환/
// Amplitude identity 초기화는 lib/authSync.ts의 onAuthStateChange 구독이
// 이미 처리하므로 여기서 다시 하지 않는다.
export function AccountMenu() {
  const provider = useAuthStore((s) => s.provider);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { openProfileEdit } = useLoginGate();

  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // ExecutionTimeline/TodayTaskList와 같은 이유로, 리포지셔닝 대신 스크롤
    // 발생 시 그냥 닫는다 — fixed 위치 메뉴가 트리거에서 떨어져 나가는 것을
    // 막는 가장 단순한 방법.
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const triggerEl = buttonRef.current;
    setMenuPosition(triggerEl ? computeMenuPosition(triggerEl) : null);
    setLogoutError(null);
    setOpen(true);
  }

  function handleEditProfile() {
    setOpen(false);
    openProfileEdit();
  }

  async function handleLogout() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setLogoutError(null);
    try {
      if (provider === "google" && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // 성공하면 lib/authSync.ts의 onAuthStateChange가 게스트 저장소 전환 +
        // clearSession + Amplitude identity 초기화를 처리한다.
      } else {
        // 개발용 임시 로그인(provider: "dev") — 실제 Supabase 세션이 없어
        // signOut()이 아무 효과도 없다. 로컬 로그인 상태만 직접 지운다.
        clearSession();
      }
      setOpen(false);
    } catch {
      setLogoutError("로그아웃에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="계정 메뉴"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-muted transition hover:bg-foreground/5 hover:text-foreground"
      >
        <EllipsisVertical size={16} />
      </button>
      {open && menuPosition && (
        <AccountMenuPortal
          top={menuPosition.top}
          right={menuPosition.right}
          registerRef={(el) => {
            panelRef.current = el;
          }}
          onEditProfile={handleEditProfile}
          onLogout={handleLogout}
          isSigningOut={isSigningOut}
          logoutError={logoutError}
        />
      )}
    </>
  );
}
