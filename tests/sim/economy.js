// 작업 12. 바이트 경제 시뮬레이션 — 가상 학습자 30일 × 12판(씨앗 1~12)
// 실행: node tests/sim/economy.js
// 실제 규칙 모듈(src/rules.js, src/quests.js, src/shop.js, src/badges.js)을 고치지 않고 그대로 부른다.
//
// 해석(보고서에 함께 적음):
// - 빠짐: 「30일 중 3일 빠짐(그중 하루는 이틀 연속)」 = 빠짐 3번, 그중 1번은 이틀 → 빠진 날 4일, 학습한 날 26일.
//   첫날(1일째)은 언제나 학습. 빠짐끼리는 붙지 않게(사이에 학습한 날이 적어도 하루) 둔다.
// - 레슨: 터치 문제 6개 + 직접 작성 1개. 레슨마다 정확도 p를 70~90%에서 고르고, 터치 문제는 각각 p 확률로 맞힘.
//   직접 작성은 첫 제출 오류 30% → 고쳐서 통과(fixed_error_pass). 첫 제출 오류도 실수로 보아 실수 없는 레슨이 아님.
//   힌트 없이 통과 50%(오류 여부와 따로).
//   틀린 문제는 markConcept(wrong) 후 다시 풀어 맞힘(재도전은 복습 퀘스트에 세지 않음). 맞힌 문제는 markConcept(right).
// - 실제 레슨 표(data/lessons/ch*.js)를 차례로(--lessons N 이면 앞의 N개; 15면 v0.1 재현). 다 끝낸 뒤 한 판은 복습 목록이 있으면 복습(5문제, 5 XP),
//   없으면 처음 레슨부터 다시 하기(XP 절반, 바이트 0).
// - 레슨마다 id, isExam, 쓰기 문제의 개념만 읽어 쓴다(터치 문제도 그 개념으로 표시).
// - 쇼핑은 학습한 날 끝에: 보호권이 0개이고 200바이트 이상이면 보호권 1개를 먼저, 그다음 살 수 있는 가장 싼 의상.
//   (「strict」 방식: 보호권이 0개면 의상을 사지 않고 보호권 값을 먼저 모음 — 비교용으로만 계산)
import { readdirSync } from "node:fs";
import { newSave } from "../../src/save.js";
import { lessonReward, reviewReward, earnXp, rollDay, buyFreeze, markConcept, FREEZE_PRICE } from "../../src/rules.js";
import { ensureQuests, tick } from "../../src/quests.js";
import { checkBadges } from "../../src/badges.js";
import { buy } from "../../src/shop.js";
import { OUTFITS } from "../../data/outfits.js";

const DAYS = 30;
const START = "2026-11-02";
const LESSONS_PER_DAY = 2;
const TOUCH_ITEMS = 6;
const HINTFREE_P = 0.5;
const WRITE_ERROR_P = 0.3;

// 실제 레슨 표(data/lessons/ch*.js)를 장 번호순으로 읽는다. 경제에는 id·장 평가 여부·쓰기 문제의 개념만 쓰인다.
async function loadCourse() {
  const dir = new URL("../../data/lessons/", import.meta.url);
  const files = readdirSync(dir).filter((f) => /^ch\d+\.js$/.test(f))
    .sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
  const course = [];
  for (const f of files) {
    try {
      const mod = await import(new URL(f, dir).href);
      for (const l of mod.LESSONS) {
        const w = (l.items || []).find((it) => it.type === "write");
        course.push({ id: l.id, isExam: !!l.isExam, concepts: [w ? w.concept : "print"] });
      }
    } catch (e) {
      console.error(`(건너뜀: ${f} — ${e.message})`);
    }
  }
  return course;
}
const FULL_COURSE = await loadCourse();

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(d, n) {
  const ms = Date.parse(d + "T00:00:00Z") + n * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// 빠지는 날(0부터 센 날 번호) 4개: 1일짜리 2번 + 2일짜리 1번, 겹치거나 붙지 않게
function pickSkips(rng) {
  for (;;) {
    const lens = [2, 1, 1];
    const skip = new Set();
    let ok = true;
    for (const len of lens) {
      const start = 1 + Math.floor(rng() * (DAYS - len)); // 1..DAYS-len
      for (let i = -1; i <= len; i++) if (skip.has(start + i)) ok = false; // 앞뒤 하루 띄움
      if (!ok) break;
      for (let i = 0; i < len; i++) skip.add(start + i);
    }
    if (ok) return skip;
  }
}

function cheapestOutfit(save) {
  const forSale = OUTFITS.filter((o) => o.price != null && !save.outfits.includes(o.id));
  forSale.sort((a, b) => a.price - b.price);
  return forSale[0] || null;
}

export function runSim(seed, { policy = "plan", lessons = null } = {}) {
  const COURSE = lessons ? FULL_COURSE.slice(0, lessons) : FULL_COURSE;
  const rng = mulberry32(seed);
  const skips = pickSkips(rng);
  let s = newSave();
  let earned = 0;
  let activeDays = 0;
  let firstOutfitDay = null;
  let freezesUsed = 0;
  let streakBroken = 0;
  let freezesBought = 0;
  const milestones = [];
  const src = { lesson: 0, quest: 0, milestone: 0 };
  let replayIdx = 0;
  let newPhaseEarned = 0, newPhaseDays = 0, lastNewDay = null;
  const daily = [];

  // 바이트 변화를 따로 셈(쓰기 전)
  const gain = (before, after, kind) => {
    const d = after.bytes - before.bytes;
    if (d > 0) { earned += d; src[kind] += d; }
  };
  const doTick = (event, today, amount = 1) => {
    const prev = s;
    s = tick(s, event, today, amount).save;
    gain(prev, s, "quest");
  };
  const doXp = (xp, today) => {
    const prev = s;
    const r = earnXp(s, xp, today);
    s = r.save;
    if (r.milestone) milestones.push(r.milestone);
    gain(prev, s, "milestone");
    doTick("xp", today, xp);
  };
  const badges = () => {
    const got = checkBadges(s, { lessonDone: true, hour: 20 });
    if (got.length) s = { ...s, badges: [...s.badges, ...got] };
  };

  function playLesson(lesson, firstTime, today) {
    const p = 0.7 + 0.2 * rng();
    let wrong = 0;
    for (let i = 0; i < TOUCH_ITEMS; i++) {
      const c = lesson.concepts[i % lesson.concepts.length];
      if (rng() < p) s = markConcept(s, c, "right");
      else { wrong++; s = markConcept(s, c, "wrong"); s = markConcept(s, c, "right"); } // 다시 풀어 맞힘
    }
    const wc = lesson.concepts[0];
    const writeErr = rng() < WRITE_ERROR_P;
    const hintFree = rng() < HINTFREE_P;
    if (writeErr) { wrong++; s = markConcept(s, wc, "wrong"); }
    if (!hintFree) s = markConcept(s, wc, "hint");
    if (!writeErr && hintFree) s = markConcept(s, wc, "right");
    const perfect = wrong === 0;

    const rw = lessonReward({ firstTime, perfect, hintFreeWrite: hintFree, isExam: lesson.isExam });
    const prev = s;
    s = {
      ...s,
      bytes: s.bytes + rw.bytes,
      completed_lessons: firstTime ? [...s.completed_lessons, lesson.id] : s.completed_lessons,
      stats: {
        ...s.stats,
        lessons: s.stats.lessons + 1,
        perfect: s.stats.perfect + (perfect ? 1 : 0),
        hintfree: s.stats.hintfree + (hintFree ? 1 : 0),
        fixed: s.stats.fixed + (writeErr ? 1 : 0),
      },
    };
    gain(prev, s, "lesson");
    doXp(rw.xp, today);
    doTick("lesson_done", today);
    if (hintFree) doTick("hintfree_pass", today);
    if (writeErr) doTick("fixed_error_pass", today);
    if (perfect) doTick("perfect_lesson", today);
    badges();
  }

  function playReview(today) {
    // 취약 개념 문제 5개, 정확도 70~90%; 맞히면 right, 틀리면 wrong 뒤 다시 풀어 right
    const p = 0.7 + 0.2 * rng();
    for (let i = 0; i < 5; i++) {
      if (s.review_queue.length === 0) break;
      const c = s.review_queue[i % s.review_queue.length];
      if (rng() >= p) s = markConcept(s, c, "wrong");
      s = markConcept(s, c, "right");
    }
    s = { ...s, stats: { ...s.stats, review_items: s.stats.review_items + 5 } };
    doTick("review_item", today, 5);
    doXp(reviewReward().xp, today);
    badges();
  }

  function shop(dayNo) {
    if (s.freezes < 1 && s.bytes >= FREEZE_PRICE) {
      const r = buyFreeze(s);
      if (!(r instanceof Error)) { s = r; freezesBought++; }
    }
    if (policy === "strict" && s.freezes < 1) return;
    for (;;) {
      const o = cheapestOutfit(s);
      if (!o || s.bytes < o.price) break;
      const r = buy(s, o.id);
      if (r instanceof Error) break;
      s = r;
      if (firstOutfitDay === null) firstOutfitDay = dayNo;
    }
    badges();
  }

  for (let d = 0; d < DAYS; d++) {
    if (skips.has(d)) continue;
    const today = addDays(START, d);
    activeDays++;
    const rd = rollDay(s, today);
    s = rd.save;
    freezesUsed += rd.usedFreezes;
    if (rd.broke) streakBroken++;
    s = ensureQuests(s, today);
    const earnedBefore = earned;
    let newToday = false;
    for (let k = 0; k < LESSONS_PER_DAY; k++) {
      const next = COURSE.find((l) => !s.completed_lessons.includes(l.id));
      if (next) { playLesson(next, true, today); newToday = true; lastNewDay = d + 1; }
      else if (s.review_queue.length > 0) playReview(today);
      else { playLesson(COURSE[replayIdx % COURSE.length], false, today); replayIdx++; }
    }
    shop(d + 1);
    const de = earned - earnedBefore;
    daily.push({ day: d + 1, bytes: de, xp: s.streak.todayXp, streak: s.streak.days });
    if (newToday) { newPhaseEarned += de; newPhaseDays++; }
  }

  return {
    seed,
    courseLength: COURSE.length,
    activeDays,
    bytesPerActiveDay: Math.round((earned / activeDays) * 10) / 10,
    bytesPerNewLessonDay: Math.round((newPhaseEarned / newPhaseDays) * 10) / 10,
    courseDoneDay: lastNewDay,
    goalMissDays: daily.filter((x) => x.xp < 20).length,
    firstOutfitDay,
    freezesUsed,
    freezesBought,
    streakBroken,
    finalStreak: s.streak.days,
    outfitsOwned: s.outfits.filter((o) => o !== "basic").length,
    milestones,
    sources: { lesson: src.lesson, quest: src.quest, milestone: src.milestone },
    skipDays: [...skips].sort((a, b) => a - b).map((x) => x + 1),
    badges: s.badges.length,
    endBytes: s.bytes,
  };
}

function median(xs) {
  const v = xs.filter((x) => x !== null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function main() {
  const li = process.argv.indexOf("--lessons");
  const lessons = li > 0 ? parseInt(process.argv[li + 1]) : null;
  console.log(`레슨 ${lessons ? Math.min(lessons, FULL_COURSE.length) : FULL_COURSE.length}개로 시뮬레이션 (불러온 전체 ${FULL_COURSE.length}개)\n`);
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
  const runs = seeds.map((sd) => runSim(sd, { lessons }));
  const strict = seeds.map((sd) => runSim(sd, { policy: "strict", lessons }));
  const med = (f, rs = runs) => { const m = median(rs.map(f)); return m === null ? "-" : Math.round(m * 10) / 10; };
  const head = ["seed", "B/active day", "B/day (new lessons)", "course done day", "1st outfit day", "1st outfit (strict)",
    "freezes bought/used", "goal-miss days", "streak broken", "final streak", "outfits", "milestones", "skip days", "bytes lesson/quest/milestone"];
  const rows = runs.map((r, i) => [
    r.seed, r.bytesPerActiveDay, r.bytesPerNewLessonDay, r.courseDoneDay, r.firstOutfitDay ?? "-", strict[i].firstOutfitDay ?? "-",
    `${r.freezesBought}/${r.freezesUsed}`, r.goalMissDays, r.streakBroken, r.finalStreak, r.outfitsOwned,
    r.milestones.join(",") || "-", r.skipDays.join(","), `${r.sources.lesson}/${r.sources.quest}/${r.sources.milestone}`,
  ]);
  rows.push([
    "**median**", med((r) => r.bytesPerActiveDay), med((r) => r.bytesPerNewLessonDay), med((r) => r.courseDoneDay),
    med((r) => r.firstOutfitDay), med((r) => r.firstOutfitDay, strict),
    `${med((r) => r.freezesBought)}/${med((r) => r.freezesUsed)}`, med((r) => r.goalMissDays), med((r) => r.streakBroken),
    med((r) => r.finalStreak), med((r) => r.outfitsOwned), `7일: ${runs.filter((r) => r.milestones.includes(7)).length}/12판`, "", "",
  ]);
  console.log("| " + head.join(" | ") + " |");
  console.log("|" + head.map(() => "---").join("|") + "|");
  for (const row of rows) console.log("| " + row.join(" | ") + " |");

  const bpd = med((r) => r.bytesPerActiveDay);
  const bnew = med((r) => r.bytesPerNewLessonDay);
  const fod = med((r) => r.firstOutfitDay);
  const inB = (x) => x >= 40 && x <= 50 ? "OK" : "밖";
  console.log(`\n판정: 하루 바이트 중앙값 전체 ${bpd} (${inB(bpd)}), 새 레슨이 있는 날 ${bnew} (${inB(bnew)}) — 목표 40~50`);
  console.log(`      첫 의상 중앙값 ${fod}일째 (목표 3~4) ${fod >= 3 && fod <= 4 ? "OK" : "밖"}`);
  console.log("12판뿐이라 중앙값은 판마다 흔들릴 수 있음(빠지는 날 위치·정확도 무작위).");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
