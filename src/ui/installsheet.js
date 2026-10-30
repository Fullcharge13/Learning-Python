// 「홈 화면에 추가」 안내 시트: 리아 + 그림 3단계 + 이유
import { riaSVG } from "../ria.js";
import { el, esc, icon } from "./dom.js";
import { INSTALL_AFTER_TEXT } from "../install.js";

const SHARE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><path d="M24 12v17M18 18l6-6 6 6" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 23h-2v13h18V23h-2" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ADD = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><rect x="14" y="14" width="20" height="20" rx="5" fill="none" stroke="#22304A" stroke-width="2.5"/><path d="M24 19v10M19 24h10" stroke="#22304A" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const DONE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><text x="24" y="29" text-anchor="middle" font-size="12" font-weight="800" fill="#2F7BE0" font-family="-apple-system, sans-serif">추가</text></svg>`;

const STEPS = [
  [SHARE, "공유 버튼(안 보이면 ··· 메뉴 안)을 눌러요"],
  [ADD, "「홈 화면에 추가」를 골라요"],
  [DONE, "오른쪽 위 「추가」를 눌러요"],
];

const WHY = "사파리에서는 7일 동안 열지 않으면 기록이 지워질 수 있어요. 홈 화면에 추가하면 더 안전하게 남아요.";

function safariBody(outfit) {
  return `<div class="ria-row">
          <div class="ria-wrap">${riaSVG({ outfit, face: "wink", size: 72 })}</div>
          <p class="bubble">홈 화면에 저를 데려가 주세요. 앱처럼 바로 열 수 있어요.</p>
        </div>
        <h2 id="ins-title">홈 화면에 추가하기</h2>
        <ol class="ins-steps">${STEPS.map(([svg, text], i) => `<li><span class="ins-no" aria-hidden="true">${i + 1}</span>${svg}<span>${esc(text)}</span></li>`).join("")}</ol>
        <p class="ins-after">${icon("play")}<span>${esc(INSTALL_AFTER_TEXT)}</span></p>
        <p class="ins-why">${esc(WHY)}</p>`;
}

// 카카오톡 등 앱 안 브라우저: 홈 화면 추가가 안 되므로 사파리로 열라는 짧은 안내
function inAppBody(outfit) {
  return `<div class="ria-row">
          <div class="ria-wrap">${riaSVG({ outfit, face: "think", size: 72 })}</div>
          <p class="bubble">지금은 앱 안의 브라우저로 보고 있어요.</p>
        </div>
        <h2 id="ins-title">Safari에서 열어야 홈 화면에 추가할 수 있어요</h2>
        <p class="ins-menu"><span class="ins-dots" aria-hidden="true">···</span><span>화면의 … 메뉴 → 「다른 브라우저로 열기」 또는 「Safari로 열기」를 눌러요</span></p>
        <p class="ins-why">${esc(WHY)}</p>`;
}

/** 안내 시트를 연다. kind: "safari"(기본) | "inapp". 닫히면 resolve */
export function openInstallSheet({ outfit, kind = "safari" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="modal-back" role="presentation">
      <div class="modal install ${kind === "inapp" ? "inapp" : "safari"}" role="dialog" aria-modal="true" aria-labelledby="ins-title">
        ${kind === "inapp" ? inAppBody(outfit) : safariBody(outfit)}
        <button class="btn primary wide" id="ins-ok">알겠어요</button>
      </div></div>`);
    const close = () => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
      resolve();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("#ins-ok")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector("#ins-ok").focus({ preventScroll: true });
  });
}
