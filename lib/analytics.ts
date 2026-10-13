import * as amplitude from "@amplitude/analytics-browser";

// Client-only: instrumentation-client.ts (project root) calls this before
// hydration, so this module never runs on the server and needs no "use
// client" directive — it isn't a React component.
export function initAnalytics() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;

  amplitude.init(apiKey, {
    autocapture: {
      // Page views, form interactions, sessions, attribution, and file
      // downloads default to true inside autocapture — only element
      // (click) tracking defaults to false, so it's opted in explicitly.
      elementInteractions: true,
    },
  });
}

// lib/authSync.ts가 Google 로그인 성공 시 호출한다. 이메일이 아니라 Supabase
// user.id(UUID)를 쓴다 — 로그인 전 익명 이벤트와 이후 이벤트가 같은 사용자로
// 자동 연결된다(Amplitude의 ID 머지).
export function identifyUser(userId: string) {
  amplitude.setUserId(userId);
}

// 로그아웃 시 호출한다. userId를 해제하고 새 익명 deviceId를 발급해, 같은
// 기기를 다음 사람이 써도 이전 사람의 식별값에 이어붙지 않게 한다.
export function resetIdentity() {
  amplitude.reset();
}
