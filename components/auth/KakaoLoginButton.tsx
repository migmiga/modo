"use client";

// 카카오 공식 로그인 버튼 에셋(개발자가 developers.kakao.com에서 받아 추가함).
// 원본이 이미 336x46, 모서리 rx=8로 만들어져 있어 그대로 쓴다 — 별도
// border-radius·object-fit 보정이나 내부 경로 수정을 하지 않는다.
const KAKAO_ASSET_SRC = "/images/kakao_login_kr_large.svg";

// 실제 카카오 로그인 연동 전 단계 — 클릭해도 로그인 성공 처리나 데이터
// 저장은 하지 않는다. GoogleLoginButton.tsx와 동일한 이유로 화면 안내는 두지
// 않고 개발 환경 콘솔 로그만 남긴다.
export function KakaoLoginButton() {
  function handleClick() {
    if (process.env.NODE_ENV !== "production") {
      console.info("[dev] 카카오 로그인 — 아직 실제 OAuth가 연결되지 않았습니다.");
    }
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- 공식 카카오
          버튼 SVG를 원본 크기(336x46) 그대로 사용한다. */}
      <img src={KAKAO_ASSET_SRC} alt="카카오 로그인" width={336} height={46} className="w-full" />
    </button>
  );
}
