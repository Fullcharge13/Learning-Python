// 레슨 완료: 얻은 XP·바이트, 정확도, 연속 기록, 요약 3줄, 퀘스트·배지·이정표
import { QUESTS } from "../../data/quests.js";
import { BADGES } from "../../data/badges.js";
import { riaSVG } from "../ria.js";
import { esc, icon, celebrate, MILESTONE_REWARD } from "./dom.js";
import { badgeArt } from "./badges.js";
import { courseJustFinished } from "../curriculum.js";
import { isAdvancedLesson } from "../advanced.js";
import { t, tx } from "../i18n.js";

export function render(root, ctx, params = {}) {
  const r = params.result;
  if (!r) { ctx.show("home"); return; }
  const lesson = params.lesson;
  const review = r.mode === "review";
  const daily = r.mode === "daily";   // 매일 도전(v0.9)
  const adv = !review && !daily && isAdvancedLesson(lesson);
  const finished = !review && !daily && courseJustFinished({ chapters: ctx.chapters, completed: ctx.save.completed_lessons, firstTime: r.firstTime, lessonId: r.lessonId });
  const line = ctx.say(finished ? "course_done" : "lesson_done", { xp: r.xp });
  const streakLine = r.streakUp || r.milestone ? ctx.say("streak_up", { streak: r.streak }) : null;
  const bytes = r.totalBytes ?? (r.lessonBytes + r.questBytes + (r.milestoneBytes || 0));
  const parts = [[daily ? t`도전` : t`레슨`, r.lessonBytes], ...(daily ? [[t`도전 7일 보너스`, r.bonusBytes || 0]] : []),
    [t`퀘스트`, r.questBytes], [t`연속 기록`, r.milestoneBytes || 0]].filter(([, v]) => v > 0);
  const acc = Math.round((r.accuracy ?? 1) * 100);
  const quests = r.finished.map((id) => QUESTS.find((q) => q.id === id)).filter(Boolean);
  const badges = r.newBadges.map((id) => BADGES.find((b) => b.id === id)).filter(Boolean);

  root.innerHTML = `<div class="screen done">
    <main>
      <div class="done-hero">
        <div class="ria-wrap big jump">${riaSVG({ outfit: ctx.save.outfit, face: line.face, size: 150 })}<span class="sfx" aria-hidden="true">${t`짠!`}</span></div>
        <h1>${daily ? t`오늘의 도전 완료!` : review ? t`복습 완료!` : finished ? t`과정 완주!` : adv ? esc(t`${lesson.id} 심화 완료!`) : esc(t`${lesson.id} 레슨 완료!`)}</h1>
        <p class="bubble center">${esc(line.text)}</p>
      </div>
      ${daily && r.xp ? `<p class="daily-done">${icon("flame")}<span>${esc(t`도전 ${r.dailyStreak}일째`)}</span>${r.bonusBytes
        ? `<b class="sun-text">${esc(t`7일 보너스 +${r.bonusBytes}바이트`)}</b>` : ""}</p>` : ""}
      ${daily && !r.xp ? `<p class="muted center">${t`오늘의 도전 보상은 이미 받았어요. 내일 새 문제가 와요.`}</p>` : ""}
      ${r.milestone ? `<p class="milestone">${icon("flame")}<span>${esc(`${t`연속 ${r.milestone}일!`} ${MILESTONE_REWARD[r.milestone] || ""}`)}</span></p>` : ""}
      <ul class="tiles" aria-label="${t`받은 보상`}">
        <li class="tile xp">${icon("xp")}<b>+${r.xp}</b><span>XP</span></li>
        <li class="tile byte">${icon("byte")}<b>+${bytes}</b><span>${t`바이트`}</span></li>
        <li class="tile acc">${icon("check")}<b>${acc}%</b><span>${t`첫 시도 정답`}</span></li>
        <li class="tile flame${r.streakUp ? " lit" : ""}">${icon("flame")}<b>${r.streak}</b><span>${t`일 연속`}</span></li>
      </ul>
      ${parts.length > 1 ? `<p class="muted center">${t`바이트: ${parts.map(([k, v]) => `${k} ${v}`).join(" + ")}`}</p>` : ""}
      ${!r.firstTime && !review && !daily ? `<p class="muted center">${t`다시 하기라서 레슨 바이트는 없지만, XP와 오늘의 퀘스트는 채워져요.`}</p>` : ""}
      ${r.firstTime && r.perfect ? `<p class="perk">${icon("star")}${t`실수 없이 끝냈어요 (+5 XP, +5바이트)`}</p>` : ""}
      ${r.firstTime && r.hintFreeWrite ? `<p class="perk">${icon("bulb")}${t`힌트 없이 코드를 통과했어요 (+5 XP)`}</p>` : ""}
      ${streakLine ? `<div class="ria-row small"><div class="ria-wrap">${riaSVG({ outfit: ctx.save.outfit, face: streakLine.face, size: 56 })}</div><p class="bubble">${esc(streakLine.text)}</p></div>` : ""}
      ${lesson && lesson.summary ? `<section class="panel summary"><h2>${t`오늘 배운 것`}</h2><ol>${lesson.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>` : ""}
      ${quests.length || r.chest ? `<section class="panel"><h2>${t`끝낸 퀘스트`}</h2><ul class="plain">${quests.map((q) => `<li>${icon("check")}${esc(tx(`quest.${q.id}.name`, q.name))} <b class="sun-text">+${q.reward}</b></li>`).join("")}
        ${r.chest ? `<li>${icon("chestOpen")}${t`보물상자를 열었어요`} <b class="sun-text">+10</b></li>` : ""}</ul></section>` : ""}
      ${badges.length ? `<section class="panel"><h2>${t`새 배지`}</h2><ul class="new-badges">${badges.map((b) => `<li>${badgeArt(b.id, true, 56)}<span>${esc(tx(`badge.${b.id}.name`, b.name))}</span></li>`).join("")}</ul></section>` : ""}
    </main>
    <footer class="lesson-foot"><button class="btn primary wide" id="home">${t`계속`}</button></footer>
  </div>`;
  root.querySelector("#home").addEventListener("click", () => ctx.show("home"));
  (async () => {
    if (r.milestone) {
      ctx.sound.play("levelup");
      await celebrate({ outfit: ctx.save.outfit, milestone: r.milestone });
    }
    await ctx.afterDone(); // 첫 레슨이면 「홈 화면에 추가」 안내(아이폰 사파리만)
    root.querySelector("#home")?.focus({ preventScroll: true });
  })();
}
