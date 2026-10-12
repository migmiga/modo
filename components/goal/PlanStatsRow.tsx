import { formatTotalMinutes } from "@/lib/format";

export function PlanStatsRow({
  totalDays,
  totalMinutes,
  taskCount,
}: {
  totalDays: number;
  totalMinutes: number;
  taskCount: number;
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border rounded-card bg-accent/5 py-3 text-center">
      <div>
        <p className="text-xs text-muted">총 계획일</p>
        <p className="mt-0.5 text-base font-medium">{totalDays}일</p>
      </div>
      <div>
        <p className="text-xs text-muted">예상 소요 시간</p>
        <p className="mt-0.5 text-base font-medium">{formatTotalMinutes(totalMinutes)}</p>
      </div>
      <div>
        <p className="text-xs text-muted">세부 할 일</p>
        <p className="mt-0.5 text-base font-medium">{taskCount}개</p>
      </div>
    </div>
  );
}
