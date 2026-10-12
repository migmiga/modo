"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
}

const BREADCRUMB_SLOT_ID = "app-header-breadcrumb-slot";
const ACTION_SLOT_ID = "app-header-action-slot";

type SetActiveCount = (updater: (count: number) => number) => void;

const ActiveCountContext = createContext(0);
const SetActiveCountContext = createContext<SetActiveCount | null>(null);

/**
 * Sidebar: 주요 메뉴 이동 / App Header: 현재 위치 + Page Action 으로 역할을 분리한다.
 * App Header를 사용하는 화면이 하나도 없으면 Header Bar는 0px로 접혀 다른 화면에 영향을 주지 않는다.
 */
export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  return (
    <SetActiveCountContext.Provider value={setActiveCount}>
      <ActiveCountContext.Provider value={activeCount}>{children}</ActiveCountContext.Provider>
    </SetActiveCountContext.Provider>
  );
}

export function AppHeaderBar() {
  const activeCount = useContext(ActiveCountContext);
  const active = activeCount > 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-10 overflow-hidden",
        active ? "h-16 border-b border-border bg-background/95 backdrop-blur-sm" : "h-0"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-5 lg:px-10">
        {/* 화면들이 breadcrumb/action을 Portal로 채우는 Slot. Id는 항상 렌더링되어 있어야
            AppHeader가 마운트되는 첫 렌더에서 바로 Target을 찾을 수 있다. */}
        <nav
          id={BREADCRUMB_SLOT_ID}
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted"
          aria-label="현재 위치"
        />
        <div id={ACTION_SLOT_ID} className="flex shrink-0 items-center gap-2" />
      </div>
    </header>
  );
}

function usePortalTarget(id: string) {
  const [el] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.getElementById(id)
  );
  return el;
}

function renderBreadcrumb(breadcrumb: BreadcrumbItem[]) {
  return (
    <>
      {breadcrumb.map((item, i) => {
        const isLast = i === breadcrumb.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && (
              <span className="text-border" aria-hidden="true">
                &gt;
              </span>
            )}
            <span className={isLast ? "truncate font-medium text-foreground" : "truncate"}>
              {item.label}
            </span>
          </span>
        );
      })}
    </>
  );
}

/**
 * 현재 화면의 위치(Breadcrumb)와 Page Action을 공통 App Header로 Portal한다.
 * Breadcrumb은 위치 안내 전용이며 뒤로가기 등 인터랙션을 담당하지 않는다 — 그 역할은 action으로 넘겨받는
 * 화면별 버튼(예: 취소/완료)이 맡는다.
 */
export function AppHeader({ breadcrumb, action }: { breadcrumb: BreadcrumbItem[]; action?: ReactNode }) {
  const setActiveCount = useContext(SetActiveCountContext);

  useEffect(() => {
    setActiveCount?.((n) => n + 1);
    return () => setActiveCount?.((n) => n - 1);
  }, [setActiveCount]);

  const breadcrumbTarget = usePortalTarget(BREADCRUMB_SLOT_ID);
  const actionTarget = usePortalTarget(ACTION_SLOT_ID);

  return (
    <>
      {breadcrumbTarget && createPortal(renderBreadcrumb(breadcrumb), breadcrumbTarget)}
      {actionTarget && action ? createPortal(action, actionTarget) : null}
    </>
  );
}
