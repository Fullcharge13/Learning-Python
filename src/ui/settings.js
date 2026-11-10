// 설정: 소리, 하루 목표, 이름, 저장 내보내기·가져오기, 판 번호
import { DAILY_GOALS } from "../rules.js";
import { esc, toast, dialog, icon, langPick, bindLangPick } from "./dom.js";
import { collectOfflineStatus } from "../offline.js";
import { curriculum, chapterWindow } from "../curriculum.js";
import { applyGoalChange } from "../finish.js";
import { checkImport, importCompare, notSaveText } from "../importsave.js";
import { isDev } from "../devgate.js";
import { markDev } from "../devmode.js";
import { tabBar, bindTabs, gardenTabOf, statusBar } from "./nav.js";
import { localDate } from "../today.js";
import { t, tp, lang } from "../i18n.js";

/** 이름: 앞뒤 빈칸과 끝의 「님」을 빼고 8자까지 */
export function cleanName(v) {
  let s = String(v || "").trim();
  while (s.endsWith("님")) s = s.slice(0, -1).trim(); // I18N_SKIP: 입력에서 한국어 존칭 「님」을 떼는 규칙(표시 문구 아님)
  return Array.from(s).slice(0, 8).join("");
}

const ST = () => ({
  done: ["check", t`완료`], current: ["play", t`지금`], open: ["play", t`열림`], locked: ["lock", t`잠김`],
});

/** 학습 내용 카드 (C33): 요약 한 줄, 장마다 펼치기, 다음 업데이트 예정 */
function courseCard(ctx) {
  const c = curriculum({ chapters: ctx.chapters, completed: ctx.save.completed_lessons, currentId: ctx.currentLessonId(),
    seenUpdates: ctx.save.seen_updates, dev: isDev(ctx.save) });
  const dot = (l) => (l.isNew ? `<span class="new-dot inline" role="img" aria-label="${esc(t`새 내용 있음`)}">${t`새 내용`}</span>` : "");
  const st = ST();
  const first = c.upcoming.slice(0, 3);
  const rest = c.upcoming.slice(3);
  const upName = (u) => t`${u.no}장 ${u.title}`;
  // 처음엔 지금 장과 앞뒤 셋만(C35). 나머지는 「다른 장 N개 더 보기」로
  const curCh = c.current ? (c.chapters.find((ch) => ch.lessons.some((l) => l.id === c.current.id)) || {}).id : null;
  const win = chapterWindow({ chapterIds: c.chapters.map((ch) => ch.id), currentChapter: curCh ?? null });
  const hiddenSet = new Set(win.hidden);
  return `<section class="panel course" aria-labelledby="course-title">
    <h2 id="course-title">${t`학습 내용`}</h2>
    <p class="course-sum">${t`${c.total}개 레슨 중 ${`<b>${t`${c.done}개`}</b>`} 완료`}${c.current ? ` · ${t`지금: ${esc(c.current.id)} ${esc(c.current.title)}`}` : ""}${c.advTotal ? `<br><small>${t`심화(선택) ${c.advTotal}개 중 ${c.advDone}개 완료`}</small>` : ""}</p>
    <ul class="course-chapters" id="course-chapters">${c.chapters.map((ch) => `<li${hiddenSet.has(ch.id) ? ' class="ch-extra" hidden' : ""}>
      <button class="ch-row" aria-expanded="false" aria-controls="ch-${ch.id}">
        <span class="ch-no">${t`${ch.id}장`}</span>
        <span class="ch-main"><b>${esc(ch.title)}</b><small>${esc(ch.topics)}</small></span>
        <span class="ch-side"><span class="ch-count${ch.done === ch.total ? " full" : ""}">${t`${ch.done}/${ch.total} 완료`}</span>
          ${ch.advTotal ? `<span class="ch-adv${ch.advDone === ch.advTotal ? " full" : ""}">${icon("star")}${t`심화 ${ch.advDone}/${ch.advTotal}`}</span>` : ""}</span>
      </button>
      <ol class="ch-lessons" id="ch-${ch.id}" hidden>${ch.lessons.map((l) => `<li class="ls ${l.status}">
        <span class="ls-st">${icon(st[l.status][0])}<span>${st[l.status][1]}</span></span>
        <span class="ls-main"><b>${esc(l.id)} ${esc(l.title)}${dot(l)}</b><small>${esc(l.goal)}</small></span>
      </li>`).join("")}
      ${ch.advTotal ? `<li class="ch-adv-head">${icon("star")}${t`심화`} <small>${t`장 평가를 통과하면 열려요 · 선택`}</small></li>${ch.advanced.map((l) => `<li class="ls adv ${l.status}">
        <span class="ls-st">${icon(st[l.status][0])}<span>${st[l.status][1]}</span></span>
        <span class="ls-main"><b>${esc(l.id)} ${esc(l.title)}${dot(l)}</b><small>${esc(l.goal)}</small></span>
      </li>`).join("")}` : ""}</ol>
    </li>`).join("")}</ul>
    ${win.hidden.length ? `<button class="btn ghost small wide" id="ch-more" aria-expanded="false" aria-controls="course-chapters" data-n="${win.hidden.length}">${t`다른 장 ${win.hidden.length}개 더 보기`}</button>` : ""}
    ${c.upcoming.length ? `<p class="muted course-next">${t`다음 업데이트 예정: ${esc(first.map(upName).join(" · "))}`}${rest.length ? `<span id="up-rest" hidden> · ${esc(rest.map(upName).join(" · "))}</span><span id="up-dots"> …</span>` : ""}</p>
      ${rest.length ? `<button class="link" id="up-all" aria-expanded="false" aria-controls="up-rest">${t`전체 보기`}</button>` : ""}` : ""}
  </section>`;
}

export function render(root, ctx) {
  const s = ctx.save;
  const goal = DAILY_GOALS.includes(s.settings.dailyGoal) ? s.settings.dailyGoal : 20;
  // 바꾼 목표는 내일부터(v0.12.1, QA 4). 고른 칸은 예약한 값, 아래에 「내일부터 N XP」
  const pend = s.goal_pending && DAILY_GOALS.includes(s.goal_pending.value) ? s.goal_pending.value : null;
  const picked = pend ?? goal;
  const dev = !!ctx.dev;
    root.innerHTML = `<div class="screen settings with-tabs">
    ${statusBar(s)}
    <main>
      <h1 class="page-title">${t`설정`}</h1>
      ${courseCard(ctx)}
      <section class="panel">
        <div class="row">
          <label for="snd" class="row-label">${t`소리`}<small>${t`정답·오답 효과음`}</small></label>
          <button class="switch" id="snd" role="switch" aria-checked="${s.settings.sound !== false}"><span></span></button>
        </div>
        <div class="row col" role="group" aria-labelledby="goal-label">
          <p class="row-label" id="goal-label">${t`하루 목표`}<small>${t`목표를 채운 날마다 연속 기록이 하루씩 늘어요`}</small></p>
          <div class="seg" role="radiogroup" aria-label="${esc(t`하루 목표`)}">${DAILY_GOALS.map((g) =>
            `<button role="radio" aria-checked="${g === picked}" data-g="${g}">${g} XP</button>`).join("")}</div>
          ${pend ? `<p class="goal-note" id="goal-note">${t`오늘은 ${goal} XP`} · <b>${t`내일부터 ${pend} XP`}</b></p>` : ""}
        </div>
        <div class="row col">
          <label for="name" class="row-label">${t`부를 이름`}<small>${t`리아 교수가 「○○님」이라고 불러요. 비워 둬도 돼요`}</small></label>
          <input id="name" type="text" maxlength="9" autocomplete="nickname" autocapitalize="off" value="${esc(s.settings.name || "")}" placeholder="${esc(t`예: 지민`)}">
        </div>
      </section>
      <section class="panel">
        <h2>${t`저장`}${dev ? ` <small class="dev-tag">${t`(개발자 모드 저장)`}</small>` : ""}</h2>
        <p class="muted">${dev ? t`지금은 개발자 모드 저장을 내보내고 가져와요. 학습 기록은 그대로예요.` : t`진행은 이 브라우저에만 저장돼요. 휴대폰을 바꾸거나 기록이 지워질까 걱정되면 파일로 내보내 두세요.`}</p>
        <div class="btn-row">
          <button class="btn ghost" id="export" aria-label="${esc(dev ? t`저장 내보내기 (개발자 모드 저장)` : t`저장 내보내기`)}">${t`저장 내보내기`}</button>
          <label class="btn ghost" for="import" aria-label="${esc(dev ? t`저장 가져오기 (개발자 모드 저장)` : t`저장 가져오기`)}">${t`저장 가져오기`}</label>
          <input id="import" type="file" accept="application/json,.json" class="sr">
        </div>
        <p class="offline-status wait" id="offline" role="status" aria-live="polite">${icon("review")}<span>${t`오프라인 준비 상태를 확인하는 중…`}</span></p>
      </section>
      <section class="panel">
        <h2>${t`홈 화면에 추가`}</h2>
        <p class="muted">${t`아이폰 사파리에서는 홈 화면에 추가해 두면 앱처럼 열리고 기록도 더 안전해요.`}</p>
        <button class="btn ghost wide" id="install">${t`홈 화면에 추가 방법`}</button>
      </section>
      ${ctx.langPicker ? `<section class="panel" aria-labelledby="lang-title">
        <h2 id="lang-title">${t`언어`}${lang() === "ko" ? ' <span class="muted" lang="en">Language</span>' : ""}</h2>
        ${langPick(lang())}
      </section>` : ""}
      <section class="panel devmode" aria-labelledby="dev-label">
        <div class="row">
          <p class="row-label" id="dev-label">${t`개발자 모드`}<small>${t`잠긴 곳을 모두 열어 검수해요. 학습 기록과 따로 저장돼요.`}</small></p>
          <button class="switch" id="dev" role="switch" aria-checked="${dev}" aria-labelledby="dev-label"><span></span></button>
        </div>
        ${dev ? `<p class="dev-note" id="dev-note">${t`켜져 있어요 · 끄면 학습 기록으로 돌아가요`}</p>` : ""}
      </section>
      <p class="ver center">${t`리아와 파이썬!`} ${esc(ctx.version)} · <a class="lic-link" href="licenses.txt" target="_blank" rel="noopener">${t`사용한 프로그램`}</a></p>
    </main>
    ${tabBar("settings", gardenTabOf(ctx))}
  </div>`;
  bindTabs(root, ctx);

  // 학습 내용 펼치기
  root.querySelectorAll(".ch-row").forEach((b) => b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    root.querySelector("#" + b.getAttribute("aria-controls")).hidden = !open;
  }));
  const chMore = root.querySelector("#ch-more");
  if (chMore) chMore.addEventListener("click", () => {
    const open = chMore.getAttribute("aria-expanded") !== "true";
    chMore.setAttribute("aria-expanded", String(open));
    root.querySelectorAll(".ch-extra").forEach((li) => { li.hidden = !open; });
    chMore.textContent = open ? t`접기` : t`다른 장 ${chMore.dataset.n}개 더 보기`;
  });
  const upAll = root.querySelector("#up-all");
  if (upAll) upAll.addEventListener("click", () => {
    const open = upAll.getAttribute("aria-expanded") !== "true";
    upAll.setAttribute("aria-expanded", String(open));
    root.querySelector("#up-rest").hidden = !open;
    root.querySelector("#up-dots").hidden = open;
    upAll.textContent = open ? t`접기` : t`전체 보기`;
  });

  // 오프라인 준비 상태(판정 C32): 서비스 작업자 + Pyodide 저장본 + 장 파일 전부(v0.3). 색만이 아니라 아이콘과 글로 알림
  const off = root.querySelector("#offline");
  collectOfflineStatus(ctx.chapterFiles).then((r) => {
    if (!off.isConnected) return;
    off.className = "offline-status " + (r.ready ? "ready" : "wait");
    off.innerHTML = r.ready
      ? `${icon("check")}<span>${t`오프라인 준비 완료`}</span>`
      : r.reason === "missing-chapters"
        ? `${icon("review")}<span>${t`아직 준비 중이에요 — 인터넷이 될 때 앱을 한 번 다시 열면 레슨을 모두 받아 둬요`}</span>`
        : `${icon("review")}<span>${t`아직 준비 중이에요 — 인터넷이 될 때 직접 작성 문제를 한 번 실행하면 준비돼요`}</span>`;
    off.dataset.ready = String(r.ready);
  });

  const setSettings = (patch) => {
    const cur = ctx.save;
    ctx.commit({ ...cur, settings: { ...cur.settings, ...patch } });
  };
  const snd = root.querySelector("#snd");
  snd.addEventListener("click", () => {
    const on = !(ctx.save.settings.sound !== false);
    setSettings({ sound: on });
    snd.setAttribute("aria-checked", String(on));
    if (on) ctx.sound.play("correct");
  });
  root.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => {
    // 새 목표는 내일부터(오늘 모은 XP로 바로 인정하지 않음). 지금 목표를 다시 고르면 예약을 지움
    const g = +b.dataset.g;
    const r = applyGoalChange(ctx.save, g, ctx.today());
    ctx.commit(r.save);
    const now = DAILY_GOALS.includes(r.save.settings.dailyGoal) ? r.save.settings.dailyGoal : 20;
    toast(r.pending ? t`내일부터 하루 목표가 ${r.pending.value} XP예요. 오늘은 ${now} XP 그대로예요.` : t`하루 목표 ${now} XP 그대로예요.`);
    const y = window.scrollY;
    ctx.show("settings");
    window.scrollTo(0, y);
    const again = document.querySelector(`[data-g="${g}"]`);
    if (again) again.focus({ preventScroll: true });
  }));

  const name = root.querySelector("#name");
  name.addEventListener("change", () => {
    const v = cleanName(name.value);
    name.value = v;
    setSettings({ name: v });
    toast(v ? t`이제 「${v}님」이라고 부를게요.` : t`이름 없이 부를게요.`);
  });

  root.querySelector("#install").addEventListener("click", () => ctx.showInstallSheet());
  bindLangPick(root, ctx);
  root.querySelector("#export").addEventListener("click", () => {
    // 파일에는 개발자 표시를 넣지 않는다(가져올 때 지금 칸에 맞춰 다시 붙음)
    const blob = new Blob([JSON.stringify(markDev(ctx.save, false), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ria-python-${dev ? "dev-" : ""}save-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(dev ? t`개발자 모드 저장을 내보냈어요.` : t`저장 파일을 내보냈어요.`);
  });
  root.querySelector("#import").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let raw;
    try { raw = JSON.parse(await f.text()); } catch { toast(t`저장 파일을 읽지 못했어요. 내보내기로 만든 .json 파일인지 확인해 주세요.`, "warn"); return; }
    // 아무 JSON이나 받아 진행을 지우지 않게(v0.12.1, QA 2): 저장 모양이 아니면 확인 창 없이 알림만
    if (!checkImport(raw).ok) { toast(notSaveText(), "warn"); return; }
    const next = ctx.migrate(raw);
    const cmp = importCompare(ctx.save, next);
    const ok = await dialog({
      title: t`이 저장으로 바꿀까요?`,
      body: `<p>${esc(cmp.summary)}</p>${cmp.warn ? `<p class="import-warn"><b>${esc(cmp.warn)}</b></p>` : ""}<p>${dev ? t`개발자 모드 저장이 이 파일 내용으로 바뀌어요. 학습 기록은 그대로예요.` : t`지금 이 브라우저의 진행은 이 파일 내용으로 바뀌어요.`}</p>`,
      buttons: [{ label: tp("cancel", "그만두기"), value: false }, { label: t`바꾸기`, value: true, kind: "primary" }],
    });
    if (!ok) return;
    ctx.commit(next);
    ctx.dayStart(); // 가져온 저장의 날짜로 연속 기록·퀘스트를 오늘에 맞춤
    toast(dev ? t`개발자 모드 저장으로 가져왔어요.` : t`저장을 가져왔어요.`);
    ctx.show("home");
  });

  // 개발자 모드(검수용): 켤 때만 확인 창. 켜고 끄면 저장 칸이 바뀌므로 설정 화면을 다시 그림
  const devBtn = root.querySelector("#dev");
  devBtn.addEventListener("click", async () => {
    const on = !ctx.dev;
    if (on) {
      const ok = await dialog({
        title: t`개발자 모드를 켤까요?`,
        body: `<p>${t`검수용 모드예요. 켜 두는 동안의 진행은 학습 기록과 따로 저장돼요.`}</p>`,
        buttons: [{ label: tp("cancel", "그만두기"), value: false }, { label: t`켜기`, value: true, kind: "primary" }],
      });
      if (!ok) return;
    }
    ctx.setDev(on);
    ctx.show("settings");
    const sw = document.getElementById("dev");
    if (sw) { sw.focus({ preventScroll: true }); sw.scrollIntoView({ block: "center" }); }
    toast(on ? t`개발자 모드를 켰어요. 잠긴 곳이 모두 열려요.` : t`개발자 모드를 껐어요. 학습 기록으로 돌아왔어요.`);
  });
}
