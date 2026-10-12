import type { Note } from "./types";

// Shared by NoteModal (input maxLength + counter) and MemoTable (title
// column min-width, measured off up-to-this-many characters of real content).
export const NOTE_TITLE_MAX_LEN = 10;

// Per-tag pastel color, one of 5 — deterministically derived from the tag's
// own text (a simple string hash, not Math.random()), not stored anywhere.
// That's the "minimal change" this needed: notes/tags aren't persisted
// today (plain useState in app/page.tsx, reset on refresh), so there's no
// existing place to durably store a randomly-rolled color per tag, and
// adding one would mean reshaping Note.tags from string[] into objects
// everywhere it flows (TagInput, TagList, NoteModal, the store). Hashing
// the name instead needs zero data-shape changes, is naturally stable
// across re-renders/sessions/old data (no stored field to be missing), and
// still gives different tags on the same note different colors in
// practice — the one difference from true per-add randomness is that the
// same tag text always lands on the same color rather than only "mostly".
const TAG_COLOR_PALETTE: { bg: string; text: string }[] = [
  { bg: "bg-soft-mint", text: "text-vivid-green" }, // #DCFCE7 / #16A34A
  { bg: "bg-[#FFEDD5]", text: "text-tangerine" }, // #FFEDD5 / #EA580C
  { bg: "bg-[#F3E8FF]", text: "text-lavender" }, // #F3E8FF / #7C3AED
  { bg: "bg-[#DBEAFE]", text: "text-electric-blue" }, // #DBEAFE / #2563EB
  { bg: "bg-[#E0E7FF]", text: "text-deep-sapphire" }, // #E0E7FF / #1E40AF
];

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** `"bg-... text-..."` pair for this tag's chip — same tag text always
 *  resolves to the same pair, everywhere it's rendered. */
export function getTagColorClassName(tag: string): string {
  const { bg, text } = TAG_COLOR_PALETTE[hashTag(tag) % TAG_COLOR_PALETTE.length];
  return `${bg} ${text}`;
}

// Every distinct tag across all notes, in first-seen order — no separate tag
// registry is stored; this is always derived fresh from the notes themselves,
// so removing a tag from one note never affects its presence on another.
export function collectAllTags(notes: Note[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const note of notes) {
    for (const tag of note.tags ?? []) {
      if (!seen.has(tag)) {
        seen.add(tag);
        result.push(tag);
      }
    }
  }
  return result;
}
