// 화면 공용 도우미: 글자 이스케이프, 요소 만들기, 리아 말풍선, 아이콘, 창(modal)
import { riaSVG } from "../ria.js";
import { chartsHTML } from "../chart.js";

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

/** 리아 + 말풍선. sfx: 효과음 말풍선 글자(딩동! 등) */
export function riaSays({ outfit, face, text, size = 96, sfx = "", cls = "" }) {
  return `<div class="ria-row ${cls}">
    <div class="ria-wrap">${riaSVG({ outfit, face, size })}${sfx ? `<span class="sfx" aria-hidden="true">${esc(sfx)}</span>` : ""}</div>
    <p class="bubble">${esc(text)}</p>
  </div>`;
}

// 선 아이콘 (24 격자). 색은 currentColor
const P = {
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.5 2.2 2.5C10.5 8.5 11 5.5 12 3z"/>',
  byte: '<path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3z"/><path d="M9.5 10v4M14.5 10v4M9.5 12h5" />',
  xp: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  path: '<path d="M6 20c0-4 12-4 12-8S6 8 6 4"/><circle cx="6" cy="4" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="20" r="1.6"/>',
  badge: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
  hanger: '<path d="M12 7.5a2 2 0 1 1 2-2c0 1-2 1.5-2 3L3.5 15a1.3 1.3 0 0 0 .8 2.4h15.4a1.3 1.3 0 0 0 .8-2.4L12 8.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1"/>',
  chest: '<rect x="3.5" y="9.5" width="17" height="10" rx="1.5"/><path d="M3.5 9.5c0-3 2-5 8.5-5s8.5 2 8.5 5M3.5 13h17M10.5 12v3h3v-3"/>',
  chestOpen: '<rect x="3.5" y="11" width="17" height="8.5" rx="1.5"/><path d="M3.5 11l2-6.5h13l2 6.5M10.5 13.5v3h3v-3M12 2v1.5M7.5 2.8l.8 1.2M16.5 2.8l-.8 1.2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  send: '<path d="M4 12l16-7.5-6 16-2.5-6.5z"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.3 8-7.5 9.5-4.2-1.5-7.5-5-7.5-9.5V6z"/>',
  review: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 4h13v14H6a2 2 0 0 0-2 2zM4 20V5.5M8 8h7"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
};
export function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;
}

/** 확인 창. buttons: [{ label, value, kind }] → 누른 value로 resolve */
export function dialog({ title, body = "", buttons }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="modal-back" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">${esc(title)}</h2>
        ${body ? `<div class="modal-body">${body}</div>` : ""}
        <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.kind || "ghost"}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>
      </div></div>`);
    const close = (v) => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus();
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) close(buttons[+b.dataset.i].value);
      else if (e.target === wrap) close(null);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    const first = wrap.querySelector(".btn.primary") || wrap.querySelector("button");
    if (first) first.focus();
  });
}

/** 잠깐 뜨는 알림 */
export function toast(msg, kind = "") {
  let box = document.getElementById("toasts");
  if (!box) {
    box = el('<div id="toasts" class="toasts" role="status" aria-live="polite"></div>');
    document.body.appendChild(box);
  }
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  box.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/** 진행 막대 */
export function bar(value, max, cls = "", label = "") {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(value, max)}"${label ? ` aria-label="${esc(label)}"` : ""}><span style="width:${pct}%"></span></div>`;
}

/** 코드 보기 블록 */
export function codeBlock(code, cls = "") {
  return `<pre class="code ${cls}"><code>${esc(code)}</code></pre>`;
}

/** 가상 파일 보기(v0.4 E1): 문제의 files { 이름: 내용 }를 「파일 이름」 + 내용 칸으로 보여 준다 */
export function filesNote(files) {
  if (!files || typeof files !== "object") return "";
  return Object.entries(files).map(([name, text]) =>
    `<div class="file-note"><p class="ex-label">${icon("book")}<span>파일 <code>${esc(name)}</code></span></p><pre class="out">${esc(text)}</pre></div>`).join("");
}

/** 그래프 보기(v0.5 E3): 그림(객체·목록) 앞에 이름표. 그림이 없으면 "" */
export function chartNote(chart, label = "그래프") {
  const html = chartsHTML(chart);
  return html ? `<div class="chart-note"><p class="ex-label">${esc(label)}</p>${html}</div>` : "";
}

/** 입력값 보기: "12\n30" → 「입력하는 값: 12 30」 */
export function stdinNote(stdin) {
  if (stdin == null || stdin === "") return "";
  const vals = String(stdin).split("\n");
  return `<p class="stdin-note">${icon("send")}<span>입력하는 값: ${vals.map((v) => `<code>${esc(v)}</code>`).join(" ")}</span></p>`;
}

/** 개념 카드의 예제 칸. 카드는 실행하지 않고 저장된 out·chart를 보여 준다.
 *  show_only 카드(판정 C38)는 코드만 보여 주고 「실행 안 함」 이름표를 단다(출력 칸 없음). */
export function cardExample(c) {
  if (!c || !c.code) return "";
  if (c.show_only) {
    return `<div class="example show-only"><p class="ex-label">${icon("eye")}<span>실제 컴퓨터용 코드(여기서는 실행 안 함)</span></p>${codeBlock(c.code)}</div>`;
  }
  return `<div class="example">${filesNote(c.files)}<p class="ex-label">예제</p>${codeBlock(c.code)}${stdinNote(c.stdin)}
        ${c.out != null ? `<p class="ex-label">실행 결과</p><pre class="out">${esc(c.out)}</pre>` : ""}${chartNote(c.chart)}</div>`;
}

export const MILESTONE_REWARD = {
  7: "보너스 50바이트를 받았어요",
  30: "우주복 의상을 선물로 받았어요",
  100: "「연속 100일」 배지를 받았어요",
};

/** 연속 기록 이정표 축하 창. 누르면(또는 Enter·Esc) 닫히고 resolve */
export function celebrate({ outfit, milestone }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="celebrate" role="dialog" aria-modal="true" aria-labelledby="cel-title">
      <div class="cel-card">
        <div class="ria-wrap big jump">${riaSVG({ outfit, face: "sparkle", size: 150 })}<span class="sfx" aria-hidden="true">짠!</span></div>
        <h2 id="cel-title" class="cel-title">${icon("flame")}연속 ${esc(milestone)}일!</h2>
        <p class="cel-reward">${esc(MILESTONE_REWARD[milestone] || "")}</p>
        <button class="btn sun wide" id="cel-ok">좋아요</button>
      </div>
    </div>`);
    const shownAt = performance.now();
    const close = () => {
      if (performance.now() - shownAt < 400) return; // 입력 보호
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
      resolve();
    };
    const onKey = (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); close(); } };
    wrap.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector("#cel-ok").focus({ preventScroll: true });
  });
}
