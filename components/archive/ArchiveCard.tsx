"use client";

import { IconCheck, IconStar, IconStarFilled } from "@tabler/icons-react";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/cn";
import { formatDateRange } from "@/lib/dateUtils";
import { calcProgress } from "@/lib/progress";
import type { ArchivedPlan } from "@/lib/types";

export function ArchiveCard({
  plan,
  isFavorite,
  onToggleFavorite,
  onOpenDetail,
  selectionMode = false,
  selected = false,
  onToggleSelected,
  className,
  dataLd,
}: {
  plan: ArchivedPlan;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpenDetail: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  className?: string;
  /** TEMPORARY layout-debug hook — see lib/debugLayout.ts. */
  dataLd?: string;
}) {
  const progress = calcProgress(plan.tasks);
  const isCompleted = progress === 100;

  function handleActivate() {
    if (selectionMode) {
      onToggleSelected?.();
    } else {
      onOpenDetail();
    }
  }

  return (
    <Card
      dataLd={dataLd}
      onClick={handleActivate}
      className={cn("space-y-3", selectionMode && selected && "border-accent", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-badge bg-paper-mist px-2.5 py-1 text-[11px] font-medium text-steel">
            {plan.category}
          </span>
          {isCompleted && (
            <span className="rounded-badge bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
              완료
            </span>
          )}
        </div>
        {selectionMode ? (
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-input">
            <input
              type="checkbox"
              checked={selected}
              readOnly
              aria-label={selected ? "선택 해제" : "선택"}
              className={cn(
                "h-4 w-4 shrink-0 appearance-none rounded-input border transition",
                selected ? "border-accent bg-accent" : "border-border bg-surface"
              )}
            />
            {selected && (
              <IconCheck
                size={12}
                strokeWidth={3}
                aria-hidden="true"
                className="pointer-events-none absolute text-white"
              />
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 등록"}
            aria-pressed={isFavorite}
            className={cn(
              "leading-none transition",
              isFavorite ? "text-[#FB923C] hover:brightness-110" : "text-steel hover:text-foreground"
            )}
          >
            {isFavorite ? <IconStarFilled size={18} /> : <IconStar size={18} />}
          </button>
        )}
      </div>

      <h3 className="line-clamp-2 text-base font-medium">{plan.goal.title}</h3>
      <p className="text-xs text-muted">
        {formatDateRange(plan.goal.start_date, plan.goal.target_date)}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">진행률</span>
          <span className={cn("font-medium", isCompleted ? "text-accent" : "text-fog")}>{progress}%</span>
        </div>
        <ProgressBar value={progress} tone={isCompleted ? "accent" : "neutral"} />
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>총 할 일 {plan.tasks.length}개</span>
        <span aria-hidden="true">›</span>
      </div>
    </Card>
  );
}
