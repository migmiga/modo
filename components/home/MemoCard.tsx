"use client";

import { useState } from "react";

import { MemoTable } from "@/components/home/MemoTable";
import { NoteModal, type NoteModalValues } from "@/components/home/NoteModal";
import { collectAllTags } from "@/lib/notes";
import type { Note } from "@/lib/types";

export function MemoCard({
  notes,
  onAddNote,
  onUpdateNote,
}: {
  notes: Note[];
  onAddNote: (values: NoteModalValues) => void;
  onUpdateNote: (id: string, values: NoteModalValues) => void;
}) {
  const [openNote, setOpenNote] = useState<"new" | Note | null>(null);

  function handleSubmit(values: NoteModalValues) {
    if (openNote === "new") {
      onAddNote(values);
    } else if (openNote) {
      onUpdateNote(openNote.id, values);
    }
    setOpenNote(null);
  }

  const allTags = collectAllTags(notes);

  return (
    <section className="flex h-[392px] w-full min-w-0 flex-1 flex-col rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-base font-semibold">메모장</h2>
        <button type="button" onClick={() => setOpenNote("new")} className="text-sm font-medium text-accent">
          + 메모 추가
        </button>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <MemoTable
          notes={notes}
          onOpenNote={(note) => setOpenNote(note)}
          emptyMessage="아직 기록한 메모가 없어요."
        />
      </div>

      {openNote && (
        <NoteModal
          mode={openNote === "new" ? "create" : "edit"}
          initial={
            openNote === "new"
              ? undefined
              : {
                  title: openNote.title,
                  url: openNote.url ?? "",
                  content: openNote.content ?? "",
                  tags: openNote.tags ?? [],
                }
          }
          tagSuggestions={openNote === "new" ? allTags : allTags.filter((t) => !openNote.tags?.includes(t))}
          onClose={() => setOpenNote(null)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}
