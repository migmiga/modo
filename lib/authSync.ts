"use client";

import { useAuthStore } from "./auth";
import { identifyUser, resetIdentity } from "./analytics";
import { accountStorageKey, GUEST_STORAGE_KEY, switchAccountStorage } from "./store";
import { supabase } from "./supabaseClient";

// 비로그인 상태로 OAuth 리다이렉트에서 돌아왔을 때(취소/실패) Supabase/Google이
// 붙여주는 쿼리 파라미터를 읽어 안내 문구를 띄우고, URL에서는 지운다.
function consumeOAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error_description") || params.get("error");
  if (!error) return;

  useAuthStore.getState().setLoginError("로그인이 취소되었거나 실패했어요. 다시 시도해 주세요.");

  params.delete("error");
  params.delete("error_description");
  params.delete("error_code");
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
}

// app/providers.tsx에서 마운트 시 한 번만 호출한다. Supabase 세션의 변화를
// 구독해 "계정별 저장소 전환 → lib/auth.ts 갱신 → Amplitude 식별" 순서를
// 실행하고, 구독 해지 함수를 돌려준다.
export function startAuthSync(): () => void {
  if (!supabase) {
    // 아직 Supabase 환경변수가 설정되지 않음 — 게스트 키로만 동작하도록 한
    // 번 전환하고 끝낸다(기존 동작과 동일, Google 로그인만 비활성).
    void switchAccountStorage(GUEST_STORAGE_KEY);
    return () => {};
  }

  // 같은 uuid로의 중복 적용을 막고, 뒤섞여 들어오는 이벤트 중 가장 최신
  // 것만 lib/auth.ts/Amplitude에 반영하기 위한 세대 번호. switchAccountStorage
  // 자체도 zustand persist의 내부 버전 가드로 "가장 마지막 전환만" 실제로
  // settledKey에 도달하지만, 그 비동기 대기 중에 더 최신 로그인/로그아웃
  // 이벤트가 들어오면 이 세대 번호로 한 번 더 막는다.
  let generation = 0;

  async function applySession(userId: string | null, email: string | null) {
    const myGeneration = ++generation;
    const key = userId ? accountStorageKey(userId) : GUEST_STORAGE_KEY;

    // 로그아웃(userId null)은 저장소를 게스트로 전환하기 "전에" 로그인
    // 플래그부터 내린다. switchAccountStorage()의 rehydrate가 끝나는 순간
    // profile/hydrated가 게스트 값으로 먼저 바뀌는데, 그때까지 isLoggedIn이
    // true로 남아있으면 LoginGateProvider가 "막 로그인했는데 프로필이 없는
    // 신규 사용자"로 오판해 프로필 설정 팝업을 잘못 띄운다. 로그인(userId
    // 있음) 분기는 반대로 이 순서를 유지해야 한다 — 전환이 끝나 그 계정의
    // 실제 profile이 로드된 뒤에야 isLoggedIn을 true로 바꿔야, 기존
    // 사용자에게도 "프로필 없음" 화면이 잠깐 깜빡이지 않는다.
    if (!userId) {
      useAuthStore.getState().clearSession();
      resetIdentity();
    }

    await switchAccountStorage(key);

    // 대기 중에 더 최신 이벤트가 이미 들어왔다면, 그 이벤트의 applySession이
    // 이미(혹은 곧) 최종 상태를 결정한다 — 이 오래된 호출은 auth
    // store/Amplitude를 건드리지 않고 조용히 끝난다.
    if (myGeneration !== generation) return;

    if (userId) {
      useAuthStore.getState().setGoogleSession({ userId, email });
      identifyUser(userId);
    }
  }

  consumeOAuthErrorFromUrl();

  // 최초 1회: 새로고침/첫 진입 시 이미 있는 세션을 확인하기 전에는 게스트
  // 데이터를 먼저 그리지 않는다(hydrated는 이 rehydrate가 끝나야 true가 됨).
  let bootstrapped = false;
  void supabase.auth.getSession().then(({ data }) => {
    bootstrapped = true;
    void applySession(data.session?.user.id ?? null, data.session?.user.email ?? null);
  });

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    // onAuthStateChange는 구독 직후 현재 세션으로 한 번 더 불릴 수 있는데,
    // 그 최초 상태는 위 getSession()이 이미 처리한다 — 중복 전환을 피한다.
    if (!bootstrapped) return;
    void applySession(session?.user.id ?? null, session?.user.email ?? null);
  });

  return () => subscription.subscription.unsubscribe();
}
