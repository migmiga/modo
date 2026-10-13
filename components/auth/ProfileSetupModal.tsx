"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FieldDropdown } from "@/components/ui/FieldDropdown";
import { FIELD_OPTIONS, OCCUPATION_OPTIONS } from "@/lib/constants";
import { useAppStore } from "@/lib/store";
import type { Occupation, ProfileField } from "@/lib/types";

import { ConnectedAccountRow } from "./ConnectedAccountRow";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const NICKNAME_MAX_LENGTH = 10;
const DUPLICATE_CHECK_NOTICE = "닉네임 중복 확인은 아직 연결되지 않았어요.";

export function ProfileSetupModal({
  open,
  onDismiss,
  onComplete,
}: {
  open: boolean;
  /** ESC/바깥 클릭/X — 저장 없이 그냥 닫기. 다음에 다시 로그인 필요 기능을
   *  시도하면 프로필이 비어 있는 채로 이 팝업이 다시 뜬다(이어서 진행). */
  onDismiss: () => void;
  /** setProfile 성공 후에만 호출 — 완전히 닫힌다. */
  onComplete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const setProfile = useAppStore((s) => s.setProfile);
  const profile = useAppStore((s) => s.profile);

  const [nickname, setNickname] = useState("");
  const [field, setField] = useState<ProfileField | "">("");
  const [occupation, setOccupation] = useState<Occupation | "">("");
  const [duplicateNotice, setDuplicateNotice] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 매번 새로 열릴 때 이전 입력이 남아있지 않도록 초기화한다. 이미 저장된
    // profile이 있으면(계정 메뉴의 "프로필 수정하기") 그 값으로 시작하고,
    // 없으면(최초 가입) 빈 값 — 기존 생성 플로우와 동일하다. setTimeout(0)으로
    // 미뤄 이펙트 본문에서 곧바로 setState하지 않는다(react-hooks/set-state-in-effect) —
    // 같은 패턴을 app/page.tsx의 retroFlow 우선순위 이펙트에서도 쓴다.
    const timeoutId = setTimeout(() => {
      setNickname(profile?.nickname ?? "");
      setField(profile?.field ?? "");
      setOccupation(profile?.occupation ?? "");
      setDuplicateNotice(false);
    }, 0);
    return () => clearTimeout(timeoutId);
    // profile은 의도적으로 deps에서 제외한다: 열려 있는 동안 다른 전역
    // 변경으로 profile이 바뀌어도 폼을 재초기화하지 않는다 — open이
    // true→true로 유지되는 동안은 "이 모달이 열릴 때의 값"만 한 번 반영하면
    // 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    card?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  const trimmedNickname = nickname.trim();
  // 중복 확인 결과는 완료 조건에 포함하지 않는다 — DB 연동 전까지는 그 결과
  // 자체가 존재하지 않기 때문.
  const canSubmit = trimmedNickname.length > 0 && field !== "" && occupation !== "";

  function handleSubmit() {
    // canSubmit 자체가 field/occupation !== "" 조건을 포함하므로, 여기서
    // 통과하면 TS가 두 값을 이미 ProfileField/Occupation으로 좁혀준다.
    if (!canSubmit) return;
    setProfile(trimmedNickname, field, occupation);
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
      onMouseDown={onDismiss}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="프로필 설정"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-80px)] w-[384px] max-w-[calc(100vw-40px)] flex-col gap-6 overflow-y-auto rounded-[24px] bg-white px-6 py-9"
      >
        <h2 className="text-[28px] font-medium text-foreground">프로필 설정</h2>

        {/* 라벨 16px, 입력창 내부 좌우 16px·상하 12px, 라벨-입력 간격 12px —
            공용 Field/Input(components/ui/Field.tsx)의 기본 패딩(12px/10px)과
            달라 여기서만 직접 마크업한다(cn()은 tailwind-merge가 아니라서
            className으로 덮어쓰면 두 padding 유틸이 충돌한다). */}
        <div className="flex w-full flex-col gap-3">
          <span className="inline-flex items-center gap-1 text-base font-medium text-foreground">
            닉네임
            <span className="text-xs leading-none text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(필수)</span>
          </span>

          <div className="flex w-full items-center gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="닉네임을 입력해 주세요."
              className="h-11 flex-1 rounded-input border border-input-border bg-surface px-4 py-3 text-sm text-foreground outline-none placeholder:text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <Button
              variant="secondary"
              className="h-11 shrink-0"
              onClick={() => setDuplicateNotice(true)}
            >
              중복 확인
            </Button>
          </div>

          <div className="flex items-center justify-between">
            {duplicateNotice ? (
              <p className="text-xs text-muted">{DUPLICATE_CHECK_NOTICE}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">
              {nickname.length}/{NICKNAME_MAX_LENGTH}자
            </span>
          </div>
        </div>

        <ConnectedAccountRow />

        <Field label="분야">
          <FieldDropdown
            value={field}
            options={FIELD_OPTIONS}
            onChange={(v) => setField(v as ProfileField)}
            ariaLabel="분야"
            placeholder="분야를 선택해 주세요."
          />
        </Field>

        <Field label="직종">
          <FieldDropdown
            value={occupation}
            options={OCCUPATION_OPTIONS}
            onChange={(v) => setOccupation(v as Occupation)}
            ariaLabel="직종"
            placeholder="직종을 선택해 주세요."
          />
        </Field>

        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          시작하기
        </Button>
      </div>
    </div>
  );
}
