import { Button } from "@/components/ui/Button";

// "나중에 하기"를 선택했지만 아직 새 날짜로 재조정되지 않은 작업들을 안내하는
// 팝업 — 일반 미완료 작업(IncompleteCheckDialog가 다루는 대상)과는 별개로,
// 사용자가 이미 "다른 날에 하겠다"고 결정한 작업이므로 미달성으로 취급하지
// 않고 재조정 화면으로만 안내한다. 강제 선택이 아니므로 닫기(X)를 허용한다
// — 2일 이상 지난 미완료에 대한 ContinuePlanDialog(강제 선택)와는 다르다.
export function ReplanNoticeDialog({
  count,
  onClose,
  onGoToReplan,
}: {
  count: number;
  onClose: () => void;
  onGoToReplan: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="w-full max-w-sm space-y-4 rounded-card border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-base font-medium">재조정할 작업이 있어요</h2>
            <p className="text-sm text-muted">
              나중에 하기로 선택한 작업 {count}개가 아직 새 날짜로 옮겨지지 않았어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-sm text-muted outline-none transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <Button onClick={onGoToReplan} className="w-full">
          일정 재조정하기
        </Button>
      </div>
    </div>
  );
}
