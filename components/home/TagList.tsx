"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { computeFloatingPosition } from "@/lib/floatingPosition";
import { getTagColorClassName } from "@/lib/notes";

// Matches the gap-1 (0.25rem) used between chips/badge below.
const GAP_PX = 4;
const TOOLTIP_WIDTH_PX = 200;
// Tags render at full width (no ellipsis) up to this — only a pathologically
// long tag name gets capped, falling back to truncate + a native title
// tooltip, so one extreme tag can't balloon the whole column's min-width.
const CHIP_CLASSNAME = "max-w-[240px] truncate";

export function TagList({
  tags,
  columnWidthPx,
  onRequiredWidthChange,
}: {
  tags: string[];
  columnWidthPx: number;
  /** Reports the narrowest width this row can render at (tag[0] + a "+N"
   * badge, never truncated) — the caller aggregates this across rows to
   * enforce the tag column's real minimum width. */
  onRequiredWidthChange: (px: number) => void;
}) {
  const firstRef = useRef<HTMLSpanElement>(null);
  const secondRef = useRef<HTMLSpanElement>(null);
  const badge1Ref = useRef<HTMLSpanElement>(null); // "+N" when only tag[0] shows
  const badge2Ref = useRef<HTMLSpanElement>(null); // "+N" when tag[0]+tag[1] show
  const [w, setW] = useState({ first: 0, second: 0, badge1: 0, badge2: 0 });

  const hiddenIfOne = Math.max(0, tags.length - 1);
  const hiddenIfTwo = Math.max(0, tags.length - 2);

  // Measured off real (invisible, out-of-flow) clones of the exact chip/badge
  // markup — never a text-length estimate — so this is accurate for any font
  // or content. Re-measure whenever the tag set itself changes.
  useLayoutEffect(() => {
    setW({
      first: firstRef.current?.offsetWidth ?? 0,
      second: secondRef.current?.offsetWidth ?? 0,
      badge1: badge1Ref.current?.offsetWidth ?? 0,
      badge2: badge2Ref.current?.offsetWidth ?? 0,
    });
  }, [tags]);

  const requiredForOne = tags.length === 0 ? 0 : w.first + (hiddenIfOne > 0 ? GAP_PX + w.badge1 : 0);
  const requiredForTwo =
    tags.length < 2 ? Infinity : w.first + GAP_PX + w.second + (hiddenIfTwo > 0 ? GAP_PX + w.badge2 : 0);

  useLayoutEffect(() => {
    onRequiredWidthChange(requiredForOne);
    // onRequiredWidthChange is expected to be referentially stable per row
    // (keyed by note id in the parent) — only the measured value matters here.
  }, [requiredForOne, onRequiredWidthChange]);

  if (tags.length === 0) return null;

  const showTwo = tags.length >= 2 && columnWidthPx >= requiredForTwo;
  const visibleCount = showTwo ? 2 : 1;
  const visible = tags.slice(0, visibleCount);
  const hidden = tags.slice(visibleCount);

  return (
    <TagListInteractive
      visible={visible}
      hidden={hidden}
      measure={{ tags, firstRef, secondRef, badge1Ref, badge2Ref, hiddenIfOne, hiddenIfTwo }}
    />
  );
}

function TagListInteractive({
  visible,
  hidden,
  measure,
}: {
  visible: string[];
  hidden: string[];
  measure: {
    tags: string[];
    firstRef: React.RefObject<HTMLSpanElement | null>;
    secondRef: React.RefObject<HTMLSpanElement | null>;
    badge1Ref: React.RefObject<HTMLSpanElement | null>;
    badge2Ref: React.RefObject<HTMLSpanElement | null>;
    hiddenIfOne: number;
    hiddenIfTwo: number;
  };
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const { tags, firstRef, secondRef, badge1Ref, badge2Ref, hiddenIfOne, hiddenIfTwo } = measure;

  function show() {
    const el = triggerRef.current;
    if (!el) return;
    setOpen(true);
    setPos(computeFloatingPosition(el, { width: TOOLTIP_WIDTH_PX, heightEstimate: 16 + hidden.length * 22 }));
  }

  function hide() {
    setOpen(false);
  }

  return (
    <div className="relative flex min-w-0 items-center gap-1 overflow-hidden">
      {/* Invisible, out-of-flow measurement clones — identical markup to the
          real chip/badge below, so their offsetWidth is the true, never-
          truncated size, with zero visual footprint of their own. */}
      <span
        ref={firstRef}
        aria-hidden="true"
        className={cn(
          "invisible absolute left-0 top-0 rounded-[6px] bg-accent/10 px-2.5 py-1 text-xs font-medium",
          CHIP_CLASSNAME
        )}
      >
        {tags[0]}
      </span>
      {tags.length >= 2 && (
        <span
          ref={secondRef}
          aria-hidden="true"
          className={cn(
            "invisible absolute left-0 top-0 rounded-[6px] bg-accent/10 px-2.5 py-1 text-xs font-medium",
            CHIP_CLASSNAME
          )}
        >
          {tags[1]}
        </span>
      )}
      {hiddenIfOne > 0 && (
        <span
          ref={badge1Ref}
          aria-hidden="true"
          className="invisible absolute left-0 top-0 whitespace-nowrap rounded-[6px] bg-paper-mist px-1.5 py-0.5 text-[11px] font-medium"
        >
          +{hiddenIfOne}
        </span>
      )}
      {hiddenIfTwo > 0 && (
        <span
          ref={badge2Ref}
          aria-hidden="true"
          className="invisible absolute left-0 top-0 whitespace-nowrap rounded-[6px] bg-paper-mist px-1.5 py-0.5 text-[11px] font-medium"
        >
          +{hiddenIfTwo}
        </span>
      )}

      {visible.map((tag) => (
        <Badge
          key={tag}
          title={tag}
          roundedClassName="rounded-[6px]"
          colorClassName={getTagColorClassName(tag)}
          className={cn("inline-block shrink-0", CHIP_CLASSNAME)}
        >
          {tag}
        </Badge>
      ))}

      {hidden.length > 0 && (
        <button
          ref={triggerRef}
          type="button"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          onClick={() => (open ? hide() : show())}
          className="shrink-0 whitespace-nowrap rounded-[6px] bg-paper-mist px-1.5 py-0.5 text-[11px] font-medium text-fog"
        >
          +{hidden.length}
        </button>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 flex w-[200px] flex-wrap gap-1.5 rounded-[12px] border border-border bg-chalk p-3 shadow-card"
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
          >
            {hidden.map((tag) => (
              <Badge
                key={tag}
                title={tag}
                roundedClassName="rounded-[6px]"
                colorClassName={getTagColorClassName(tag)}
                className="max-w-full truncate"
              >
                {tag}
              </Badge>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
