"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "@tabler/icons-react";

import { cn } from "@/lib/cn";

export interface FieldDropdownOption {
  value: string;
  label: string;
}

// components/home/ExecutionTimeline.tsx의 FilterDropdown과 같은 룩(라운드,
// 그림자, 선택 색상, 패딩, 키보드 동작)을 쓰지만, 그 컴포넌트는 그대로 둔다 —
// 필터 바/보관함 정렬에서 이미 쓰이고 있어 건드리면 그 화면들에 영향이 간다.
// 이 컴포넌트는 폼 필드(분야/직종 등)용으로 트리거만 Input/Select 크기로 다시
// 그리고, 패널을 document.body에 포탈로 그려 모달의 overflow-y-auto 경계에
// 잘리지 않게 한다(TodayTaskList.tsx의 TaskMenuPortal과 같은 접근).
const PANEL_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

interface PanelPosition {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

function computePanelPosition(triggerEl: HTMLElement, panelHeight: number): PanelPosition {
  const rect = triggerEl.getBoundingClientRect();
  const openUpward = rect.bottom + PANEL_GAP_PX + panelHeight > window.innerHeight;
  const top = openUpward ? rect.top - PANEL_GAP_PX - panelHeight : rect.bottom + PANEL_GAP_PX;
  const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rect.left, window.innerWidth - rect.width - VIEWPORT_MARGIN_PX));
  return { top, left, width: rect.width, openUpward };
}

export function FieldDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
}: {
  value: string;
  options: FieldDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value) ?? null;

  function openDropdown() {
    setHighlightedIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function closeDropdown(refocusButton: boolean) {
    setOpen(false);
    if (refocusButton) buttonRef.current?.focus();
  }

  // 패널의 실제 렌더 높이를 보고 위/아래를 정하고(아래로 먼저 그려본 뒤 필요하면
  // 보정), 선택된 항목을 바로 보이게 스크롤한다 — FilterDropdown과 동일한 순서.
  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    const panel = listRef.current;
    if (!btn || !panel) return;
    setPosition(computePanelPosition(btn, panel.getBoundingClientRect().height));
    const items = panel.querySelectorAll('[role="option"]');
    const selectedIndex = options.findIndex((o) => o.value === value);
    items[selectedIndex >= 0 ? selectedIndex : 0]?.scrollIntoView({ block: "nearest" });
  }, [open, options, value]);

  // 연 상태에서 모달 내부 스크롤이나 창 크기 변경이 있으면 트리거 위치를 다시
  // 계산한다 — 패널이 트리거와 다른 DOM 위치(document.body)에 있어 저절로
  // 따라가지 않으므로 직접 갱신해야 한다.
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const btn = buttonRef.current;
      const panel = listRef.current;
      if (!btn || !panel) return;
      setPosition(computePanelPosition(btn, panel.getBoundingClientRect().height));
    }
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlightedIndex];
      if (opt) {
        onChange(opt.value);
        closeDropdown(true);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeDropdown(false) : openDropdown())}
        className="flex h-11 w-full items-center justify-between rounded-input border border-ash bg-surface px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
      >
        <span className={cn("min-w-0 truncate", !selectedOption && "text-muted")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <IconChevronDown size={16} stroke={1.75} className="ml-2 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            // z-[70] — 로그인/프로필 팝업의 딤드 오버레이(z-[60])보다 위.
            className="fixed z-[70] max-h-[240px] overflow-y-auto rounded-[8px] border border-ash bg-surface p-1 shadow-pop outline-none"
            style={
              position
                ? { top: position.top, left: position.left, width: position.width }
                : { top: -9999, left: -9999, width: 0 }
            }
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const stateClassName = isSelected
                ? "bg-[#EFF6FF] font-medium text-accent"
                : i === highlightedIndex
                  ? "bg-paper-mist text-foreground"
                  : "text-foreground";
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onClick={() => {
                    onChange(opt.value);
                    closeDropdown(true);
                  }}
                  className={cn(
                    "cursor-pointer whitespace-nowrap rounded-[6px] px-3 py-1.5 text-sm transition",
                    stateClassName
                  )}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
