import type { Occupation, ProfileField, ProfileStatus } from "./types";

// 레거시 — 이전 버전 온보딩 데이터 표시(SideNav 폴백)용으로만 남겨둔다.
// 새 가입 흐름은 FIELD_OPTIONS/OCCUPATION_OPTIONS를 쓴다.
export const PROFILE_STATUS_OPTIONS: { value: ProfileStatus; label: string }[] = [
  { value: "job_seeker", label: "취업 준비 중" },
  { value: "employee", label: "직장인" },
  { value: "student", label: "학생" },
  { value: "freelancer", label: "프리랜서" },
  { value: "other", label: "기타" },
];

export const FIELD_OPTIONS: { value: ProfileField; label: string }[] = [
  { value: "humanities_social", label: "인문·사회" },
  { value: "business_economics", label: "상경·경영" },
  { value: "engineering_it", label: "공학·IT" },
  { value: "natural_science", label: "자연과학" },
  { value: "medicine_health", label: "의약·보건" },
  { value: "law", label: "법률" },
  { value: "education", label: "교육" },
  { value: "arts_sports", label: "예술·체육" },
  { value: "design", label: "디자인" },
  { value: "media_content", label: "미디어·콘텐츠" },
  { value: "public_administration", label: "공공·행정" },
  { value: "agriculture_fishery", label: "농림·수산" },
  { value: "service", label: "서비스업" },
  { value: "none", label: "해당 없음" },
  { value: "other", label: "기타" },
];

export const OCCUPATION_OPTIONS: { value: Occupation; label: string }[] = [
  { value: "middle_high_school", label: "중·고등학생" },
  { value: "university", label: "대학생" },
  { value: "graduate_school", label: "대학원생" },
  { value: "employee", label: "직장인" },
  { value: "professional", label: "전문직" },
  { value: "public_servant", label: "공무원" },
  { value: "self_employed_freelancer", label: "자영업·프리랜서" },
  { value: "job_seeker", label: "취업준비생" },
  { value: "startup_prep", label: "창업준비생" },
  { value: "unemployed", label: "무직" },
  { value: "other", label: "기타" },
];
