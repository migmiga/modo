"use client";

import { useAuthStore } from "@/lib/auth";

import { GoogleG } from "./GoogleLoginButton";
import { useLoginGate } from "./LoginGateProvider";

const KAKAO_SYMBOL_SRC = "/images/kakao_login_light.svg";
// 개발 환경에서만 보여줄 예시 이메일 — 어떤 store에도 저장하지 않는 UI 전용
// 리터럴이다. 아래 사용처가 NODE_ENV 가드 안에 있어 프로덕션 빌드에서는 이
// 문자열 자체가 번들에서 제거된다(런타임 숨김이 아니라 빌드 시점 제거).
const DEV_EXAMPLE_EMAIL = "abc1234@gmail.com";

// 프로필 설정 화면 상단에 현재 로그인 상태를 보여주는, 순수 정보 표시용 행.
// 실제 OAuth가 아직 없어 "google"/"kakao" 경로는 당장은 도달하지 않지만,
// 연동되었을 때 그대로 쓸 수 있게 미리 만들어둔다. 개발용 임시 로그인은
// "연결 완료"로 보이면 안 되므로 별도 배지로 분리한다.
export function ConnectedAccountRow() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const provider = useAuthStore((s) => s.provider);
  const email = useAuthStore((s) => s.email);
  const { open } = useLoginGate();

  if (isLoggedIn && provider === "dev") {
    return (
      <div className="flex items-center gap-2.5 rounded-[12px] border border-dashed border-border bg-surface px-3 py-2.5">
        {/* 실제 OAuth 연결이 아니므로 "연결 완료" 칩 대신 모양이 뚜렷하게
            다른 배지를 쓴다 — accent 색상도 쓰지 않는다. */}
        <span className="shrink-0 rounded-badge bg-border px-2.5 py-1 text-[11px] font-medium text-muted">
          개발용 로그인
        </span>
        {process.env.NODE_ENV !== "production" && (
          <span className="min-w-0 flex-1 truncate text-sm text-muted">{DEV_EXAMPLE_EMAIL}</span>
        )}
      </div>
    );
  }

  if (isLoggedIn && (provider === "google" || provider === "kakao")) {
    return (
      <div className="flex items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2.5">
        {provider === "google" ? (
          <GoogleG />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 정적 SVG, 원본 비율 그대로.
          <img src={KAKAO_SYMBOL_SRC} alt="" width={20} height={20} className="shrink-0" />
        )}
        {/* 이메일을 못 받은 경우 임의로 채우지 않고 빈 공간만 남겨, 칩은
            항상 오른쪽 끝에 고정된다. */}
        {email ? (
          <span className="min-w-0 flex-1 truncate text-sm text-foreground" data-amp-mask="">
            {email}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {/* 클릭 불가 상태 표시 전용 — button이 아닌 span, hover/클릭 이벤트 없음. */}
        <span className="shrink-0 rounded-badge bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
          연결 완료
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3 py-2.5">
      <span className="text-sm text-muted">연결된 계정이 없어요</span>
      <button
        type="button"
        onClick={() => open()}
        className="shrink-0 text-xs font-medium text-accent underline"
      >
        연결하기
      </button>
    </div>
  );
}
