// 리아 교수 대사 표 — 상황 12종 × 4~5줄 (설계서 6-2·6-3, ledger 「공통 이름」)
// 표정: smile joy sparkle think surprise worry cheer wink
// 자리 표시: {name} {streak} {xp} {outfit}
//   {outfit}에는 의상 표의 short 이름이 들어간다(C16). 조사가 붙지 않는 자리에만 쓴다.
//   {streak}·{xp}·{outfit} 값이 없으면 say()가 그 줄을 건너뛴다. 상황마다 자리 표시 없는 줄을 하나 이상 둔다.
// {name}은 줄 맨 앞에 「{name}님, 」 꼴로 한 번만 쓴다.
//   이름이 비어 있으면 say()가 이 덩어리를 통째로 빼므로 문장이 그대로 자연스럽다.
//   (문장 가운데 「{name}님이」처럼 쓰면 빼고 나서 조사가 남으므로 금지. 시험 name_form)

export const LINES = {
  greet: [
    { text: "{name}님, 어서 와요. 오늘도 한 줄씩 가 봐요.", face: "smile" },
    { text: "왔군요! 커피는 제가 맡을 테니, 코드는 부탁해요.", face: "wink" },
    { text: "이 브로치요? 당연히 파이썬이죠. 물지는 않아요.", face: "wink" },
    { text: "오늘 목표는 딱 하나. 어제보다 한 줄 더요.", face: "cheer" },
    { text: "{name}님, 자리 맡아 뒀어요. 시작해 볼까요?", face: "joy" },
  ],
  correct: [
    { text: "딩동! 정확히 짚었어요.", face: "joy" },
    { text: "맞아요. 이유까지 알고 고른 게 보여요.", face: "smile" },
    { text: "깔끔해요. 파이썬도 고개를 끄덕였어요.", face: "sparkle" },
    { text: "정답이에요. 방금 그 감각, 기억해 둬요.", face: "cheer" },
  ],
  combo: [
    { text: "척척! 연속 정답이에요. 흐름을 탔네요.", face: "sparkle" },
    { text: "이 정도면 파이썬이 말을 잘 듣겠는걸요.", face: "wink" },
    { text: "연달아 맞혔어요. 개념이 단단히 잡혔다는 뜻이에요.", face: "joy" },
    { text: "멈출 생각 없죠? 그 속도 좋아요.", face: "cheer" },
  ],
  wrong: [
    { text: "아까워요. 어디서 갈렸는지 같이 볼까요?", face: "think" },
    { text: "괜찮아요. 틀린 답에도 단서가 숨어 있어요.", face: "smile" },
    { text: "음, 한 번 더 읽어 봐요.", face: "think" },
    { text: "저도 처음엔 여기서 자주 미끄러졌어요.", face: "worry" },
    { text: "좋은 시도예요. 다음엔 문제를 한 줄씩 짚어 봐요.", face: "cheer" },
  ],
  running: [
    { text: "타닥타닥… 파이썬이 열심히 읽는 중이에요.", face: "think" },
    { text: "실행 중이에요. 결과가 뭐라고 할지 궁금하죠?", face: "smile" },
    { text: "한 줄씩 차례로 달리는 중. 잠깐만요.", face: "think" },
    { text: "뱀은 빠르답니다. 조금만 기다려요.", face: "wink" },
  ],
  error: [
    { text: "어라? 단서가 나왔어요. 몇 번째 줄인지 봐요.", face: "surprise" },
    { text: "오류 메시지는 꾸중이 아니라 단서예요.", face: "smile" },
    { text: "단서 발견! 표시된 줄 근처를 같이 살펴봐요.", face: "think" },
    { text: "파이썬이 길을 잃었대요. 어디서인지 알려 줬어요.", face: "worry" },
  ],
  hint: [
    { text: "힌트 하나 드릴게요. 정답은 직접 찾아요.", face: "wink" },
    { text: "먼저 결과가 무엇이어야 하는지 떠올려 봐요.", face: "think" },
    { text: "막힐 땐 한 줄씩 소리 내어 읽어 보면 좋아요.", face: "smile" },
    { text: "이 단서로 한 걸음 더 가 봐요.", face: "cheer" },
  ],
  lesson_done: [
    { text: "짠! 레슨 완료. {xp} XP 받았어요.", face: "joy" },
    { text: "{name}님, 끝까지 해냈어요. 오늘 배운 건 이제 진짜 실력이에요.", face: "sparkle" },
    { text: "수고했어요. {xp} XP만큼 한 뼘 자랐네요.", face: "smile" },
    { text: "완주! 다음 레슨도 준비해 둘게요.", face: "cheer" },
  ],
  course_done: [
    { text: "{name}님, print 한 줄에서 그래프까지 전부 왔어요. 정말 자랑스러워요!", face: "sparkle" },
    { text: "과정 완주! 이제 배운 걸로 나만의 프로그램을 만들어 봐요.", face: "joy" },
    { text: "끝까지 해냈어요. 이제 어엿한 파이썬 사용자예요.", face: "cheer" },
  ],
  streak_up: [
    { text: "연속 {streak}일째! 꾸준함이 제일 센 기술이에요.", face: "sparkle" },
    { text: "{name}님, {streak}일째예요. 습관이 자라고 있어요.", face: "joy" },
    { text: "연속 {streak}일. 뱀처럼 길게 이어 가 봐요.", face: "wink" },
    { text: "오늘 목표 달성! 꾸준함이 차곡차곡 쌓여요.", face: "joy" },
    { text: "오늘도 해냈어요. 연속 {streak}일 달성!", face: "cheer" },
  ],
  streak_broken: [
    { text: "다시 1일부터, 이번엔 더 길게 가 봐요.", face: "cheer" },
    { text: "쉬어 가는 날도 있죠. 배운 건 그대로 남아 있어요.", face: "smile" },
    { text: "기록은 숫자일 뿐, 실력은 안 줄었어요.", face: "smile" },
    { text: "{name}님, 다시 와서 반가워요. 오늘 새로 시작해요!", face: "joy" },
  ],
  outfit_bought: [
    { text: "{outfit}, 어때요? 잘 어울리나요?", face: "sparkle" },
    { text: "{outfit}, 마음에 들어요. 오늘은 이걸로 할게요.", face: "joy" },
    { text: "새 의상 {outfit}! 고르는 안목이 있네요.", face: "wink" },
    { text: "옷은 바뀌어도 브로치는 그대로예요. 짝꿍이거든요.", face: "smile" },
  ],
  welcome_back: [
    { text: "{name}님, 오랜만이에요! 잘 지냈어요?", face: "surprise" },
    { text: "돌아왔군요. 가볍게 복습부터 해 볼까요?", face: "smile" },
    { text: "기다리고 있었어요. 파이썬도 얌전히 있었고요.", face: "wink" },
    { text: "어디까지 했는지 다 기억해 뒀어요. 이어서 가요.", face: "cheer" },
  ],
};

// 모르는 상황일 때 쓰는 중립 대사
export const FALLBACK_LINE = { text: "천천히 해도 괜찮아요. 저는 여기 있어요.", face: "smile" };
