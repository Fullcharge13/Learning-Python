// 설정: 소리, 하루 목표, 이름, 저장 내보내기·가져오기, 판 번호
import { DAILY_GOALS } from "../rules.js";
import { esc, toast, dialog, celebrate } from "./dom.js";
import { applyGoalChange } from "../finish.js";
import { newSave } from "../save.js";
import { tabBar, bindTabs, statusBar } from "./nav.js";
import { localDate } from "../today.js";

/** 이름: 앞뒤 빈칸과 끝의 「님」을 빼고 8자까지 */
export function cleanName(v) {
  let s = String(v || "").trim();
  while (s.endsWith("님")) s = s.slice(0, -1).trim();
  return Array.from(s).slice(0, 8).join("");
}

export function render(root, ctx) {
  const s = ctx.save;
  const goal = DAILY_GOALS.includes(s.settings.dailyGoal) ? s.settings.dailyGoal : 20;
  root.innerHTML = `<div class="screen settings with-tabs">
    ${statusBar(s)}
    <main>
      <h1 class="page-title">설정</h1>
      <section class="panel">
        <div class="row">
          <label for="snd" class="row-label">소리<small>정답·오답 효과음</small></label>
          <button class="switch" id="snd" role="switch" aria-checked="${s.settings.sound !== false}"><span></span></button>
        </div>
        <div class="row col" role="group" aria-labelledby="goal-label">
          <p class="row-label" id="goal-label">하루 목표<small>목표를 채운 날마다 연속 기록이 하루씩 늘어요</small></p>
          <div class="seg" role="radiogroup" aria-label="하루 목표">${DAILY_GOALS.map((g) =>
            `<button role="radio" aria-checked="${g === goal}" data-g="${g}">${g} XP</button>`).join("")}</div>
        </div>
        <div class="row col">
          <label for="name" class="row-label">부를 이름<small>리아 교수가 「○○님」이라고 불러요. 비워 둬도 돼요</small></label>
          <input id="name" type="text" maxlength="9" autocomplete="nickname" autocapitalize="off" value="${esc(s.settings.name || "")}" placeholder="예: 지민">
        </div>
      </section>
      <section class="panel">
        <h2>저장</h2>
        <p class="muted">진행은 이 브라우저에만 저장돼요. 휴대폰을 바꾸거나 기록이 지워질까 걱정되면 파일로 내보내 두세요.</p>
        <div class="btn-row">
          <button class="btn ghost" id="export">저장 내보내기</button>
          <label class="btn ghost" for="import">저장 가져오기</label>
          <input id="import" type="file" accept="application/json,.json" class="sr">
        </div>
      </section>
      <section class="panel">
        <h2>홈 화면에 추가</h2>
        <p class="muted">아이폰 사파리에서는 홈 화면에 추가해 두면 앱처럼 열리고 기록도 더 안전해요.</p>
        <button class="btn ghost wide" id="install">홈 화면에 추가 방법</button>
      </section>
      <p class="ver center">리아와 파이썬! ${esc(ctx.version)}</p>
    </main>
    ${tabBar("settings")}
  </div>`;
  bindTabs(root, ctx);

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
  root.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", async () => {
    // 목표를 낮춰 오늘 모은 XP가 이미 넘으면 그날을 바로 인정(이정표 보상 포함)
    const r = applyGoalChange(ctx.save, +b.dataset.g, ctx.today());
    ctx.commit(r.save);
    if (r.streakUp) toast(`오늘 목표 달성! 연속 ${r.save.streak.days}일이에요.`);
    if (r.milestone) {
      ctx.sound.play("levelup");
      await celebrate({ outfit: ctx.save.outfit, milestone: r.milestone });
    }
    ctx.show("settings"); // 위 상태 줄 목표 숫자도 바로 맞춤
  }));
  const name = root.querySelector("#name");
  name.addEventListener("change", () => {
    const v = cleanName(name.value);
    name.value = v;
    setSettings({ name: v });
    toast(v ? `이제 「${v}님」이라고 부를게요.` : "이름 없이 부를게요.");
  });

  root.querySelector("#install").addEventListener("click", () => ctx.showInstallSheet());
  root.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(ctx.save, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ria-python-save-${localDate()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("저장 파일을 내보냈어요.");
  });
  root.querySelector("#import").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    let raw;
    try { raw = JSON.parse(await f.text()); } catch { toast("저장 파일을 읽지 못했어요. 내보내기로 만든 .json 파일인지 확인해 주세요.", "warn"); return; }
    const known = Object.keys(newSave());
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Object.keys(raw).some((k) => known.includes(k))) {
      toast("리아와 파이썬! 저장 파일이 아니에요. 설정의 「저장 내보내기」로 만든 파일을 골라 주세요.", "warn");
      return;
    }
    const next = ctx.migrate(raw);
    const ok = await dialog({
      title: "이 저장으로 바꿀까요?",
      body: `<p>끝낸 레슨 ${next.completed_lessons.length}개, XP ${Math.max(0, next.xp)}, 바이트 ${Math.max(0, next.bytes)}, 연속 기록 ${next.streak.days}일</p><p>지금 이 브라우저의 진행은 이 파일 내용으로 바뀌어요.</p>`,
      buttons: [{ label: "그만두기", value: false }, { label: "바꾸기", value: true, kind: "primary" }],
    });
    if (!ok) return;
    ctx.commit(next);
    ctx.dayStart(); // 가져온 저장의 날짜로 연속 기록·퀘스트를 오늘에 맞춤
    toast("저장을 가져왔어요.");
    ctx.show("home");
  });
}
