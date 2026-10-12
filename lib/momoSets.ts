// 모모의 7가지 변신 세트 — 당일 전체 완료 회고를 성공적으로(새로) 제출할 때마다
// 다음 세트로 넘어가고, 7번째 다음에는 다시 1번으로 순환한다. 순환 기준은 날짜가
// 아니라 store.ts의 fullRetroSubmitCount(제출 성공 횟수)이며, 그 카운트가 곧 이
// 배열의 순서를 그대로 가리킨다 — 즉 이 배열의 길이가 순환 주기(7)의 단일 소스.
//
// imageSrc는 실제 모모 변신 이미지가 준비되면 채워 넣을 자리. 비어 있는 동안은
// CelebrationStep이 각 세트에 맞는 임시 아이콘(기존 tabler 아이콘 라이브러리)을
// 대신 그린다 — imageSrc만 채우면 레이아웃 변경 없이 바로 실제 이미지로 교체된다.
export interface MomoSet {
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

export const MOMO_SETS: MomoSet[] = [
  { title: "오늘도 수고 많으셨어요!", subtitle: "열심히 달린 당신에게, 치얼스!", imageSrc: null }, // 1. 맥주잔 구름
  { title: "오늘도 멋지게 마무리했어요!", subtitle: "편안하고 따뜻한 저녁 보내세요!", imageSrc: null }, // 2. 초승달 구름
  { title: "오늘의 나에게 박수를!", subtitle: "오늘의 노력만큼은 금메달감이에요!", imageSrc: null }, // 3. 트로피 구름
  {
    title: "오늘의 나에게 하트 하나!",
    subtitle: "애쓴 만큼 나를 아껴주는 것도 잊지 마세요.",
    imageSrc: null,
  }, // 4. 하트 구름
  { title: "오늘도 한 뼘 자랐어요!", subtitle: "작은 노력들이 모여 꽃을 피울 거예요.", imageSrc: null }, // 5. 꽃 구름
  {
    title: "오늘도 반짝이는 하루였어요!",
    subtitle: "내일도 당신의 하루가 환하게 빛나길!",
    imageSrc: null,
  }, // 6. 햇살 구름
  {
    title: "오늘도 한 걸음 더 나아갔어요!",
    subtitle: "작은 시작이 모여 더 멀리 날아갈 거예요.",
    imageSrc: null,
  }, // 7. 로켓 구름
];
