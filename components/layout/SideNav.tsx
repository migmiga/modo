"use client";

import {
  IconArchive,
  IconArchiveFilled,
  IconLayoutDashboard,
  IconLayoutDashboardFilled,
  IconSquareAsterisk,
  IconSquareAsteriskFilled,
  type TablerIcon,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { FIELD_OPTIONS, OCCUPATION_OPTIONS, PROFILE_STATUS_OPTIONS } from "@/lib/constants";
import { useAppStore } from "@/lib/store";

// Component references (not pre-rendered elements) — which one to render
// depends on `active`, decided at render time in the map() below.
const NAV_ITEMS: {
  href: string;
  IconOutline: TablerIcon;
  IconFilled: TablerIcon;
  label: string;
  isActive: (p: string) => boolean;
}[] = [
  {
    // AI 플래너가 기본 진입 경로(/)로 옮겨갔다 — /goals/new는 이제 /로
    // 리다이렉트되는 셸이지만, 혹시 그 경로가 잠깐이라도 보이는 순간에도
    // 같은 탭이 활성 표시되도록 isActive에 그대로 남겨둔다.
    href: "/",
    IconOutline: IconSquareAsterisk,
    IconFilled: IconSquareAsteriskFilled,
    label: "AI 플래너",
    isActive: (p) => p === "/" || p.startsWith("/goals"),
  },
  {
    href: "/dashboard",
    IconOutline: IconLayoutDashboard,
    IconFilled: IconLayoutDashboardFilled,
    label: "대시보드",
    isActive: (p) => p === "/dashboard" || p.startsWith("/plan") || p.startsWith("/replan"),
  },
  {
    href: "/archive",
    IconOutline: IconArchive,
    IconFilled: IconArchiveFilled,
    label: "보관함",
    isActive: (p) => p.startsWith("/archive"),
  },
];

export function SideNav() {
  const pathname = usePathname();
  const hydrated = useAppStore((s) => s.hydrated);
  const profile = useAppStore((s) => s.profile);

  if (!hydrated) return null;

  // 신규 가입 흐름이 저장하는 field/occupation을 우선 쓰고, 이전 버전
  // 온보딩(status/job_role)으로 가입한 기존 사용자는 그 값으로 폴백한다 —
  // 둘 다 없을 수도 있어(예: 레거시 프로필) 최종적으로는 빈 문자열.
  const fieldLabel = profile
    ? FIELD_OPTIONS.find((opt) => opt.value === profile.field)?.label ?? profile.job_role ?? ""
    : "";
  const occupationLabel = profile
    ? OCCUPATION_OPTIONS.find((opt) => opt.value === profile.occupation)?.label ??
      PROFILE_STATUS_OPTIONS.find((opt) => opt.value === profile.status)?.label ??
      ""
    : "";
  const nickname = profile?.nickname || "모디";

  return (
    <nav
      data-ld="sidenav"
      className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-[300px] lg:flex-col lg:border-r lg:border-border lg:bg-surface"
    >
      <div className="flex h-16 shrink-0 items-center px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: a
            static SVG wordmark needs no next/image optimization, and avoids
            the next.config SVG allowlist that component would require. */}
        <img src="/images/modo-logo.svg" alt="MODO" width={169} height={40} className="h-7 w-auto" />
      </div>

      <div className="flex flex-col gap-2 px-5">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          // Hover never switches this — `active` only reflects the current
          // route (item.isActive(pathname)), not :hover, so a hovered-but-
          // not-selected item always stays on IconOutline.
          const Icon = active ? item.IconFilled : item.IconOutline;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-btn px-3.5 py-3 text-sm font-medium transition",
                active ? "bg-accent/10 text-accent" : "text-muted hover:bg-accent/5 hover:text-foreground"
              )}
            >
              {/* currentColor by default, so the icon — outline or filled —
                  picks up the same active/inactive text color as the label. */}
              <span className="w-4 text-center">
                <Icon size={16} stroke={1.75} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* 비로그인/프로필 미완료 상태에서는 사이드바 자체는 그대로 보여주고,
          이 하단 블록만 생략한다 — 로그인 없이도 탭 이동이 가능해야 한다. */}
      {profile && (
      <div className="mt-auto border-t border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-medium text-accent">
            {nickname.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{nickname}</p>
            <p className="truncate text-xs text-muted">
              {[fieldLabel, occupationLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>
      )}
    </nav>
  );
}
