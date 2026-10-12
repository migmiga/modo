"use client";

import { useState } from "react";

import { TagInput } from "@/components/home/TagInput";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { NOTE_TITLE_MAX_LEN } from "@/lib/notes";

export interface NoteModalValues {
  title: string;
  url: string;
  content: string;
  tags: string[];
}

export function NoteModal({
  mode,
  initial,
  tagSuggestions,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial?: NoteModalValues;
  /** Tag names already used on other notes, for autocomplete. */
  tagSuggestions: string[];
  onClose: () => void;
  onSubmit: (values: NoteModalValues) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  const canSubmit = title.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ title: title.trim(), url: url.trim(), content: content.trim(), tags });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">{mode === "create" ? "메모 추가" : "메모 수정"}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="relative flex h-6 w-6 items-center justify-center rounded-[6px] text-sm text-muted outline-none transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <Field label="제목" required hint={`${title.length}/${NOTE_TITLE_MAX_LEN}`}>
            <Input
              borderClassName="border border-ash"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={NOTE_TITLE_MAX_LEN}
              placeholder="예) 경쟁사 리서치"
            />
          </Field>
          <Field label="URL">
            <Input
              borderClassName="border border-ash"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="태그">
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </Field>
          <Field label="메모">
            <Textarea
              borderClassName="border border-ash"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="실행하면서 발견한 내용을 기록해보세요."
            />
          </Field>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" hoverClassName="hover:bg-paper-mist" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
            {mode === "create" ? "추가" : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
