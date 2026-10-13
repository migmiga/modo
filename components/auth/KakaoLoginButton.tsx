"use client";

// 카카오 공식 로그인 버튼 에셋(개발자가 developers.kakao.com에서 받아 추가함).
// 원본이 이미 336x46, 모서리 rx=8로 만들어져 있어 그대로 쓴다 — 별도
// border-radius·object-fit 보정이나 내부 경로 수정을 하지 않는다.
const KAKAO_ASSET_SRC = "/images/kakao_login_kr_large.svg";

// 이번 UT 범위에서는 Google만 실제로 연동하고, 카카오는 아직 붙이지 않는다
// — 참가자가 눌러도 아무 반응이 없는 걸 혼동하지 않도록 클릭 자체를 막고
// "준비 중" 배지를 올린다. <button>이 아니라 순수 표시용 <div>로 바꿔
// 클릭/키보드 포커스 둘 다 가지 않게 한다. 자산·마크업 구조는 그대로 둬서
// 추후 연동 시 이 배지만 제거하면 된다.
export function KakaoLoginButton() {
  return (
    <div className="relative block w-full" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- 공식 카카오
          버튼 SVG를 원본 크기(336x46) 그대로 사용한다. */}
      <img
        src={KAKAO_ASSET_SRC}
        alt=""
        width={336}
        height={46}
        className="w-full opacity-40"
      />
      <span className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-white/50 text-xs font-medium text-[#3C1E1E]">
        준비 중
      </span>
    </div>
  );
}
