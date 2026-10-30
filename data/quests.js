// 일일 퀘스트 표 (설계서 5-3). key = tick()에 들어오는 사건 이름
export const QUESTS = [
  { id: "q_lessons2", name: "레슨 2개 완료하기", key: "lesson_done", goal: 2, reward: 5 },
  { id: "q_xp20", name: "XP 20 얻기", key: "xp", goal: 20, reward: 5 },
  { id: "q_hintfree", name: "힌트 없이 코드 통과하기", key: "hintfree_pass", goal: 1, reward: 8 },
  { id: "q_fixerr", name: "오류 난 코드를 고쳐서 통과하기", key: "fixed_error_pass", goal: 1, reward: 8 },
  { id: "q_review3", name: "틀린 문제 3개 복습하기", key: "review_item", goal: 3, reward: 5 },
  { id: "q_perfect", name: "실수 없이 레슨 끝내기", key: "perfect_lesson", goal: 1, reward: 8 },
];
