// 의상 10벌 (설계 2026-10-31 「리아 의상 교체」 §1) + v0.22.0 새 의상 3벌. short: 대사 {outfit}에 넣는 짧은 이름(C16, 조사 없이).
// price: null = 판매 안 함. unlock = 판매 외 얻는 방법. desc = 의상실 설명(참고 그림의 문구를 그림 대신 여기에 씀)
// voice: 입으면 바뀌는 오류 설명 말투(data/errors.js의 같은 이름 칸). 탐정 말투는 탐험가(판정 C42)
export const OUTFITS = [
  { id: "basic", short: "기본복장", name: "기본복장 (교수)", price: null, unlock: "start", desc: "언제나 친절한 리아 교수!" },
  { id: "casual", short: "캐주얼룩", name: "캐주얼룩", price: 100, desc: "편하게 공부하는 것도 좋아요!" },
  { id: "whitecoat", short: "화이트 코트", name: "화이트 코트", price: 180, desc: "더 깊이 연구해볼까요?" },
  { id: "hoodie", short: "후드티", name: "후드티 (게임·스트리머)", price: 180, desc: "코딩도 게임처럼 재밌게!" },
  { id: "gym", short: "체육복", name: "체육복", price: 180, desc: "건강한 몸이 좋은 코드를 만들어요!" },
  { id: "chef", short: "요리사 옷", name: "요리사", price: 180, desc: "맛있는 코드는 어때요?" },
  { id: "explorer", short: "탐험가 옷", name: "탐험가", price: 240, desc: "새로운 것을 탐험하러 가볼까요?", voice: "detective" },
  { id: "uniform", short: "교복", name: "교복", price: 240, desc: "열심히 공부하는 리아!" },
  { id: "wizard", short: "마법사 망토", name: "판타지 마법사", price: 300, desc: "마법처럼 지식을 발견해요!" },
  { id: "graduate", short: "졸업 가운", name: "졸업 가운·학사모", price: null, unlock: "streak30", desc: "꾸준함이 졸업장을 만들어요!" },
  // v0.22.0 새 의상 3벌(설계 2026-11-17 §5-4, 작업 7). 배움이 깊어질수록: 연구를 발표하고 → 별을 보고 → 우주로. id는 저장에 남아 있어 바꾸지 않는다.
  // price는 data/shop.js 표와 같아야 한다(시험이 확인). 레벨 제한(18·23·28)은 data/shop.js에. 말투(voice)는 바꾸지 않는다.
  { id: "new1", short: "발표자 정장", name: "학회 발표자", price: 300, desc: "배운 것을 모두에게 나눠 볼까요?" },
  { id: "new2", short: "천문학자 옷", name: "천문학자", price: 360, desc: "별을 보며 더 큰 질문을 해요!" },
  { id: "new3", short: "우주복", name: "우주 연구원", price: 400, desc: "배움은 우주 끝까지 이어져요!" },
];

// saveVer 1 → 2 옮기기 표 (설계 §2). 새 짝이 있는 옛 의상은 이름만 바꾸고, 없어진 의상은 산 값만큼 바이트로 돌려준다.
export const OUTFIT_RENAME_V2 = Object.freeze({ lab: "whitecoat", chef: "chef", camping: "explorer", astronaut: "graduate" });
export const OUTFIT_REFUND_V2 = Object.freeze({ detective: 180, painter: 180, gardener: 180, rain: 240 });
