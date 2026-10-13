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
  setEntryMethod("google");
}

// 실제 로그아웃(=이전에 로그인해 있던 세션이 끝남)에서만 호출한다 —
// lib/authSync.ts가 "원래 세션이 없던 최초 진입"과 구분해서 부른다. userId를
// 해제하고 새 익명 deviceId를 발급해, 같은 기기를 다음 사람이 써도 이전
// 사람의 식별값에 이어붙지 않게 한다.
export function resetIdentity() {
  amplitude.reset();
}

// "entry_method" 사용자 속성만 세팅한다 — 이벤트가 아니라 프로필 속성이라
// 여러 번 불러도(예: 이미 로그인된 사용자가 새로고침할 때마다) 중복 이벤트를
// 만들지 않고 그냥 같은 값을 덮어쓸 뿐이다. autocapture가 잡는 이후 모든
// 이벤트에 이 속성이 함께 실린다.
export function setEntryMethod(method: "guest" | "google") {
  amplitude.identify(new amplitude.Identify().set("entry_method", method));
}

// "로그인 없이 체험하기" 버튼을 실제로 눌렀을 때만 호출한다(components/auth/
// LoginModal.tsx) — lib/authSync.ts가 로그아웃 후 자동으로 게스트 상태로
// 돌아갈 때는 부르지 않는다. 새로고침/복귀 때마다 다시 쏘면 안 되는 1회성
// 퍼널 이벤트이기 때문에, 호출 지점을 이 버튼 클릭 하나로 제한한다.
export function trackGuestStarted() {
  amplitude.track("guest_started");
}
