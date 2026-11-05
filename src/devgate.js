// 개발자 모드(검수용) 잠금 판정의 한 곳. 다른 파일을 부르지 않는다(daily·quests·garden이 모두 이 파일을 부름).
// - 개발자 모드가 켜져 있으면 앱은 따로 둔 개발자 저장(ria-python.dev.save)을 쓰고, 그 저장에 표시 DEV_MARK: true가 붙는다
//   (src/devmode.js가 읽고 쓸 때 붙이고, 학습 기록에 쓸 때는 뺀다).
// - 잠금 판정은 isDev(save)만 본다: 레슨 순서(curriculum.lessonStateOf), 심화(advanced.advancedState),
//   매일 도전(daily: gateCompleted), 텃밭(garden/state.passedChapters), 텃밭 퀘스트(quests.gardenOrderOpen).
// - 열어 주기만 한다. 저장의 completed_lessons·배지·과정 완주는 실제로 한 것으로만 정해진다.

export const DEV_MARK = "dev_mode";

/** 이 저장이 개발자 모드 저장인가 */
export const isDev = (save) => !!save && typeof save === "object" && save[DEV_MARK] === true;

/** 본 과정 레슨 id 전부(장 순서) */
export function mainLessonIds(chapters) {
  return (chapters || []).flatMap((c) => (c.lessons || []).map((l) => l.id));
}

/** 잠금 판정에 쓸 끝낸 레슨 목록: 개발자 저장이면 본 과정 전부를 끝낸 것으로 본다(저장 자체는 바꾸지 않음) */
export function gateCompleted(save, chapters) {
  const done = (save && Array.isArray(save.completed_lessons)) ? save.completed_lessons : [];
  if (!isDev(save)) return done;
  return [...new Set([...done, ...mainLessonIds(chapters)])];
}
