// 「홈 화면에 추가」 안내 시트: 리아 + 그림 3단계 + 이유
import { riaSVG } from "../ria.js";
import { el, esc, icon } from "./dom.js";
import { installAfterText } from "../install.js";
import { t } from "../i18n.js";

const SHARE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><path d="M24 12v17M18 18l6-6 6 6" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 23h-2v13h18V23h-2" fill="none" stroke="#2F7BE0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ADD = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><rect x="14" y="14" width="20" height="20" rx="5" fill="none" stroke="#22304A" stroke-width="2.5"/><path d="M24 19v10M19 24h10" stroke="#22304A" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const DONE = () => `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><text x="24" y="29" text-anchor="middle" font-size="12" font-weight="800" fill="#2F7BE0" font-family="-apple-system, sans-serif">${t`추가`}</text></svg>`;

// 안드로이드 크롬(v0.14.1): ⋮ 메뉴 → 「홈 화면에 추가」(또는 「앱 설치」) → 「설치」(또는 「추가」)
const MENU = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><circle cx="24" cy="15" r="3" fill="#22304A"/><circle cx="24" cy="24" r="3" fill="#22304A"/><circle cx="24" cy="33" r="3" fill="#22304A"/></svg>`;
const INSTALL = () => `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="6" y="6" width="36" height="36" rx="10" fill="#fff" stroke="#22304A" stroke-width="2.5"/><text x="24" y="29" text-anchor="middle" font-size="12" font-weight="800" fill="#1E8E5A" font-family="sans-serif">${t`설치`}</text></svg>`;

// 글자는 열 때마다 지금 언어로
const ANDROID_STEPS = () => [
  [MENU, t`크롬 오른쪽 위 ⋮ 메뉴를 눌러요`],
  [ADD, t`「홈 화면에 추가」 또는 「앱 설치」를 골라요`],
  [INSTALL(), t`「설치」 또는 「추가」를 눌러요`],
];
const ANDROID_WHY = () => t`홈 화면 아이콘으로 앱처럼 바로 열리고, 주소창 없이 화면을 넓게 써요.`;

const STEPS = () => [
  [SHARE, t`공유 버튼(안 보이면 ··· 메뉴 안)을 눌러요`],
  [ADD, t`「홈 화면에 추가」를 골라요`],
  [DONE(), t`오른쪽 위 「추가」를 눌러요`],
];

const WHY = () => t`사파리에서는 7일 동안 열지 않으면 기록이 지워질 수 있어요. 홈 화면에 추가하면 더 안전하게 남아요.`;

const stepList = (steps) => `<ol class="ins-steps">${steps.map(([svg, text], i) =>
  `<li><span class="ins-no" aria-hidden="true">${i + 1}</span>${svg}<span>${esc(text)}</span></li>`).join("")}</ol>`;

// v0.14.1: 아이폰(사파리) / 안드로이드(크롬) 두 갈래. 쓰는 휴대폰 쪽(first)이 먼저 열림
function safariBody(outfit, first = "ios") {
  const tab = (p, label) => `<button type="button" role="tab" class="lang-btn${p === first ? " on" : ""}" data-p="${p}" id="ins-tab-${p}"
    aria-selected="${p === first}" aria-controls="ins-${p}" tabindex="${p === first ? 0 : -1}">${label}</button>`;
  return `<div class="ria-row">
          <div class="ria-wrap">${riaSVG({ outfit, face: "wink", size: 72 })}</div>
          <p class="bubble">${t`홈 화면에 저를 데려가 주세요. 앱처럼 바로 열 수 있어요.`}</p>
        </div>
        <h2 id="ins-title">${t`홈 화면에 추가하기`}</h2>
        <div class="ins-tabs" role="tablist" aria-label="${esc(t`휴대폰 종류`)}">${tab("ios", esc(t`아이폰 (사파리)`))}${tab("android", esc(t`안드로이드 (크롬)`))}</div>
        <section class="ins-panel" id="ins-ios" data-p="ios" role="tabpanel" aria-labelledby="ins-tab-ios"${first === "ios" ? "" : " hidden"}>
          ${stepList(STEPS())}
          <p class="ins-after">${icon("play")}<span>${esc(installAfterText())}</span></p>
          <p class="ins-why">${esc(WHY())}</p>
        </section>
        <section class="ins-panel" id="ins-android" data-p="android" role="tabpanel" aria-labelledby="ins-tab-android"${first === "android" ? "" : " hidden"}>
          ${stepList(ANDROID_STEPS())}
          <p class="ins-why">${esc(ANDROID_WHY())}</p>
        </section>`;
}

// 카카오톡 등 앱 안 브라우저: 홈 화면 추가가 안 되므로 사파리로 열라는 짧은 안내
function inAppBody(outfit) {
  return `<div class="ria-row">
          <div class="ria-wrap">${riaSVG({ outfit, face: "think", size: 72 })}</div>
          <p class="bubble">${t`지금은 앱 안의 브라우저로 보고 있어요.`}</p>
        </div>
        <h2 id="ins-title">${t`Safari에서 열어야 홈 화면에 추가할 수 있어요`}</h2>
        <p class="ins-menu"><span class="ins-dots" aria-hidden="true">···</span><span>${t`화면의 … 메뉴 → 「다른 브라우저로 열기」 또는 「Safari로 열기」를 눌러요`}</span></p>
        <p class="ins-why">${esc(WHY())}</p>`;
}

/** 안내 시트를 연다. kind: "safari"(기본, 아이폰·안드로이드 두 갈래) | "inapp". platform: 먼저 열 갈래. 닫히면 resolve */
export function openInstallSheet({ outfit, kind = "safari", platform = "ios" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="modal-back" role="presentation">
      <div class="modal install ${kind === "inapp" ? "inapp" : "safari"}" role="dialog" aria-modal="true" aria-labelledby="ins-title">
        ${kind === "inapp" ? inAppBody(outfit) : safariBody(outfit, platform === "android" ? "android" : "ios")}
        <button class="btn primary wide" id="ins-ok">${t`알겠어요`}</button>
      </div></div>`);
    const close = () => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus) prev.focus({ preventScroll: true });
      resolve();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const pick = (p) => {
      for (const b of wrap.querySelectorAll(".ins-tabs [role=tab]")) {
        const on = b.dataset.p === p;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      }
      for (const s of wrap.querySelectorAll(".ins-panel")) s.hidden = s.dataset.p !== p;
    };
    wrap.addEventListener("click", (e) => {
      const tb = e.target.closest(".ins-tabs [role=tab]");
      if (tb) { pick(tb.dataset.p); return; }
      if (e.target === wrap || e.target.closest("#ins-ok")) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector("#ins-ok").focus({ preventScroll: true });
  });
}
