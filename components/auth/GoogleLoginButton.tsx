"use client";

// Google 공식 브랜딩 가이드(https://developers.google.com/identity/branding-guidelines)의
// Light 테마 규격(Fill #FFFFFF, 글자 #1F1F1F, Google Sans Medium 14/20 —
// Google Sans가 없는 환경에서는 시스템 sans로 자연히 대체) 위에, 이 카드
// 디자인이 지정한 테두리색(#E5E5E5)과 radius(6px)를 적용했다.

import { useAuthStore } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

// Google 공식 "G" 로고(표준 4색 마크) — Sign in with Google 버튼에 그대로
// 사용하도록 공식적으로 의도된 식별 마크다. 크기·색상 변경 없이 그대로 사용.
// export: 온보딩의 "연결된 계정" 영역(ConnectedAccountRow)에서도 같은 마크를
// 재사용한다 — 아이콘을 중복으로 따로 만들지 않는다.
export function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
    </svg>
  );
}

// Supabase Auth의 Google OAuth로 리다이렉트한다. 성공하면 Google → Supabase
// → 이 사이트로 돌아오고, lib/authSync.ts의 onAuthStateChange가 세션을 받아
// 저장소 전환/프로필 체이닝을 처리한다 — 여기서는 리다이렉트를 "시작"만
// 한다. NEXT_PUBLIC_SUPABASE_URL/ANON_KEY가 아직 설정되지 않은 환경(예:
// Supabase 설정 전의 로컬/배포)에서는 이전과 동일하게 아무 일도 하지 않고
// 개발 모드에서만 콘솔에 남긴다 — 실사용자에게는 아무것도 보이지 않는다.
export function GoogleLoginButton() {
  async function handleClick() {
    if (!supabase) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[dev] Google 로그인 — Supabase 환경변수가 아직 설정되지 않았습니다.");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    // 성공 시에는 즉시 Google로 리다이렉트되므로 이 함수로 돌아올 일이 없다
    // — 여기 도달하는 건 리다이렉트 자체가 시작조차 못 한 경우(네트워크 오류
    // 등)뿐이다. 취소/거부 후 돌아온 경우의 안내는 lib/authSync.ts가 URL의
    // error 쿼리를 보고 처리한다.
    if (error) {
      useAuthStore.getState().setLoginError("로그인을 시작하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-[46px] w-full items-center justify-center rounded-[6px] border border-[#E5E5E5] bg-white text-sm font-medium text-[#1F1F1F] transition hover:bg-black/[0.02] active:bg-black/[0.04]"
    >
      {/* 아이콘+텍스트를 하나의 그룹으로 묶어 버튼 전체 기준 가로·세로
          중앙에 오도록 한다 — 버튼 양 끝으로 벌어지지 않는다. */}
      <span className="flex items-center gap-3">
        <GoogleG />
        <span>Google로 로그인</span>
      </span>
    </button>
  );
}
