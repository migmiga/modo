"use client";

import { IconArrowBackUp, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";

import { cn } from "@/lib/cn";

// Tabler icon style for this screen: 16px, 1.75px stroke. Color is left
// unset so it inherits each button's own text color (text-muted /
// hover:text-foreground) via currentColor, same as before.
const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

const DURATION_STEP_MIN = 10;
const MIN_DURATION_MIN = 10;

// Drag is initiated by pressing anywhere on the card itself now that the
// dedicated handle icon is gone — these three controls stop the pointerdown
// from bubbling to the card so clicking/pressing them never starts a drag.
function stopPointerPropagation(e: React.PointerEvent) {
  e.stopPropagation();
}

export function TaskRow({
  title,
  durationMinutes,
  isDragging,
  registerRef,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onRemove,
  onChangeDuration,
  trailingAction = "remove",
  onUndo,
}: {
  title: string;
  durationMinutes: number;
  isDragging: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onHandlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHandlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove?: () => void;
  onChangeDuration: (minutes: number) => void;
  /** "remove" (default, every existing caller) shows the trash icon;
   *  "undo" (replan screen, session-placed tasks only) shows a
   *  "밀린 할 일로 되돌리기" arrow instead; "none" renders nothing in that
   *  slot (replan screen, pre-existing window tasks — no delete affordance
   *  on this screen, per the redesign's explicit scoping). */
  trailingAction?: "remove" | "undo" | "none";
  onUndo?: () => void;
}) {
  const isUndetermined = durationMinutes <= 0;

  return (
    <div
      ref={registerRef}
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerUp}
      style={{ touchAction: "none" }}
      className={cn(
        "space-y-2 rounded-card border border-border bg-surface px-3 py-2.5 transition-shadow",
        isDragging ? "relative z-10 cursor-grabbing shadow-pop ring-2 ring-accent/30" : "cursor-grab"
      )}
    >
      {/* Row 1: title (left) + delete (top-right) */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-medium leading-snug"
          data-amp-mask=""
        >
          {title}
        </p>
        {trailingAction === "remove" && (
          <button
            type="button"
            onClick={onRemove}
            onPointerDown={stopPointerPropagation}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-btn text-muted transition hover:bg-accent/5 hover:text-foreground"
            aria-label="삭제"
          >
            <IconTrash size={ICON_SIZE} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
        )}
        {trailingAction === "undo" && (
          <button
            type="button"
            onClick={onUndo}
            onPointerDown={stopPointerPropagation}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-btn text-muted transition hover:bg-accent/5 hover:text-foreground"
            aria-label="밀린 할 일로 되돌리기"
            title="밀린 할 일로 되돌리기"
          >
            <IconArrowBackUp size={ICON_SIZE} stroke={ICON_STROKE} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Row 2: duration stepper, or "소요 시간 미정" while the AI hasn't
          assigned a duration yet (new tasks added via + 계획 추가). */}
      {isUndetermined ? (
        <p className="text-xs text-muted">소요 시간 미정</p>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeDuration(Math.max(MIN_DURATION_MIN, durationMinutes - DURATION_STEP_MIN))}
            onPointerDown={stopPointerPropagation}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted transition hover:bg-accent/5 hover:text-foreground"
            aria-label="시간 10분 줄이기"
          >
            <IconMinus size={ICON_SIZE} stroke={ICON_STROKE} />
          </button>
          {/* Fixed width so 45분/120분/270분 etc. never shift the two
              buttons around it. */}
          <span className="w-10 shrink-0 text-center text-xs tabular-nums text-muted">
            {durationMinutes}분
          </span>
          <button
            type="button"
            onClick={() => onChangeDuration(durationMinutes + DURATION_STEP_MIN)}
            onPointerDown={stopPointerPropagation}
            className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted transition hover:bg-accent/5 hover:text-foreground"
            aria-label="시간 10분 늘리기"
          >
            <IconPlus size={ICON_SIZE} stroke={ICON_STROKE} />
          </button>
        </div>
      )}
    </div>
  );
}
