"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical } from "lucide-react";

import { useAuthStore } from "@/lib/auth";

import { useLoginGate } from "./LoginGateProvider";

// components/auth/AccountMenu.tsx와 같은 포탈/위치 계산 방식 — SideNav
// 프로필 블록이 사이드바 맨 아래 고정이라 항상 트리거 위쪽으로 연다.
const MENU_GAP_PX = 8;
const MENU_HEIGHT_ESTIMATE_PX = 80; // p-[6px]×2 + 2 × h-[34px] items, no gap between
const VIEWPORT_MARGIN_PX = 8;

function computeMenuPosition(triggerEl: HTMLElement): { top: number; right: number } {
  const rect = triggerEl.getBoundingClientRect();
  const top = Math.max(VIEWPORT_MARGIN_PX, rect.top - MENU_GAP_PX - MENU_HEIGHT_ESTIMATE_PX);
  const right = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - rect.right);
  return { top, right };
}

function GuestAccountMenuPortal({
  top,
  right,
  registerRef,
  onLoginClick,
  onExitClick,
}: {
  top: number;
  right: number;
  registerRef: (el: HTMLDivElement | null) => void;
  onLoginClick: () => void;
  onExitClick: () => void;
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
        onClick={onLoginClick}
        className="flex h-[34px] min-w-[150px] items-center rounded-[6px] px-3 text-left text-[13px] text-foreground transition hover:bg-foreground/5"
      >
        Google로 로그인
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onExitClick}
        className="flex h-[34px] min-w-[150px] items-center rounded-[6px] px-3 text-left text-[13px] text-foreground transition hover:bg-foreground/5"
      >
        체험 종료하기
      </button>
    </div>,
    document.body
  );
}

// SideNav 하단 게스트 행의 "더보기(⋮)" 메뉴. 로그인 없이 체험 중인
// 사용자에게만 렌더링된다(components/layout/SideNav.tsx). "Google로
// 로그인"은 guestMode를 유지한 채 기존 LoginModal을 그대로 열고(데이터가
// 이어지지 않는다는 경고가 함께 보인다), "체험 종료하기"는 guestMode만
// 내리고 같은 LoginModal을 연다 — 지인 UT는 각자 PC에서 진행돼 데이터
// 초기화가 필요 없으므로, modo-storage:guest의 목표/할 일/회고는 전혀
// 건드리지 않는다. 나중에 "로그인 없이 체험하기"를 다시 누르면 그대로
// 이어서 쓸 수 있다.
export function GuestAccountMenu() {
  const { open } = useLoginGate();
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function handleScroll() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuOpen]);

  function handleToggle() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const triggerEl = buttonRef.current;
    setMenuPosition(triggerEl ? computeMenuPosition(triggerEl) : null);
    setMenuOpen(true);
  }

  function handleLoginClick() {
    setMenuOpen(false);
    open();
  }

  function handleExitClick() {
    setMenuOpen(false);
    exitGuestMode();
    open();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="게스트 메뉴"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-muted transition hover:bg-foreground/5 hover:text-foreground"
      >
        <EllipsisVertical size={16} />
      </button>
      {menuOpen && menuPosition && (
        <GuestAccountMenuPortal
          top={menuPosition.top}
          right={menuPosition.right}
          registerRef={(el) => {
            panelRef.current = el;
          }}
          onLoginClick={handleLoginClick}
          onExitClick={handleExitClick}
        />
      )}
    </>
  );
}
