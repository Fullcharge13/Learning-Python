// 의상 9벌 (설계서 5-4). short: 대사 {outfit}에 넣는 짧은 이름(C16). price: null = 판매 안 함. unlock = 판매 외 얻는 방법
export const OUTFITS = [
  { id: "basic", short: "기본 재킷", name: "기본 (터틀넥 + 재킷 + 뱀 브로치)", price: null, unlock: "start" },
  { id: "lab", short: "연구실 가운", name: "연구실 가운 + 커피", price: 100 },
  { id: "detective", short: "탐정 코트", name: "탐정 (체크 코트 + 돋보기)", price: 180 },
  { id: "chef", short: "요리사 옷", name: "요리사", price: 180 },
  { id: "painter", short: "화가 앞치마", name: "화가 (베레모 + 팔레트)", price: 180 },
  { id: "gardener", short: "정원사 옷", name: "정원사 (밀짚모자 + 물뿌리개)", price: 180 },
  { id: "rain", short: "노란 우비", name: "비 오는 날 (노란 우비)", price: 240 },
  { id: "camping", short: "캠핑 패딩", name: "캠핑 (패딩 + 비니)", price: 240 },
  { id: "astronaut", short: "우주복", name: "우주인", price: null, unlock: "streak30" },
];
