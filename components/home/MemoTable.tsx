"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, File, FileText } from "lucide-react";
import { IconLink, IconList, IconTextRecognition } from "@tabler/icons-react";

import { TagList } from "@/components/home/TagList";
import { cn } from "@/lib/cn";
import { formatShortUrl } from "@/lib/format";
import { NOTE_TITLE_MAX_LEN } from "@/lib/notes";
import type { Note } from "@/lib/types";

// Column order is fixed — 제목 → 태그 → URL — and so are the widths: no
// resize, no persisted ratio. Each column is an equal 1fr share of
// whatever's left after all three minimums are met.
type MemoColumnKey = "title" | "tag" | "url";
const COLUMN_ORDER: MemoColumnKey[] = ["title", "tag", "url"];

// Floor for the title column before any row has reported its own real
// required width — just avoids a 0px flash on first paint.
const TITLE_FALLBACK_MIN_PX = 100;
// size=16 icon + gap-2 (8px) between icon and text.
const TITLE_ICON_GAP_PX = 24;
// px-2 on both sides of the title cell.
const TITLE_CELL_PADDING_PX = 16;
const URL_MIN_PX = 160;
// Floor for the tag column before any row has reported its own real
// required width (see TagList) — just avoids a 0px flash on first paint.
const TAG_FALLBACK_MIN_PX = 56;
// px-2 on both sides of the tag cell — TagList itself only ever reasons in
// terms of its own content area, so this is added/removed right at the
// boundary between "column track width" and "space TagList actually has".
const TAG_CELL_PADDING_PX = 16;

// How far one arrow-button click scrolls, as a fraction of the visible
// list height — "약 70~80%" from the spec.
const SCROLL_STEP_RATIO = 0.75;

// Scrollbar hidden visually, but the element is still a real scroll
// container — wheel/trackpad/touch and keyboard scrolling all still work.
const SCROLLBAR_HIDDEN_CLASSNAME = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

// Visible by default (touch/no-hover devices) but, on a device that DOES
// support hover, hidden until the list is hovered/focused — same pattern as
// ChatGPT's floating scroll-to-bottom button.
const SCROLL_BUTTON_VISIBILITY_CLASSNAME = cn(
  "opacity-100 pointer-events-auto transition-opacity",
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none",
  "[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto",
  "focus-visible:opacity-100 focus-visible:pointer-events-auto"
);

const COLUMN_LABEL: Record<MemoColumnKey, string> = {
  title: "제목",
  tag: "태그",
  url: "URL",
};

const COLUMN_ICON: Record<MemoColumnKey, typeof IconTextRecognition> = {
  title: IconTextRecognition,
  tag: IconList,
  url: IconLink,
};

// Whether a vertical divider follows this column (everything but the last).
const HAS_DIVIDER_AFTER: Record<MemoColumnKey, boolean> = { title: true, tag: true, url: false };

// Table body used by the dashboard memo card. Header and every data row are
// cells of ONE shared CSS Grid (not separate per-row grids each repeating
// the same template) — that's what guarantees a header cell's right edge
// and every data cell's right edge in that same column are pixel-identical,
// by construction, and that the row borders always reach the table's own
// right edge (each cell fills its full track by default).
//
// Only the data rows scroll (vertically) — the header stays pinned via
// `position: sticky` *inside* the same grid/scroll container, rather than
// being pulled out into a separate element. A separate header would need its
// own column-width bookkeeping kept in sync with the body's, which is
// exactly the class of bug this table spent several rounds getting rid of.
export function MemoTable({
  notes,
  onOpenNote,
  emptyMessage,
}: {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  /** Shown, spanning all columns, below the (always-visible) header when
   * there are no rows to display. */
  emptyMessage?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tagHeaderRef = useRef<HTMLDivElement>(null);
  // The tag column's real rendered width — TagList needs this to decide how
  // many tags fit, and reading it off the actual DOM (rather than deriving
  // it from the grid template) is what survived every CSS Grid edge case
  // (automatic minimum size, sub-pixel rounding, etc.) that a formula didn't.
  const [tagColumnRealPx, setTagColumnRealPx] = useState(0);
  // The sticky header's real rendered height — so the "scroll up" button can
  // sit just below it instead of guessing a fixed offset.
  const [headerHeightPx, setHeaderHeightPx] = useState(0);
  // Each row (TagList) reports the narrowest width it needs — the tag
  // column's real minimum is whichever row needs the most room.
  const [tagMinWidths, setTagMinWidths] = useState<Record<string, number>>({});
  // Same idea for the title column, measured off each row's own title
  // (capped at NOTE_TITLE_MAX_LEN characters — a title longer than that
  // predates the limit and isn't guaranteed never to truncate).
  const [titleMinWidths, setTitleMinWidths] = useState<Record<string, number>>({});
  // Which arrow button(s) should be able to show right now.
  const [canScroll, setCanScroll] = useState({ up: false, down: false });

  useLayoutEffect(() => {
    const el = tagHeaderRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setTagColumnRealPx(rect.width);
      setHeaderHeightPx(rect.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Tracks whether there's anything to scroll to in each direction — re-runs
  // on every scroll, on the list's own size changing (card resized), and on
  // its content's size changing (notes added/removed, tags wrapping, etc.).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const up = el.scrollTop > 1;
      const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setCanScroll((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (gridRef.current) observer.observe(gridRef.current);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollByStep(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ top: direction * el.clientHeight * SCROLL_STEP_RATIO, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function handleTagRequiredWidth(noteId: string, px: number) {
    setTagMinWidths((prev) => {
      if (prev[noteId] === px) return prev;
      return { ...prev, [noteId]: px };
    });
  }

  function handleTitleRequiredWidth(noteId: string, px: number) {
    setTitleMinWidths((prev) => {
      if (prev[noteId] === px) return prev;
      return { ...prev, [noteId]: px };
    });
  }

  const tagColumnMinPx = Math.max(
    TAG_FALLBACK_MIN_PX,
    ...notes.map((n) => (tagMinWidths[n.id] ?? 0) + TAG_CELL_PADDING_PX)
  );
  const titleColumnMinPx = Math.max(
    TITLE_FALLBACK_MIN_PX,
    ...notes.map((n) => (titleMinWidths[n.id] ?? 0) + TITLE_ICON_GAP_PX + TITLE_CELL_PADDING_PX)
  );
  const minColPx: Record<MemoColumnKey, number> = {
    title: titleColumnMinPx,
    tag: tagColumnMinPx,
    url: URL_MIN_PX,
  };
  const totalMinPx = minColPx.title + minColPx.tag + minColPx.url;
  const gridTemplate = COLUMN_ORDER.map((key) => `minmax(${minColPx[key]}px, 1fr)`).join(" ");

  return (
    <div className="group relative h-full min-h-0">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="메모 목록"
        className={cn("h-full w-full overflow-auto outline-none", SCROLLBAR_HIDDEN_CLASSNAME)}
      >
        <div
          ref={gridRef}
          className={cn(
            "grid w-full",
            // Only when empty: the grid itself fills the scroll area
            // (h-full) and the row AFTER the sticky header is given the
            // remaining space (1fr) instead of sizing to its own content —
            // that's what lets the empty-state cell below actually center
            // within "header divider → card's bottom padding", not just
            // sit in a thin auto-sized row right under the header. Rows
            // mode (notes.length > 0) is untouched — natural auto-rows,
            // scrollable, same as before.
            notes.length === 0 && "h-full grid-rows-[auto_1fr]"
          )}
          style={{ gridTemplateColumns: gridTemplate, minWidth: `${totalMinPx}px` }}
        >
          {COLUMN_ORDER.map((key) => {
            const Icon = COLUMN_ICON[key];
            return (
              <div
                key={`head-${key}`}
                ref={key === "tag" ? tagHeaderRef : undefined}
                className="sticky top-0 z-10 flex min-w-0 items-center gap-2 border-b border-border bg-surface px-2 py-2 text-xs text-muted"
              >
                <Icon size={16} stroke={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                {COLUMN_LABEL[key]}
              </div>
            );
          })}

          {notes.length === 0
            ? emptyMessage && (
                <div
                  className="flex min-w-0 items-center justify-center text-center text-sm text-muted"
                  style={{ gridColumn: "1 / -1" }}
                >
                  {emptyMessage}
                </div>
              )
            : notes.map((note) => {
                const hasContent = Boolean(note.content?.trim());
                return COLUMN_ORDER.map((key) => (
                  <div
                    key={`${note.id}-${key}`}
                    className={cn(
                      "min-w-0 overflow-hidden border-b border-border/60",
                      // Always-on light divider between data columns — a plain
                      // cell border, so it's exactly as wide as the column
                      // itself, by construction (no separate overlay to misalign).
                      HAS_DIVIDER_AFTER[key] && "border-r border-border/60"
                    )}
                  >
                    {key === "title" && (
                      <button
                        type="button"
                        onClick={() => onOpenNote(note)}
                        className="relative flex min-w-0 items-center gap-2 px-2 py-2 text-left text-sm text-foreground hover:underline"
                      >
                        <TitleWidthProbe
                          text={note.title.slice(0, NOTE_TITLE_MAX_LEN)}
                          onWidth={(px) => handleTitleRequiredWidth(note.id, px)}
                        />
                        {hasContent ? (
                          <FileText size={16} className="shrink-0 text-muted" aria-hidden="true" />
                        ) : (
                          <File size={16} className="shrink-0 text-muted" aria-hidden="true" />
                        )}
                        <span className="truncate" title={note.title} data-amp-mask="">
                          {note.title}
                        </span>
                      </button>
                    )}
                    {key === "tag" && (
                      <div className="px-2 py-2">
                        <TagList
                          tags={note.tags ?? []}
                          columnWidthPx={Math.max(tagColumnRealPx - TAG_CELL_PADDING_PX, 0)}
                          onRequiredWidthChange={(px) => handleTagRequiredWidth(note.id, px)}
                        />
                      </div>
                    )}
                    {key === "url" && (
                      <div className="px-2 py-2 text-sm text-muted">
                        {note.url ? (
                          <a
                            href={note.url}
                            target="_blank"
                            rel="noreferrer"
                            title={note.url}
                            className="block truncate hover:text-accent hover:underline"
                          >
                            {formatShortUrl(note.url)}
                          </a>
                        ) : null}
                      </div>
                    )}
                  </div>
                ));
              })}
        </div>
      </div>

      {canScroll.up && (
        <button
          type="button"
          onClick={() => scrollByStep(-1)}
          aria-label="위로 스크롤"
          style={{ top: headerHeightPx + 8 }}
          className={cn(
            "absolute left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur-sm",
            SCROLL_BUTTON_VISIBILITY_CLASSNAME
          )}
        >
          <ChevronUp size={16} className="text-muted" aria-hidden="true" />
        </button>
      )}
      {canScroll.down && (
        <button
          type="button"
          onClick={() => scrollByStep(1)}
          aria-label="아래로 스크롤"
          className={cn(
            "absolute bottom-3 left-1/2 z-20 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur-sm",
            SCROLL_BUTTON_VISIBILITY_CLASSNAME
          )}
        >
          <ChevronDown size={16} className="text-muted" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Invisible, out-of-flow clone of the title text — same font-size/weight as
// the real <span> above, so its offsetWidth is the true rendered width of
// up to NOTE_TITLE_MAX_LEN characters, with zero layout footprint of its own.
function TitleWidthProbe({ text, onWidth }: { text: string; onWidth: (px: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    onWidth(ref.current?.offsetWidth ?? 0);
    // onWidth is expected to be referentially stable per row (keyed by note
    // id in the parent) — only the measured value matters here.
  }, [text, onWidth]);

  return (
    <span ref={ref} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-nowrap text-sm">
      {text}
    </span>
  );
}
