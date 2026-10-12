"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconSearch, IconTrash } from "@tabler/icons-react";

import { ArchiveCard } from "@/components/archive/ArchiveCard";
import { ArchiveDetailModal } from "@/components/archive/ArchiveDetailModal";
import { ArchiveEmptyState } from "@/components/archive/ArchiveEmptyState";
import { useRequireLogin } from "@/components/auth/LoginGateProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { FilterDropdown } from "@/components/home/ExecutionTimeline";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { cn } from "@/lib/cn";
import { afterLayoutSettles, logPageAudit } from "@/lib/debugLayout";
import { calcProgress } from "@/lib/progress";
import { useAppStore } from "@/lib/store";

type SortKey = "recent_created" | "oldest_created" | "progress_desc" | "progress_asc";
type TabKey = "all" | "favorites" | "completed" | "incomplete";

const SORT_OPTIONS_ALL: { value: SortKey; label: string }[] = [
  { value: "recent_created", label: "최신 순" },
  { value: "oldest_created", label: "과거 순" },
  { value: "progress_desc", label: "높은 순" },
  { value: "progress_asc", label: "낮은 순" },
];

// 완료 탭은 모두 진행률 100%이므로 진행률 정렬이 의미가 없어 제외한다.
const SORT_OPTIONS_COMPLETED: { value: SortKey; label: string }[] = SORT_OPTIONS_ALL.filter(
  (opt) => opt.value === "recent_created" || opt.value === "oldest_created"
);

function sortOptionsForTab(tab: TabKey) {
  return tab === "completed" ? SORT_OPTIONS_COMPLETED : SORT_OPTIONS_ALL;
}

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "favorites", label: "즐겨찾기" },
  { value: "completed", label: "완료" },
  { value: "incomplete", label: "미완료" },
];

const TAB_EMPTY_COPY: Record<
  Exclude<TabKey, "all">,
  { title: string; description: string; showCta?: boolean }
> = {
  favorites: {
    title: "아직 즐겨찾기한 계획이 없어요.",
    description: "자주 확인하고 싶은 계획의 ☆을 눌러보세요.",
  },
  completed: {
    title: "아직 완료한 계획이 없어요.",
    description: "계획을 끝까지 진행하면 이곳에 표시돼요.",
  },
  incomplete: {
    title: "진행 중인 계획이 없어요.",
    description: "새로운 목표를 계획해보세요.",
    showCta: true,
  },
};

const FAVORITE_LIMIT_MESSAGE = "즐겨찾기는 최대 5개까지 등록할 수 있어요. 기존 즐겨찾기를 해제해주세요.";
const FAVORITE_NOTICE_DURATION_MS = 3000;

export default function ArchivePage() {
  const router = useRouter();
  const pathname = usePathname();
  const requireLogin = useRequireLogin();
  const hydrated = useAppStore((s) => s.hydrated);
  const archivedPlans = useAppStore((s) => s.archivedPlans);
  const favoriteArchiveIds = useAppStore((s) => s.favoriteArchiveIds);
  const archiveSeeded = useAppStore((s) => s.archiveSeeded);
  const ensureArchiveSeed = useAppStore((s) => s.ensureArchiveSeed);
  const toggleFavoriteArchive = useAppStore((s) => s.toggleFavoriteArchive);
  const deleteArchivedPlans = useAppStore((s) => s.deleteArchivedPlans);
  const setReferenceGoalDraft = useAppStore((s) => s.setReferenceGoalDraft);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent_created");
  const [tab, setTab] = useState<TabKey>("all");
  const [openArchiveId, setOpenArchiveId] = useState<string | null>(null);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const favoriteNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    ensureArchiveSeed();
  }, [hydrated, ensureArchiveSeed]);

  // TEMPORARY layout-debug instrumentation — see lib/debugLayout.ts.
  useEffect(() => {
    if (!hydrated || !archiveSeeded) return;
    afterLayoutSettles(() => logPageAudit(pathname));
  }, [hydrated, archiveSeeded, pathname]);

  useEffect(() => {
    return () => {
      if (favoriteNoticeTimeoutRef.current) clearTimeout(favoriteNoticeTimeoutRef.current);
    };
  }, []);

  function handleToggleFavorite(archiveId: string) {
    const result = requireLogin(toggleFavoriteArchive)(archiveId);
    if (result === undefined) return;
    if (favoriteNoticeTimeoutRef.current) clearTimeout(favoriteNoticeTimeoutRef.current);
    if (result === "limit_reached") {
      setFavoriteNotice(FAVORITE_LIMIT_MESSAGE);
      favoriteNoticeTimeoutRef.current = setTimeout(
        () => setFavoriteNotice(null),
        FAVORITE_NOTICE_DURATION_MS
      );
    } else {
      setFavoriteNotice(null);
    }
  }

  function handleUseAsReference() {
    if (openPlan) {
      setReferenceGoalDraft({
        title: openPlan.goal.title,
        contextText: openPlan.goal.context_text,
      });
    }
    setOpenArchiveId(null);
    router.push("/");
  }

  function handleTabChange(next: TabKey) {
    setTab(next);
    if (next === "completed" && (sort === "progress_desc" || sort === "progress_asc")) {
      setSort("recent_created");
    }
  }

  function handleEnterDeleteMode() {
    setIsDeleteMode(true);
    setSelectedIds([]);
  }

  function handleCancelDeleteMode() {
    setIsDeleteMode(false);
    setSelectedIds([]);
  }

  function handleToggleSelected(archiveId: string) {
    setSelectedIds((prev) =>
      prev.includes(archiveId) ? prev.filter((id) => id !== archiveId) : [...prev, archiveId]
    );
  }

  function handleConfirmDelete() {
    deleteArchivedPlans(selectedIds);
    setIsConfirmOpen(false);
    setIsDeleteMode(false);
    setSelectedIds([]);
  }

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "favorites":
        return archivedPlans.filter((p) => favoriteArchiveIds.includes(p.archive_id));
      case "completed":
        return archivedPlans.filter((p) => calcProgress(p.tasks) === 100);
      case "incomplete":
        return archivedPlans.filter((p) => calcProgress(p.tasks) < 100);
      default:
        return archivedPlans;
    }
  }, [archivedPlans, favoriteArchiveIds, tab]);

  const filteredSorted = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = trimmed
      ? tabFiltered.filter((p) => p.goal.title.toLowerCase().includes(trimmed))
      : tabFiltered;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "recent_created":
          return b.created_at.localeCompare(a.created_at);
        case "oldest_created":
          return a.created_at.localeCompare(b.created_at);
        case "progress_desc":
          return calcProgress(b.tasks) - calcProgress(a.tasks);
        case "progress_asc":
          return calcProgress(a.tasks) - calcProgress(b.tasks);
      }
    });
  }, [tabFiltered, query, sort]);

  const openPlan = archivedPlans.find((p) => p.archive_id === openArchiveId) ?? null;

  if (!hydrated || !archiveSeeded) {
    return <LoadingScreen />;
  }

  const isArchiveEmpty = archivedPlans.length === 0;
  const isTabEmpty = !isArchiveEmpty && tabFiltered.length === 0;
  const hasNoSearchMatch = !isArchiveEmpty && !isTabEmpty && filteredSorted.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-5 py-8 lg:px-10 lg:py-12">
      <AppHeader
        breadcrumb={[{ label: "보관함" }]}
        action={
          <Button variant="header" size="sm">
            도움말
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 data-ld="page-title" className="shrink-0 whitespace-nowrap font-heading text-heading-sm font-medium text-foreground">보관함</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <IconSearch
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="계획 검색"
              borderClassName="border border-border"
              className="w-full pl-[38px]"
            />
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded-btn bg-accent-strong px-4 py-3 text-sm font-medium text-accent-foreground transition hover:brightness-95 active:scale-[0.98] active:brightness-90"
          >
            + 새 계획
          </Link>
        </div>
      </div>

      <div data-ld="page-body">
      {isArchiveEmpty ? (
        <ArchiveEmptyState
          title="아직 저장된 계획이 없어요."
          description="목표를 입력하고 첫 계획을 만들어보세요."
          showCta
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTabChange(t.value)}
                aria-pressed={tab === t.value}
                className={cn(
                  "flex h-9 shrink-0 items-center justify-center rounded-badge px-4 text-sm font-medium transition",
                  tab === t.value
                    ? "bg-accent-strong text-accent-foreground"
                    : "border border-border bg-surface text-foreground hover:bg-accent/5"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {favoriteNotice && <p className="text-xs text-danger">{favoriteNotice}</p>}

          <div className="flex flex-col gap-3">
            {isDeleteMode ? (
              <div className="flex h-8 items-center justify-between">
                <p className="text-sm font-medium text-foreground">{selectedIds.length}개 선택</p>
                <div className="flex items-center gap-2">
                  <Button variant="header" size="sm" onClick={handleCancelDeleteMode}>
                    취소
                  </Button>
                  <Button
                    variant="dangerSolid"
                    size="sm"
                    disabled={selectedIds.length === 0}
                    onClick={() => setIsConfirmOpen(true)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-8 items-center justify-between">
                <p className="text-sm text-muted">계획 {filteredSorted.length}개</p>
                <div className="flex items-center gap-2">
                  <FilterDropdown
                    value={sort}
                    onChange={(v) => setSort(v as SortKey)}
                    ariaLabel="정렬 필터"
                    buttonClassName="w-[92px]"
                    options={sortOptionsForTab(tab)}
                  />
                  <button
                    type="button"
                    onClick={handleEnterDeleteMode}
                    title="계획 삭제"
                    aria-label="계획 삭제"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-border bg-surface text-muted transition hover:bg-accent/5"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            )}

            {isTabEmpty ? (
              <ArchiveEmptyState {...TAB_EMPTY_COPY[tab as Exclude<TabKey, "all">]} />
            ) : hasNoSearchMatch ? (
              <p className="py-10 text-center text-sm text-muted">검색 결과가 없어요.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSorted.map((plan, i) => (
                  <ArchiveCard
                    key={plan.archive_id}
                    dataLd={i === 0 ? "card-archive" : undefined}
                    plan={plan}
                    isFavorite={favoriteArchiveIds.includes(plan.archive_id)}
                    onToggleFavorite={() => handleToggleFavorite(plan.archive_id)}
                    onOpenDetail={() => setOpenArchiveId(plan.archive_id)}
                    selectionMode={isDeleteMode}
                    selected={selectedIds.includes(plan.archive_id)}
                    onToggleSelected={() => handleToggleSelected(plan.archive_id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      <ArchiveDetailModal
        plan={openPlan}
        onClose={() => setOpenArchiveId(null)}
        onUseAsReference={requireLogin(handleUseAsReference)}
      />

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
            <div className="space-y-1">
              <h2 className="text-base font-medium">선택한 계획 {selectedIds.length}개를 삭제할까요?</h2>
              <p className="text-sm text-muted">삭제한 계획은 다시 복구할 수 없어요.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="header" onClick={() => setIsConfirmOpen(false)} className="flex-1">
                취소
              </Button>
              <Button variant="primary" onClick={requireLogin(handleConfirmDelete)} className="flex-1">
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
