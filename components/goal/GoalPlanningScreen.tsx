"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { GoalForm, type GoalFormValues } from "@/components/goal/GoalForm";
import { PlanPreviewPanel, type PreviewStatus } from "@/components/goal/PlanPreviewPanel";
import { StepIndicator } from "@/components/goal/StepIndicator";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { afterLayoutSettles, logPageAudit } from "@/lib/debugLayout";
import { useAppStore } from "@/lib/store";

const MOCK_GENERATION_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function GoalPlanningScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const draftPlan = useAppStore((s) => s.draftPlan);
  const createDraftGoal = useAppStore((s) => s.createDraftGoal);
  const confirmPlan = useAppStore((s) => s.confirmPlan);
  const referenceGoalDraft = useAppStore((s) => s.referenceGoalDraft);
  const clearReferenceGoalDraft = useAppStore((s) => s.clearReferenceGoalDraft);

  const [view, setView] = useState<"form" | "preview">(() => (draftPlan ? "preview" : "form"));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (referenceGoalDraft) clearReferenceGoalDraft();
    // 보관함에서 "이 계획으로 새 계획 만들기"로 넘어온 참고용 제목/현재 상황을
    // GoalForm이 최초 렌더에서 한 번만 읽도록 하고, 즉시 비워 재진입 시 남지 않게 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TEMPORARY layout-debug instrumentation — see lib/debugLayout.ts.
  useEffect(() => {
    afterLayoutSettles(() => logPageAudit(pathname));
  }, [pathname]);

  async function handleGenerate(values: GoalFormValues) {
    if (isLoading) return;
    setIsLoading(true);
    await sleep(MOCK_GENERATION_DELAY_MS);
    const result = createDraftGoal(values);
    setIsLoading(false);
    if (result === "success") setView("preview");
  }

  function handleApply() {
    confirmPlan();
    router.push("/dashboard");
  }

  const previewStatus: PreviewStatus = isLoading ? "loading" : draftPlan ? "ready" : "empty";
  const currentStep: 1 | 2 | 3 = draftPlan ? 2 : 1;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
      <AppHeader
        breadcrumb={[{ label: "AI 플래너" }, { label: "계획 생성" }]}
        action={
          <Button variant="header" size="sm">
            도움말
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className={cn("space-y-2", view === "preview" && "hidden lg:block")}>
          <h1 data-ld="page-title" className="font-heading text-heading-sm font-medium text-foreground">어떤 목표를 이루고 싶으세요?</h1>
          <p className="text-sm text-muted">
            목표와 기간, 가용 시간을 알려주시면 AI가 일별 계획을 만들어드려요.
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />
      </div>

      <div data-ld="page-body" className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_5fr] lg:gap-8 lg:items-start">
        <div
          className={cn(
            "relative lg:h-[824px] lg:max-h-[85vh]",
            view === "preview" ? "hidden lg:block" : "block"
          )}
        >
          <GoalForm
            initialGoal={draftPlan?.goal ?? null}
            initialTitle={referenceGoalDraft?.title}
            initialContext={referenceGoalDraft?.contextText}
            isLoading={isLoading}
            onSubmit={handleGenerate}
          />

          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-background/70 backdrop-blur-sm lg:hidden">
              <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-5 text-center shadow-pop">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
                <p className="text-sm text-muted">목표에 맞는 계획을 만들고 있어요.</p>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "lg:h-[824px] lg:max-h-[85vh]",
            view === "preview" ? "block" : "hidden lg:block"
          )}
        >
          <PlanPreviewPanel
            status={previewStatus}
            draftPlan={draftPlan}
            onEditInputs={() => setView("form")}
            onEditPlan={() => router.push("/goals/review")}
            onApply={handleApply}
          />
        </div>
      </div>
    </div>
  );
}
