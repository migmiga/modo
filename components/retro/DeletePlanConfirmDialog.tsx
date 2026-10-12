import { Button } from "@/components/ui/Button";

// 계획 지속 여부 팝업의 "삭제하기"에서 이어지는 최종 확인 — "취소"는 계획
// 지속 여부 팝업으로 되돌아가야 하므로, 여기서는 그 복귀 동작을 호출부
// (app/page.tsx)에 맡기고 이 컴포넌트는 두 콜백만 받는다.
export function DeletePlanConfirmDialog({
  onCancel,
  onConfirmDelete,
}: {
  onCancel: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="space-y-1">
          <h2 className="text-base font-medium">이 계획을 삭제할까요?</h2>
          <p className="text-sm text-muted">
            계획과 관련된 작업 및 기록이 모두 삭제되며, 삭제 후에는 복구할 수 없어요.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="header" onClick={onCancel} className="flex-1">
            취소
          </Button>
          <Button variant="primary" onClick={onConfirmDelete} className="flex-1">
            계획 삭제하기
          </Button>
        </div>
      </div>
    </div>
  );
}
