// 인사 화면: 리아 인사 + Python 미리 받기 진행 표시. 준비를 기다리지 않고 바로 시작할 수 있다.
import { riaSVG } from "../ria.js";
import { esc } from "./dom.js";

export function render(root, ctx) {
  const line = ctx.say("greet");
  root.innerHTML = `<main class="screen splash">
    <div class="splash-hero">
      <div class="ria-wrap big">${riaSVG({ outfit: ctx.save.outfit, face: "joy", size: 200 })}</div>
      <h1 class="logo">리아와 파이썬<span class="bang">!</span></h1>
      <p class="tagline">하루 10분, 문리아 교수와 첫 코드부터</p>
    </div>
    <p class="bubble center">${esc(line.text)}</p>
    <div class="load" aria-live="polite">
      <div class="load-bar" data-state="loading"><span></span></div>
      <p class="load-text">파이썬 준비 중… 먼저 시작해도 괜찮아요</p>
    </div>
    <button class="btn primary wide" id="go">시작하기</button>
    <p class="ver">${esc(ctx.version)}</p>
  </main>`;
  const barEl = root.querySelector(".load-bar");
  const text = root.querySelector(".load-text");
  const paint = (status) => {
    barEl.dataset.state = status;
    text.textContent = status === "ready" ? "파이썬 준비 완료"
      : status === "error" ? "파이썬을 아직 못 받았어요. 코드 문제에서 다시 시도해요"
      : "파이썬 준비 중… 먼저 시작해도 괜찮아요";
  };
  paint(ctx.pyState().status);
  const off = ctx.onPy((s) => paint(s));
  root.querySelector("#go").addEventListener("click", () => ctx.show("home"));
  return off;
}
