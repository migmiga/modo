// TEMPORARY layout-debug instrumentation — getBoundingClientRect() based
// measurements to diagnose (1) why page content start positions differ
// between 대시보드/보관함/AI 플래너, and (2) why the viewport shifts
// horizontally when opening the 타임라인의 잠시 쉬기/완료하기 modals.
// No CSS/layout behavior changes here — remove this file and its call
// sites once the root cause is confirmed.

export const LAYOUT_DEBUG = true;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function rectOf(el: Element | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: round(r.left), right: round(r.right), top: round(r.top), width: round(r.width) };
}

function queryLandmarks() {
  const sidenav = document.querySelector('[data-ld="sidenav"]');
  const mainWrapper = document.querySelector('[data-ld="main-wrapper"]');
  const breadcrumb = document.getElementById("app-header-breadcrumb-slot");
  const pageTitle = document.querySelector('[data-ld="page-title"]');
  const pageBody = document.querySelector('[data-ld="page-body"]');
  return { sidenav, mainWrapper, breadcrumb, pageTitle, pageBody };
}

// Visible card ROOT elements (actual rendered border, not the transparent
// grid wrapper around them) — one selector per page's primary card.
const CARD_SELECTORS: Record<string, string> = {
  "dashboard MiniCalendar card": '[data-ld="card-dashboard"]',
  "archive ArchiveCard (1st)": '[data-ld="card-archive"]',
  "AI planner GoalForm card": '[data-ld="card-ai-planner-form"]',
  "AI planner PlanPreviewPanel card": '[data-ld="card-ai-planner-preview"]',
};

/** Section 1: page audit — content start coordinates for the current page. */
export function logPageAudit(pathname: string) {
  if (!LAYOUT_DEBUG || typeof window === "undefined") return;
  const { sidenav, mainWrapper, breadcrumb, pageTitle, pageBody } = queryLandmarks();
  const sidenavRect = rectOf(sidenav);
  const mainRect = rectOf(mainWrapper);
  const pageBodyRect = rectOf(pageBody);

  console.group("[MODO LAYOUT_DEBUG] page audit");
  console.log("pathname:", pathname);
  console.log("window.innerWidth:", window.innerWidth);
  console.log("document.documentElement.clientWidth:", document.documentElement.clientWidth);
  console.log("sidenav (left/right/width):", sidenavRect);
  console.log("mainWrapper (left/width):", mainRect);
  console.log("breadcrumb (left):", rectOf(breadcrumb));
  console.log("pageTitle (left):", rectOf(pageTitle));
  console.log("pageBody — transparent grid wrapper (left):", pageBodyRect);
  console.log(
    "gap: sidenav.right -> mainWrapper.left =",
    sidenavRect && mainRect ? round(mainRect.left - sidenavRect.right) : null
  );

  console.group("visible card ROOT elements (left/right/width, diff vs pageBody.left)");
  for (const [label, selector] of Object.entries(CARD_SELECTORS)) {
    const el = document.querySelector(selector);
    const r = rectOf(el);
    console.log(
      label + ":",
      r,
      r && pageBodyRect ? `diff vs pageBody.left = ${round(r.left - pageBodyRect.left)}` : "(not present on this page)"
    );
  }
  console.groupEnd();

  console.groupEnd();
}

/** Section 2: modal before/open/closed audit — viewport width + landmark coordinates. */
export function logModalAudit(phase: "BEFORE" | "OPEN" | "CLOSED", modalName: string) {
  if (!LAYOUT_DEBUG || typeof window === "undefined") return;
  const { sidenav, mainWrapper, breadcrumb, pageTitle } = queryLandmarks();
  const html = document.documentElement;
  const body = document.body;
  const bodyStyle = getComputedStyle(body);
  const htmlStyle = getComputedStyle(html);
  const innerWidth = window.innerWidth;
  const htmlClientWidth = html.clientWidth;

  console.group(`[MODO LAYOUT_DEBUG] modal ${phase}`);
  console.log("modal:", modalName);
  console.log("window.innerWidth:", innerWidth);
  console.log("document.documentElement.clientWidth:", htmlClientWidth);
  console.log("body.clientWidth:", body.clientWidth);
  console.log("inferred scrollbar width (innerWidth - html.clientWidth):", innerWidth - htmlClientWidth);
  console.log("html overflow / overflow-x / overflow-y:", htmlStyle.overflow, htmlStyle.overflowX, htmlStyle.overflowY);
  console.log("body overflow / overflow-x / overflow-y:", bodyStyle.overflow, bodyStyle.overflowX, bodyStyle.overflowY);
  console.log("body padding-right:", bodyStyle.paddingRight, "| body margin-right:", bodyStyle.marginRight);
  console.log("sidenav (left/right):", rectOf(sidenav));
  console.log("mainWrapper (left):", rectOf(mainWrapper));
  console.log("breadcrumb (left):", rectOf(breadcrumb));
  console.log("pageTitle (left):", rectOf(pageTitle));
  console.groupEnd();
}

/** Runs `fn` after the browser has committed layout for the current frame. */
export function afterLayoutSettles(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}
