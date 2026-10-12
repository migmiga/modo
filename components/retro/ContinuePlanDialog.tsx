import { Button } from "@/components/ui/Button";

// 2일 이상 지난("어제"보다 더 과거) 일반 미완료 작업이 있을 때 뜨는 강제
// 선택 팝업 — "삭제하기" 또는 "이어가기" 중 하나를 선택해야만 닫힌다(닫기
// X나 배경 클릭으로는 닫을 수 없음 — 이 컴포넌트는 그런 핸들러를 아예
// 두지 않는다).
export function ContinuePlanDialog({
  incompleteCount,
  onDelete,
  onContinue,
}: {
  incompleteCount: number;
  onDelete: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="space-y-1">
          <h2 className="text-base font-medium">진행하지 못한 일정이 있어요</h2>
          <p className="text-sm text-muted">완료하지 못한 작업이 남아 있어요. 기존 계획을 이어서 진행할까요?</p>
        </div>

        <div className="flex items-center justify-between rounded-input bg-ash px-3 py-2.5 text-sm">
          <span className="text-foreground">미완료 작업</span>
          <span className="font-semibold text-[#EA580C]">{incompleteCount}개</span>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDelete} className="flex-1">
            삭제하기
          </Button>
          <Button variant="primary" onClick={onContinue} className="flex-1">
            이어가기
          </Button>
        </div>
      </div>
    </div>
  );
}
