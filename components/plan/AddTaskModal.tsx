"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export function AddTaskModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");

  if (!open) return null;

  function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  }

  function handleClose() {
    setTitle("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">계획 추가</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted hover:text-foreground"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label htmlFor="add-task-title" className="block text-sm font-medium text-foreground">
            할 일을 입력해 주세요
          </label>
          <Input
            id="add-task-title"
            autoFocus
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") handleClose();
            }}
            placeholder="예) 레퍼런스 조사하기"
            borderClassName="border border-ash"
            // Chrome/Edge paint their own autofill highlight (a light
            // blue/yellow tint + sometimes a dark border) straight over our
            // background/border once a field has a value and loses focus —
            // autoComplete="off" above reduces how often that triggers, and
            // this forces our own white bg + text color back on top on the
            // rare case it still does.
            className="[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#ffffff_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#171717]"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            취소
          </Button>
          <Button onClick={handleAdd} disabled={title.trim().length === 0} className="flex-1">
            추가
          </Button>
        </div>
      </div>
    </div>
  );
}
