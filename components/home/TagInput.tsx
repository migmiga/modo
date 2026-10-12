"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { getTagColorClassName } from "@/lib/notes";

interface SuggestionItem {
  tag: string;
  isCreate: boolean;
}

// Per-note limit (not a global cap on how many distinct tags can exist).
const MAX_TAGS = 6;
// Counts raw characters, spaces included — enforced the same way on every
// input path via the native <input maxLength>, which blocks both typing and
// paste beyond the limit.
const MAX_TAG_LEN = 8;

export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Tag names already used on other notes — not including this note's own. */
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  // While a Korean/Japanese/Chinese IME is mid-composition, the browser can
  // report a `value` past maxLength for one keystroke (composition isn't
  // "done" yet) — truncating during that window cuts the jamo being
  // composed apart and corrupts it. Truncation is deferred until
  // compositionend; every other input path (typing, paste, autofill)
  // isn't composing and gets truncated immediately in onChange.
  const [isComposing, setIsComposing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // -1 = nothing highlighted (plain Enter falls back to "create from draft").
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const trimmedDraft = draft.trim();
  const availableSuggestions = suggestions.filter((s) => !value.includes(s));
  const filtered = trimmedDraft
    ? availableSuggestions.filter((s) => s.toLowerCase().includes(trimmedDraft.toLowerCase()))
    : availableSuggestions;
  const exactMatchExists = suggestions.includes(trimmedDraft) || value.includes(trimmedDraft);
  // One combined, keyboard-navigable list — a suggestion and the "create new"
  // option both just add that tag, so selecting either is the same action.
  const items: SuggestionItem[] = [
    ...filtered.map((tag) => ({ tag, isCreate: false })),
    ...(trimmedDraft && !exactMatchExists ? [{ tag: trimmedDraft, isCreate: true }] : []),
  ];
  const atMax = value.length >= MAX_TAGS;
  const isOpen = showSuggestions && items.length > 0 && !atMax;

  useEffect(() => {
    if (highlightedIndex >= 0) itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function addTag(tag: string) {
    const t = tag.trim();
    // Guards the limit at the data layer too, not just by disabling the
    // input — nothing that calls addTag (keyboard selection, click,
    // Enter-to-create) can push past 6, or past MAX_TAG_LEN, regardless of
    // how it got invoked.
    if (!t || t.length > MAX_TAG_LEN || value.includes(t) || value.length >= MAX_TAGS) return;
    onChange([...value, t]);
    setDraft("");
    setHighlightedIndex(-1);
    // Deliberately leaves showSuggestions as-is: the list (now minus this
    // tag) stays open so the next one can be picked right away, without an
    // extra click to reopen it.
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions) {
        setShowSuggestions(true);
        return;
      }
      if (items.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) return;
      setHighlightedIndex((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      // Always prevented — this input lives inside a modal, and Enter here
      // must never submit the form / trigger the modal's "추가" button,
      // whether it's selecting a highlighted suggestion or creating a tag.
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < items.length) {
        addTag(items[highlightedIndex].tag);
        return;
      }
      if (trimmedDraft) addTag(trimmedDraft);
      return;
    }
    if (e.key === "Escape") {
      if (showSuggestions) {
        e.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
      return;
    }
    // Deliberately no "Backspace on an empty draft removes the last tag"
    // behavior — it let users delete a tag by accident while just clearing
    // their typing. Removing a tag is only ever done via its own × button.
  }

  return (
    // 태그는 사용자가 직접 입력하는 자유 텍스트라 Amplitude elementInteractions가
    // 클릭을 수집할 때(이 입력 영역 전체가 Field의 <label> 안에 있어, 태그 칩을
    // 클릭하면 그 label의 보이는 텍스트 전체가 "[Amplitude] Element Text"로
    // 전송될 수 있다) 태그 값이 함께 전송되지 않도록 전체를 마스킹한다.
    <div className="space-y-2" data-amp-mask="">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            // The click handler lives ONLY on the × button below. This span
            // calls preventDefault() on any click that bubbles up through
            // it (e.g. a click on the tag text) so the browser's native
            // "clicking inside a <label> activates its first form control"
            // behavior can't forward that click to some other tag's ×
            // button — Field wraps this whole input in one <label>, and
            // with several chips + the text input inside it, that first
            // control would otherwise be whichever chip's × happens to be
            // first in the DOM.
            <span key={tag} onClick={(e) => e.preventDefault()} className="inline-flex">
              <Badge
                roundedClassName="rounded-[6px]"
                colorClassName={getTagColorClassName(tag)}
                className="inline-flex items-center gap-1"
              >
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  aria-label={`${tag} 태그 제거`}
                  className="leading-none opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </Badge>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            // Mid-composition: accept the full in-progress string as-is —
            // see isComposing's declaration above for why. Otherwise (typing,
            // paste, autofill), truncate immediately rather than relying
            // solely on the native maxLength, which is exactly what let
            // over-length input through until the next keystroke.
            setDraft(isComposing ? next : next.slice(0, MAX_TAG_LEN));
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(e) => {
            setIsComposing(false);
            setDraft(e.currentTarget.value.slice(0, MAX_TAG_LEN));
          }}
          onFocus={() => setShowSuggestions(true)}
          // onFocus alone doesn't fire again when clicking an input that's
          // already focused — this is what re-opens the list in that case.
          onClick={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={handleKeyDown}
          disabled={atMax}
          maxLength={MAX_TAG_LEN}
          placeholder={atMax ? "태그는 최대 6개까지 추가할 수 있어요." : "태그 입력 후 Enter"}
          className="w-full rounded-input border border-ash bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-foreground/5 disabled:text-muted"
        />
        {draft.length > 0 && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            {draft.length}/{MAX_TAG_LEN}
          </span>
        )}

        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-10 max-h-48 w-full overflow-y-auto rounded-card border border-border bg-surface shadow-pop">
            {items.map((item, index) => (
              <button
                key={item.tag}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                // Keeps focus on the input through the click so onBlur doesn't
                // close this list before onClick has a chance to fire.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(item.tag)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm",
                  item.isCreate ? "text-accent" : "text-foreground",
                  index === highlightedIndex ? "bg-accent/10" : "hover:bg-accent/5"
                )}
              >
                {item.isCreate ? (
                  <>
                    + &apos;{item.tag}&apos; 추가
                  </>
                ) : (
                  item.tag
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
