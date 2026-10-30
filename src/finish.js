// 레슨·복습이 끝났을 때 저장에 반영하는 순수 함수 (계획 작업 9).
// 순서: 개념 점수 → 보상 → XP·연속 기록(이정표) → 바이트 → 퀘스트 집계 → 통계·진도 → 배지
import { lessonReward, reviewReward, earnXp, markConcept } from "./rules.js";
import { tick, ensureQuests } from "./quests.js";
import { checkBadges } from "./badges.js";
import { localDate } from "./today.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * @param save  현재 저장(바꾸지 않음)
 * @param info  { lesson, mode: "lesson"|"review", perfect, accuracy, marks: [concept, outcome][],
 *               write: { passed, hintUsed, solutionSeen, fixedError } | null,
 *               itemsSolved, reviewCorrect, logs, nextLessonId, nextChapter }
 * @param now   Date
 */
export function finishLesson(save, info, now = new Date()) {
  const today = localDate(now);
  const isReview = info.mode === "review";
  const lesson = info.lesson || {};
  let s = structuredClone(save);
  s.stats = { lessons: 0, perfect: 0, hintfree: 0, fixed: 0, review_items: 0, items: 0, ...s.stats };

  for (const [concept, outcome] of info.marks || []) {
    if (concept) s = markConcept(s, concept, outcome);
  }

  const w = info.write || null;
  const firstTime = !isReview && !s.completed_lessons.includes(lesson.id);
  const hintFreeWrite = !isReview && !!(w && w.passed && !w.hintUsed && !w.solutionSeen);
  const fixedError = !isReview && !!(w && w.passed && w.fixedError && !w.solutionSeen);
  const perfect = !isReview && !!info.perfect;
  const reward = isReview
    ? reviewReward()
    : lessonReward({ firstTime, perfect, hintFreeWrite, isExam: !!lesson.isExam });

  const goalBefore = s.streak.lastGoalDate;
  const bytesBeforeXp = num(s.bytes);
  const earned = earnXp(s, reward.xp, today);
  s = earned.save;
  const milestoneBytes = num(s.bytes) - bytesBeforeXp;
  const streakUp = s.streak.lastGoalDate === today && goalBefore !== today;
  s.bytes = num(s.bytes) + reward.bytes;

  // 퀘스트 집계
  s = ensureQuests(s, today);
  const bytesBeforeQuests = s.bytes;
  const finished = [];
  let chest = false;
  const ev = (name, amount = 1) => {
    if (amount <= 0) return;
    const r = tick(s, name, today, amount);
    s = r.save;
    finished.push(...r.finished);
    chest = chest || r.chest;
  };
  if (!isReview) ev("lesson_done");
  ev("xp", reward.xp);
  if (hintFreeWrite) ev("hintfree_pass");
  if (fixedError) ev("fixed_error_pass");
  if (perfect) ev("perfect_lesson");
  if (isReview) ev("review_item", num(info.reviewCorrect));
  const questBytes = s.bytes - bytesBeforeQuests;

  // 통계
  const st = { ...s.stats };
  if (!isReview) st.lessons += 1;
  if (perfect) st.perfect += 1;
  if (hintFreeWrite) st.hintfree += 1;
  if (fixedError) st.fixed += 1;
  if (isReview) st.review_items += num(info.reviewCorrect);
  st.items += num(info.itemsSolved);
  s.stats = st;

  // 진도
  if (!isReview) {
    if (!s.completed_lessons.includes(lesson.id)) s.completed_lessons = [...s.completed_lessons, lesson.id];
    const prev = s.grading_results[lesson.id] || {};
    s.grading_results = {
      ...s.grading_results,
      [lesson.id]: { perfect: !!prev.perfect || perfect, attempts: num(prev.attempts) + 1 },
    };
    if (info.nextLessonId) s.current_lesson = info.nextLessonId;
    if (info.nextChapter) s.current_chapter = info.nextChapter;
  }
  s.submission_logs = [...(s.submission_logs || []), ...(info.logs || [])].slice(-50);
  s.last_active_at = now.toISOString();

  // 배지 (이정표 100일 배지는 earnXp가 이미 넣음)
  const got = checkBadges(s, { hour: now.getHours(), lessonDone: !isReview });
  s.badges = [...s.badges, ...got];
  const had = new Set(save.badges || []);
  const newBadges = s.badges.filter((b) => !had.has(b));

  return {
    save: s,
    result: {
      mode: info.mode, lessonId: lesson.id, xp: reward.xp, lessonBytes: reward.bytes, questBytes, milestoneBytes,
      totalBytes: num(s.bytes) - num(save.bytes),
      finished, chest, newBadges, milestone: earned.milestone, streakUp, streak: s.streak.days,
      firstTime, perfect, hintFreeWrite, accuracy: info.accuracy,
    },
  };
}

/** 설정에서 하루 목표를 바꿀 때: 이미 모은 오늘 XP로 목표를 채웠으면 그날을 인정(XP 0 적립) */
export function applyGoalChange(save, goal, today) {
  const s0 = { ...save, settings: { ...save.settings, dailyGoal: goal } };
  const before = s0.streak.lastGoalDate;
  const r = earnXp(s0, 0, today);
  return { save: r.save, milestone: r.milestone, streakUp: r.save.streak.lastGoalDate === today && before !== today };
}
