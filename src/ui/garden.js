// v0.10 「파이의 텃밭」 화면: 텃밭 그림 + 주문 게시판 + 노드 흐름 편집기(또는 코드 모드) + 실행·재생 + 성장
// 설계: docs/specs/2026-11-05-파이의-텃밭-설계.md · 계획서 작업 4
// v0.11(docs/specs/2026-11-05-텃밭-6-9장-설계.md): 값 넣어 말하기·목록에서 하나씩(목록 편집 창, 목록 값)·창고 보기 조건·
//   위치 알기(x·y 값 비교), 텃밭 전용 오류 설명(src/garden/errors.js)
// v0.12(docs/specs/2026-11-05-텃밭-10-17장-설계.md): 토마토·씨앗 봉투 표시(10장부터), 쪽지함(받은 쪽지·농장일지 보기·비우기),
//   시도하기(안 되면 칸)·쪽지 읽기·줄 나누기·일지 쓰기·패턴 찾기 노드와 고르기 창, 심기·반복의 쪽지 값(crop·int(n))
//
// 규칙은 runner.py의 farm 모듈(실행), 노드·코드는 src/garden/nodes.js, 저장·주문·성장은 src/garden/state.js,
// 그림·재생 단계는 src/garden/view.js에 있다. 이 화면은 그것들을 이어 붙이고 그리기만 한다.
// 저장: save.garden 하나(바뀔 때마다 ctx.commit). 실행 결과는 재생 전에 먼저 저장한다(재생 중 앱을 닫아도 남음).
import {
  NODES, COND, VAR_NAMES, FUNC_NAMES, OPS, VALUE_RANGE, MAX_NODES, MSG as NODE_MSG,
  codegen, validate, unlockedKinds, newNode, insertNode, moveNode, removeNode, updateArgs, setElse, countNodes,
  CROP_NAMES, LIST_TYPES, LIST_ITEMS, LIST_LABELS, LIST_MAX, LIST_DEFAULTS, COND_LOCKS, availableValues, loopVarAvailable, cleanList,
  NOTE_FILES, LOG_FILE, PATTERNS, MARK_LOCKS, TOMATO, noteVarAvailable, valueTextReset,
} from "../garden/nodes.js";
import { gardenExplain } from "../garden/errors.js";
import {
  fillGarden, runInput, runFiles, applyRun, currentOrder, canBuy, buy, deliver, grantOrderXP, settleAll, passedChapters,
  JOURNAL_MAX, SEEDS_MAX, cleanSeeds, josa, orderShortfall, addPendingDone, dropPendingDone,
  codeForLang, codeMatchesNodes,
} from "../garden/state.js";
import { UPGRADES, ORDERS, SEED_PACK } from "../../data/garden.js";
import { BADGES } from "../../data/badges.js";
import { render as farmSVG, replayFrames, thinFrames } from "../garden/view.js";
import { riaSVG } from "../ria.js";
import { esc, icon, el, dialog, toast, bar, riaSays, celebrate } from "./dom.js";
import { createEditor } from "./editor.js";
import { errorPanel } from "./write.js";
import { SYMBOL_ORDER } from "../kbd.js";
import { t, tp, tx, lang } from "../i18n.js";
import { cropName, dirName, fileName, pyName } from "../garden/lang.js";

const SYSTEM_ERRORS = new Set(["LoadError", "WorkerError", "NotReady"]);
const CODE_SAVE_MS = 500;
// 멈춘 뒤 파이의 말풍선(3×3 밭에서도 두 줄 안에 들어가게 짧게, 자세한 글은 결과 칸의 MSG)
// (v0.13.5) 말은 쓸 때 지금 언어로 만든다
const TIRED_SAY = { tired: () => t`오늘은 여기까지! 지쳤어요`, waited: () => t`기다리다 지쳤어요. 내가 움직여야 시간이 흘러요` };
// 사건 말풍선(파이가 스스로 하는 말): 실패한 심기·덜 자란 수확
const EVENT_SAY = {
  no_seed: () => t`감자 씨앗이 아직 없어요`,
  occupied: () => t`여기는 이미 심겨 있어요`,
  harvest_young: () => t`앗, 아직 덜 자랐어요`,
  no_tomato_seed: () => t`토마토 씨앗이 떨어졌어요`,
};
const frameSay = (f) => {
  if (f.say) return f.say;
  const ev = f.fx && (EVENT_SAY[f.fx.reason] || EVENT_SAY[f.fx.t]);
  return ev ? ev() : null;
};
const UNDO_MS = 5000;   // 비우기 뒤 「되돌리기」 알림
const runHint = () => t`「실행」을 누르면 파이가 노드를 위에서부터 차례로 해요.`;
// 안쪽 열쇠(저장·엔진 값, 화면에는 lang.js 이름으로)
const DIR_RIGHT = "오른쪽";      // I18N_SKIP 방향 열쇠
const CARROT = "당근";           // I18N_SKIP 작물 열쇠
const POTATO_SEED = "감자 씨앗"; // I18N_SKIP 성장 id
const KIND_ORDER = ["move", "harvest", "plant", "say", "setvar", "addvar", "if", "def", "call", "repeat", "while", "sayval", "foreach", "where",
  "try", "readnote", "splitline", "writelog", "findall"];
// 목록 변수 기본 이름(자리가 틀려 범위를 못 찾을 때 — 오류는 노드에 따로 보임)
const LV_DEF = { crop: "crop", dir: "way" };
const isLV = (v) => !!v && typeof v === "object" && v.loopVar === true;
const isStoreCond = (c) => !!c && typeof c === "object" && "store" in c;
const isNV = (v) => !!v && typeof v === "object" && typeof v.noteVar === "string";   // 쪽지 값 { noteVar }
const isNC = (v) => !!v && typeof v === "object" && "value" in v;                   // 반복 횟수 { value: "n" }
const TOMATO_LOCK = `crop:${TOMATO}`;
// 받은 쪽지(읽기만) / 남는 일지
const isLog = (f) => f === LOG_FILE;
// 표지 목표(kindsUsed) 이름
const MARK_LABEL = {
  loopvar: () => t`목록 값 쓰기`, "loopvar:act": () => t`목록 값으로 심기·이동하기`, "cond:store": () => t`창고 보기 조건 쓰기`,
  "cond:pos": () => t`위치 조건 쓰기`, [TOMATO_LOCK]: () => t`토마토 심기`,
};
const VAL_SRC = { var: () => t`기억한 값`, pos: () => t`파이 위치`, loop: () => t`목록 값`, note: () => t`쪽지 값` };
const listLabel = (ty) => LIST_LABELS[ty] ?? LIST_LABELS.crop;

// 작물 작은 그림(창고 표시용, 24 격자)
const CROP_ICON = {
  당근: '<svg class="ic crop-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 9c-2-3-5-4-6-3 1 0 3 1 4 3M12 9c0-3 1-5 3-6 0 2-1 4-2 5M12 9c2-2 5-2 6-1-1 1-3 1-5 1" fill="none" stroke="#3E8E41" stroke-width="2" stroke-linecap="round"/><path d="M7.5 10.5Q12 8.5 16.5 10.5L12.8 21Q12 22 11.2 21Z" fill="#F28C28" stroke="#3B2C35" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  감자: '<svg class="ic crop-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 13.5C4 9 8 6 12.5 6.5S20.5 10 19.5 14 15 19.5 11 19 5.8 17 5 13.5Z" fill="#D9B77A" stroke="#3B2C35" stroke-width="1.6"/><circle cx="9.5" cy="11.5" r="1" fill="#A88550"/><circle cx="14" cy="10" r="1" fill="#A88550"/><circle cx="13" cy="15" r="1" fill="#A88550"/></svg>',
  토마토: '<svg class="ic crop-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="14" r="7.5" fill="#E2483A" stroke="#3B2C35" stroke-width="1.6"/><path d="M8.5 12.5q.5-2 2.5-2.5" fill="none" stroke="#FF8A7A" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 7.5l3 1.2L12 5.5l1.5 3.2 3-1.2-1.8 2.8H9.3z" fill="#3F8F3A" stroke="#3B2C35" stroke-width="1.1" stroke-linejoin="round"/></svg>',
};
// 씨앗 봉투 작은 그림(10장부터)
const SEED_ICON = '<svg class="ic crop-ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6.5h12l-1 13.5H7z" fill="#F3E3C3" stroke="#3B2C35" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.5 6.5l1.5-2.5h10l1.5 2.5" fill="#D9B77A" stroke="#3B2C35" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.2" fill="#E2483A" stroke="#3B2C35" stroke-width="1.3"/></svg>';

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const cropNames = (obj) => Object.entries(obj).filter(([, n]) => n > 0);
// (v0.13.5) 작물 이름을 개수에 맞춰(영어는 복수형: carrots·potatoes). 한국어는 이름 그대로
const plural = (w) => (/o$/.test(w) ? `${w}es` : `${w}s`);
const cropWord = (c, n) => (lang() === "en" && Number(n) !== 1 ? plural(cropName(c)) : cropName(c));
// 「당근 3개」 / 「3 carrots」
const cropCount = (c, n) => tp("crop-count", "{} {}개", cropWord(c, n), n);
// 목록 칸(작물·방향)을 지금 언어 이름으로
const itemName = (ty, v) => pyName(ty, v);
// 한국어 조사는 한국어 화면에서만(영어 문구에는 자리가 없음)
const jo = (w, p) => (lang() === "ko" ? josa(w, p) : "");

// ---- 노드 글 ----
function condLabel(c) {
  if (isStoreCond(c)) return t`창고 ${cropName(c.store?.crop)} ${c.store?.op} ${c.store?.num}`;
  if (c && typeof c === "object") return `${c.var} ${c.op} ${c.num}`;
  const f = COND.find((x) => x.id === c);
  return f ? f.label : String(c ?? "");
}

/** 노드 한 줄에 보일 값 단추들: [{ arg, text, mono }]. lv(type): 그 자리 목록 변수 이름(crop·way·crop2…) */
function argChips(n, lv = (ty) => LV_DEF[ty]) {
  const a = n.args || {};
  const val = (v, ty, show = (x) => x) => (isLV(v) ? { text: lv(v.type || ty), mono: true } : isNV(v) ? { text: v.noteVar, mono: true } : { text: show(v) });
  switch (n.kind) {
    case "move": return [{ arg: "dir", ...val(a.dir, "dir", dirName) }];
    case "plant": return [{ arg: "crop", ...val(a.crop, "crop", cropName) }];
    case "sayval": return [{ arg: "pre", text: `“${a.pre ?? ""}”` }, { arg: "var", ...val(a.var), mono: true }, { arg: "post", text: `“${a.post ?? ""}”` }];
    case "writelog": return [{ arg: "pre", text: `“${a.pre ?? ""}”` },
      a.var == null ? { arg: "var", text: t`값 없음` } : { arg: "var", ...val(a.var), mono: true }, { arg: "post", text: `“${a.post ?? ""}”` }];
    case "readnote": return [{ arg: "file", text: fileName(a.file) }];
    case "findall": return [{ arg: "pattern", text: PATTERNS[a.pattern]?.label ?? String(a.pattern ?? "") }];
    case "foreach": return [{ arg: "list", text: (a.list?.items || []).map((x) => itemName(a.list?.type, x)).join("·") }];
    case "say": return [{ arg: "text", text: `“${a.text ?? ""}”` }];
    case "setvar": return [{ arg: "name", text: a.name, mono: true }, { arg: "value", text: `= ${a.value}`, mono: true }];
    case "addvar": return [{ arg: "name", text: a.name, mono: true }, { arg: "value", text: `+ ${a.value}`, mono: true }];
    case "if":
    case "while": return [{ arg: "cond", text: condLabel(a.cond), mono: !!(a.cond && typeof a.cond === "object") }];
    case "repeat": return [{ arg: "n", text: isNC(a.n) ? t`int(${a.n.value})번` : t`${a.n}번`, mono: isNC(a.n) }];
    case "def":
    case "call": return [{ arg: "name", text: a.name, mono: true }];
    default: return [];
  }
}

const chapterClass = (kind) => `ch${NODES[kind]?.chapter ?? 0}`;

function goalText(o) {
  const g = o.goal;
  switch (g.type) {
    case "run_harvest":
      return t`한 번 실행에 ${g.crop ? cropWord(g.crop, g.n) : tp("crops", "작물", g.n)} ${g.n}개 거두기${g.max_actions ? t` (행동 ${g.max_actions}번 안에)` : ""}`
        + (g.kind ? t` · 「${NODES[g.kind]?.label ?? g.kind}」 노드로` : "");
    case "use": {
      const k = String(g.kind ?? "");
      const mark = Object.hasOwn(MARK_LABEL, k) ? MARK_LABEL[k] : null;
      const [base, rest] = k.includes(":") && !mark ? k.split(/:(.*)/s) : [k, null];
      // v0.12.1 「…:used」: 그 노드 안에서 읽은 줄·찾은 값을 노드에 넣어 써야 함
      const used = !!rest && rest.endsWith(":used");
      const opt = used ? rest.slice(0, -":used".length) : rest;
      const pat = base === "findall" && opt ? PATTERNS[opt]?.label ?? opt : "";
      const RN = NODES.readnote.label;
      const FA = NODES.findall.label;
      const head = mark ? t`「${mark()}」 — 노드로 끝까지 실행하기`
        : base === "readnote" && opt ? (used ? t`「${RN}」로 ${fileName(opt)}${jo(opt, "을")} 열어 읽은 줄(line)을 노드에 넣어 끝까지 실행하기`
          : t`「${RN}」로 ${fileName(opt)} 읽고 끝까지 실행하기`)
        : pat ? (used ? t`「${FA}: ${pat}」${jo(pat, "으로")} 찾은 값(${(PATTERNS[opt]?.vars ?? []).join(lang() === "en" ? ", " : "·")})을 노드에 넣어 끝까지 실행하기`
          : t`「${FA}: ${pat}」${jo(pat, "으로")} 끝까지 실행하기`)
        : t`「${NODES[k]?.label ?? k}」 노드를 넣고 끝까지 실행하기`;
      return g.journal ? t`${head} · 「일지에 한 줄 이상 쓰기」` : head;
    }
    case "plant_as_note": return t`「쪽지에 적힌 대로 심기」 — ${fileName(g.file)}의 작물을 그 개수만큼`
      + (g.kind ? t` · 「${NODES[g.kind]?.label ?? g.kind}」 노드로` : "");
    case "deliver": return t`창고의 ${cropCount(g.crop, g.n)} 보내기`;
    case "grid": return t`「성장」에서 밭을 ${g.size}×${g.size}로 넓히기`;
    default: return "";
  }
}

// ---- 고르기 창 ----
/** 아래에서 올라오는 고르기 창. [data-v] 단추는 그 값으로 닫힌다. bind(box, done)로 더 묶을 수 있다 → 고른 값 | null */
function sheet({ title, html, bind, cls = "" }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = el(`<div class="modal-back" role="presentation">
      <div class="modal g-sheet ${cls}" role="dialog" aria-modal="true" aria-labelledby="gs-title">
        <div class="gs-head"><h2 id="gs-title">${esc(title)}</h2>
          <button class="icon-btn gs-close" aria-label="${t`닫기`}">${icon("close")}</button></div>
        <div class="gs-body">${html}</div>
      </div></div>`);
    let closed = false;
    // 입력 보호: 창을 연 손짓의 나머지(click)가 그대로 고르기가 되지 않게, 창 안에서 누르기 시작한 것만 받는다
    let armed = false;
    wrap.addEventListener("pointerdown", () => { armed = true; });
    const done = (v) => {
      if (closed) return;
      closed = true;
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
      resolve(v);
    };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    wrap.addEventListener("click", (e) => {
      if (!armed && e.detail !== 0) return; // e.detail 0 = 키보드(Enter·Space)로 누름
      if (e.target === wrap || e.target.closest(".gs-close")) { done(null); return; }
      const b = e.target.closest("[data-v]");
      if (b && !b.disabled && wrap.contains(b)) done(b.dataset.v);
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    if (bind) bind(wrap.querySelector(".gs-body"), done);
    const first = wrap.querySelector(".gs-body [data-autofocus]") || wrap.querySelector(".gs-body button:not(:disabled)");
    if (first) first.focus({ preventScroll: true });
  });
}

/** −/+ 숫자 고르기 */
function stepperHTML(id, v, min, max) {
  const big = max - min > 30 ? 10 : 5;
  return `<div class="g-stepper" data-min="${min}" data-max="${max}" id="${id}">
    <button class="btn ghost" data-step="${-big}" aria-label="${t`${big} 빼기`}">−${big}</button>
    <button class="btn ghost" data-step="-1" aria-label="${t`${1} 빼기`}">−1</button>
    <output class="g-num" aria-live="polite">${v}</output>
    <button class="btn ghost" data-step="1" aria-label="${t`${1} 더하기`}">+1</button>
    <button class="btn ghost" data-step="${big}" aria-label="${t`${big} 더하기`}">+${big}</button>
  </div>`;
}
function bindStepper(box, onChange) {
  const min = +box.dataset.min;
  const max = +box.dataset.max;
  const out = box.querySelector(".g-num");
  const paint = (v) => {
    out.textContent = String(v);
    box.querySelectorAll("[data-step]").forEach((b) => {
      const s = +b.dataset.step;
      b.disabled = s < 0 ? v <= min : v >= max;
    });
  };
  paint(+out.textContent);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (!b) return;
    const v = Math.min(max, Math.max(min, +out.textContent + +b.dataset.step));
    paint(v);
    if (onChange) onChange(v);
  });
  return () => +out.textContent;
}

// ---- 화면 ----
export function render(root, ctx, params = {}) {
  const passed = passedChapters(ctx.save, ctx.chapters);
  const unlocked = unlockedKinds(passed);
  const tomatoOpen = unlocked.has(TOMATO_LOCK);
  const notesOpen = unlocked.has("readnote");
  const S = {
    // v0.13.5 검토 I1: 언어를 바꾼 뒤 코드 모드 — 노드가 만든 코드를 고치지 않았으면 지금 언어 코드로(저장은 다음 save 때)
    garden: codeForLang(fillGarden(ctx.save).garden, lang()),
    facing: DIR_RIGHT,
    overlay: {},
    state: "idle",       // idle | running | replay
    speed: 1,
    skip: false,
    wake: null,
    runErr: null,        // 실행 오류가 난 노드 id(노드 모드)
    previewOpen: true,
    ed: null,
    codeTimer: null,
    destroyed: false,
    lastHtml: "",        // 실행 결과 칸
    textEdited: new Set(), // v0.12.1 이번에 학습자가 직접 쓴 앞·뒤 글자("노드id:pre") — 값을 바꿔도 비우지 않음
  };

  root.innerHTML = `<div class="screen garden" data-state="idle">
    <header class="g-top">
      <button class="icon-btn" id="g-back" aria-label="${t`돌아가기`}">${icon("back")}</button>
      <h1>${t`파이의 텃밭`}</h1>
      <p class="g-store" id="g-store"></p>
    </header>
    <main class="g-main">
      <section class="g-board" aria-label="${t`텃밭`}">
        <div id="board" class="g-board-svg"></div>
        <p class="g-now mono" id="g-now" hidden></p>
        <div class="g-tools" id="g-tools"${tomatoOpen || notesOpen ? "" : " hidden"}>
          ${tomatoOpen ? `<p class="g-seeds" id="g-seeds"></p>` : ""}
          ${notesOpen ? `<button class="btn ghost small g-notes-btn" id="g-notes" aria-haspopup="dialog">${icon("book")}<span>${t`쪽지함`}</span></button>` : ""}
        </div>
      </section>
      <div id="g-result" class="g-result" role="status" aria-live="polite"></div>
      <section class="panel g-order" id="g-order" aria-labelledby="g-order-title"></section>
      <section class="g-prog" id="g-prog" aria-labelledby="g-prog-title"></section>
      <details class="g-code" id="g-code" open>
        <summary><span>${t`파이썬 코드 보기`}</span></summary>
        <pre class="code g-lines" id="g-lines"></pre>
      </details>
    </main>
    <footer class="g-foot" id="g-foot">
      <div class="symwrap" id="g-syms" hidden>
        <div class="symbols" role="toolbar" aria-label="${t`기호 넣기`}">
          ${SYMBOL_ORDER.map((sy, i) => sy.act
            ? `<button class="sym word" data-s="${i}" data-act="${esc(sy.act)}"${sy.aria ? ` aria-label="${esc(sy.aria)}"` : ""}>${esc(sy.label)}</button>`
            : `<button class="sym mono" data-s="${i}" aria-label="${esc(t`${sy.aria || sy.label} 넣기`)}">${esc(sy.label)}</button>`).join("")}
        </div>
      </div>
      <p class="py-chip" id="g-py" hidden></p>
      <div class="g-actions" id="g-idle">
        <button class="btn ghost" id="g-grow">${icon("sprout")}<span>${t`성장`}</span></button>
        <button class="btn primary" id="g-run">${icon("play")}<span>${t`실행`}</span></button>
      </div>
      <div class="g-actions" id="g-replay" hidden>
        <button class="btn ghost" id="g-speed" aria-label="${t`재생 속도 ${1}배, 누르면 ${2}배`}">${t`${1}배`}</button>
        <button class="btn sun" id="g-skip">${icon("skip")}<span>${t`건너뛰기`}</span></button>
      </div>
    </footer>
  </div>`;

  const scr = root.querySelector(".screen.garden");
  const boardEl = root.querySelector("#board");
  const nowEl = root.querySelector("#g-now");
  const resultEl = root.querySelector("#g-result");
  const orderEl = root.querySelector("#g-order");
  const progEl = root.querySelector("#g-prog");
  const codeEl = root.querySelector("#g-code");
  const linesEl = root.querySelector("#g-lines");
  const foot = root.querySelector("#g-foot");
  const runBtn = root.querySelector("#g-run");
  const symWrap = root.querySelector("#g-syms");
  const pyChip = root.querySelector("#g-py");

  // ---- 저장 ----
  function save(g) {
    S.garden = g;
    ctx.commit({ ...ctx.save, garden: g });
  }
  /** 주문을 해냈을 때: XP(한 번만)를 저장에 넣고 결과를 돌려줌 */
  function grant(order) {
    const r = grantOrderXP({ ...ctx.save, garden: S.garden }, order, new Date());
    ctx.commit(r.save);
    S.garden = r.save.garden;
    return r.result;
  }
  /**
   * 해낸 주문(first, 이미 S.garden에 반영됨)의 XP를 주고, 이어서 지금 상태로 끝나는 주문(미리 산 밭 넓히기 등)도
   * 모두 끝내 XP를 준다(검토 C62 I3). 저장은 여기서 다 하고, 창은 showOrders가 차례로 띄운다.
   * @returns [{ order, res }]
   */
  function finishOrders(first) {
    const list = [];
    if (first) list.push({ order: first, res: grant(first) });
    const st = settleAll(S.garden, passed);
    if (st.orders.length) {
      save(st.garden);
      for (const o of st.orders) list.push({ order: o, res: grant(o) });
    }
    // v0.12.1: 창을 보여 주기 전에 떠나거나 새로 고쳐도 다음에 열 때 보이게(창을 닫으면 orderDone이 뺌)
    if (list.length) save(addPendingDone(S.garden, list.map((x) => x.order.id)));
    return list;
  }
  async function showOrders(list) {
    for (let i = 0; i < list.length; i++) {
      if (S.destroyed) return;
      const next = list[i + 1] ? { order: list[i + 1].order, waiting: false } : currentOrder(S.garden, passed);
      await orderDone(list[i].order, list[i].res, next);
    }
  }

  // ---- 위 줄: 창고 ----
  // 토마토는 10장을 끝냈거나 창고에 있을 때만 보인다
  function shownCrops() {
    return Object.keys(CROP_ICON).filter((c) => c !== TOMATO || tomatoOpen || (S.garden.store[c] ?? 0) > 0);
  }
  function paintStore() {
    const st = S.garden.store;
    const crops = shownCrops();
    root.querySelector("#g-store").innerHTML = crops.map((c) =>
      `<span class="g-crop-count" data-crop="${esc(c)}">${CROP_ICON[c]}<b>${st[c] ?? 0}</b><span class="sr">${esc(cropCount(c, st[c] ?? 0))}</span></span>`).join("")
      + `<span class="sr">${t`창고`}</span>`;
    root.querySelector("#g-store").setAttribute("aria-label", t`창고: ${crops.map((c) => cropCount(c, st[c] ?? 0)).join(", ")}`);
    const sd = root.querySelector("#g-seeds");
    if (sd) {
      const n = cleanSeeds(S.garden.seeds);
      // 글 그대로 읽힌다(「토마토 씨앗 n」) — <p>에 aria-label을 달지 않음(판정 C71)
      sd.innerHTML = `${SEED_ICON}<span>${t`토마토 씨앗`} <b>${n}</b></span>`;
      sd.classList.toggle("empty", n === 0);
    }
  }

  // ---- 텃밭 그림 ----
  function paintBoard(state = runInput(S.garden), overlay = S.overlay) {
    boardEl.innerHTML = farmSVG(state, { facing: S.facing, ...overlay });
  }

  // ---- 주문 게시판 ----
  function paintOrder() {
    const { order, waiting } = currentOrder(S.garden, passed);
    const idx = S.garden.order.idx;
    const face = !order ? "sparkle" : waiting ? "think" : "smile";
    let main;
    if (!order) {
      main = `<p class="g-order-tag">${t`주문 ${ORDERS.length}/${ORDERS.length}`}</p>
        <h2 id="g-order-title">${t`주문을 모두 해냈어요!`}</h2>
        <p class="g-order-text">${t`고마워요. 텃밭은 계속 가꿀 수 있어요. 코드로 쓰기에도 도전해 봐요.`}</p>`;
    } else {
      const g = order.goal;
      let extra = "";
      if (waiting) {
        extra = `<p class="g-wait">${icon("lock")}<span>${esc(tp("order", "{}장을 끝내면 이어져요", order.need))}</span></p>`;
      } else if (g.type === "deliver") {
        const have = S.garden.store[g.crop] ?? 0;
        const ok = have >= g.n;
        extra = `<div class="g-deliver">
          <div class="g-prog-row">${bar(have, g.n, "g-bar", t`${cropWord(g.crop, 2)} 모으기`)}<span class="g-num-small">${Math.min(have, g.n)}/${g.n}</span></div>
          <button class="btn sun" id="deliver"${ok ? "" : " disabled"}>${icon("send")}<span>${t`보내기`}</span></button>
          ${ok ? "" : `<p class="g-note">${esc(t`${cropWord(g.crop, g.n - have)} ${g.n - have}개를 더 모아요`)}</p>`}
        </div>`;
      } else if (g.type === "grid") {
        extra = `<p class="g-note">${t`밭 ${S.garden.size}×${S.garden.size} → ${g.size}×${g.size}`}</p>`;
      } else if (g.type === "use" && S.garden.mode === "code") {
        extra = `<p class="g-note warn">${t`이 주문은 노드로 실행해야 해요. 「${t`노드로 돌아가기`}」를 눌러요.`}</p>`;
      }
      main = `<p class="g-order-tag">${t`주문 ${idx + 1}/${ORDERS.length}`}</p>
        <h2 id="g-order-title">${esc(order.title)}</h2>
        <p class="g-order-text">${esc(order.text)}</p>
        <p class="g-goal">${icon("check")}<span>${esc(goalText(order))}</span></p>
        ${extra}`;
    }
    orderEl.innerHTML = `<div class="g-order-ria">${riaSVG({ outfit: ctx.save.outfit, face, size: 52 })}</div>
      <div class="g-order-main">${main}</div>`;
    const d = orderEl.querySelector("#deliver");
    if (d) d.addEventListener("click", doDeliver);
  }

  // ---- 노드 흐름 ----
  // 목록에서 하나씩 노드 id → 코드의 변수 이름(codegen이 정한 그대로: for crop in [...])
  let feNames = new Map();
  function foreachNames(prog) {
    const { code, lineMap } = codegen(prog);
    const m = new Map();
    code.split("\n").forEach((l, i) => {
      const r = /^\s*for (\w+) in \[/.exec(l);
      const id = lineMap[i + 1];
      if (r && id != null && !m.has(id)) m.set(id, r[1]);
    });
    return m;
  }
  const feName = (n) => feNames.get(n.id) || LV_DEF[n.args?.list?.type] || "crop";
  function nodeRow(n, depth, errs) {
    const spec = NODES[n.kind];
    const label = spec ? spec.label : n.kind;
    const mine = errs.filter((e) => e.nodeId === n.id).map((e) => e.msg);
    if (S.runErr === n.id) mine.push(t`여기서 오류가 났어요`);
    const bad = mine.length > 0;
    const lv = (ty) => loopVarAvailable(S.garden.program, n.id, ty) || LV_DEF[ty];
    const chips = argChips(n, lv).map((c) =>
      `<button class="g-arg${c.mono ? " mono" : ""}" data-arg="${c.arg}" aria-label="${esc(t`${label}: ${c.text}, 바꾸기`)}">${esc(c.text)}</button>`).join("");
    const made = n.kind === "where" ? "x, y" : n.kind === "readnote" ? "line" : n.kind === "splitline" ? "crop, n"
      : n.kind === "findall" ? (PATTERNS[n.args?.pattern]?.vars ?? []).join(", ") : "";
    const extra = n.kind === "foreach" ? `<span class="g-var mono" aria-label="${esc(t`목록 변수 ${feName(n)}`)}">${esc(feName(n))}</span>`
      : made ? `<span class="g-hint">${esc(n.kind === "where" ? t`${made}가 생겨요` : t`${made}이 생겨요`)}</span>` : "";
    return `<div class="g-node ${chapterClass(n.kind)}${bad ? " bad" : ""}" data-id="${esc(n.id)}" data-kind="${esc(n.kind)}" data-depth="${depth}">
      <div class="g-node-main"><span class="g-kind">${esc(label)}</span>${chips}${extra}</div>
      <button class="g-menu" aria-label="${esc(t`${label} 노드 메뉴`)}">${icon("more")}</button>
      ${bad ? `<p class="g-err">${mine.map((m) => `<span>${esc(m)}</span>`).join("")}</p>` : ""}
    </div>`;
  }
  function addBtn(parent, slot) {
    return `<li class="g-add-li"><button class="g-add" data-parent="${parent ?? ""}" data-slot="${slot}">${icon("plus")}<span>${t`노드`}</span></button></li>`;
  }
  function listHTML(list, depth, errs, parent, slot) {
    const items = (list || []).map((n) => {
      let inner = nodeRow(n, depth, errs);
      if (NODES[n.kind]?.body) {
        inner += `<ol class="g-body" aria-label="${esc(t`${NODES[n.kind].label} 안`)}">${listHTML(n.body, depth + 1, errs, n.id, "body")}</ol>`;
        if (Array.isArray(n.orelse)) {
          inner += `<p class="g-else">${t`아니면`}</p><ol class="g-body" aria-label="${t`아니면 안`}">${listHTML(n.orelse, depth + 1, errs, n.id, "orelse")}</ol>`;
        }
        // 시도하기: 안 되면 칸(늘 있음, except ValueError:)
        if (NODES[n.kind].handler) {
          inner += `<p class="g-else">${t`안 되면`}</p><ol class="g-body" aria-label="${t`안 되면 안`}">${listHTML(n.handler || [], depth + 1, errs, n.id, "handler")}</ol>`;
        }
      }
      return `<li class="g-item">${inner}</li>`;
    }).join("");
    return items + addBtn(parent, slot);
  }

  function paintProg() {
    const code = S.garden.mode === "code";
    if (code) {
      if (!S.ed) {
        progEl.innerHTML = `<div class="g-prog-head"><h2 id="g-prog-title">${icon("code")}<span>${t`파이썬 코드`}</span></h2>
          <button class="btn ghost small" id="to-nodes">${t`노드로 돌아가기`}</button></div>
          <p class="g-mode-note">${t`명령:`} <code>move("${esc(dirName(DIR_RIGHT))}")</code> <code>plant("${esc(cropName(CARROT))}")</code> <code>harvest()</code> <code>can_harvest()</code> <code>what_here()</code> <code>store()</code> <code>where()</code>${tomatoOpen ? " <code>seeds()</code>" : ""}${notesOpen ? " <code>open()</code>" : ""} <code>print()</code></p>
          <div class="editor-box g-editor" id="g-ed"></div>`;
        S.ed = createEditor(progEl.querySelector("#g-ed"), {
          doc: S.garden.code || "",
          label: t`텃밭 코드 입력창. 여기에 Python 코드를 써요`,
          margins: () => ({ top: root.querySelector(".g-top").getBoundingClientRect().bottom + 8, bottom: window.innerHeight - foot.getBoundingClientRect().top + 8 }),
          onChange: () => {
            S.ed.markLine(null);
            if (S.codeTimer) clearTimeout(S.codeTimer);
            S.codeTimer = setTimeout(flushCode, CODE_SAVE_MS);
          },
        });
        progEl.querySelector("#to-nodes").addEventListener("click", toNodes);
      }
      codeEl.hidden = true;
      symWrap.hidden = false;
      return;
    }
    if (S.ed) { flushCode(); S.ed.destroy(); S.ed = null; }
    symWrap.hidden = true;
    codeEl.hidden = false;
    const prog = S.garden.program;
    const errs = validate(prog, unlocked);
    feNames = foreachNames(prog);
    const empty = !prog.length;
    progEl.innerHTML = `<div class="g-prog-head"><h2 id="g-prog-title">${icon("sprout")}<span>${t`파이에게 시킬 일`}</span></h2>
        <button class="btn ghost small" id="g-clear" aria-label="${t`노드 모두 지우기`}"${empty ? ` disabled aria-disabled="true"` : ""}>${icon("trash")}<span>${t`비우기`}</span></button>
        <button class="btn ghost small" id="to-code">${icon("code")}<span>${t`코드로 쓰기`}</span></button></div>
      <ol class="g-flow" aria-label="${t`노드 흐름(위에서부터 차례로 실행)`}">${listHTML(prog, 0, errs, null, "body")}</ol>
      <p class="g-count">${t`노드 ${countNodes(prog)}/${MAX_NODES}`}</p>`;
    progEl.querySelector("#to-code").addEventListener("click", toCode);
    progEl.querySelector("#g-clear").addEventListener("click", clearAll);
    paintPreview();
  }

  function paintPreview() {
    if (S.garden.mode === "code") return;
    const { code } = codegen(S.garden.program);
    const lines = code ? code.replace(/\n$/, "").split("\n") : [];
    linesEl.innerHTML = lines.length
      ? lines.map((l, i) => `<span class="g-line" data-line="${i + 1}" data-text="${esc(l)}"><span class="g-ln" aria-hidden="true">${i + 1}</span>${esc(l)}</span>`).join("")
      : `<span class="g-line empty" data-line="0" data-text="">${t`(노드가 없어요)`}</span>`;
  }

  // ---- 지금 줄 표시(재생 중) ----
  let lastNow = null;
  function markNow(line, lineMap, code) {
    if (lastNow === line) return;
    lastNow = line;
    root.querySelectorAll(".g-node.now, .g-line.now").forEach((e) => e.classList.remove("now"));
    if (line == null) {
      nowEl.hidden = true;
      if (S.ed) S.ed.markNow(null);
      return;
    }
    const lines = code.split("\n");
    nowEl.hidden = false;
    nowEl.innerHTML = `<span class="g-ln">${line}</span>${esc((lines[line - 1] || "").trim())}`;
    if (S.garden.mode === "code") {
      if (S.ed) S.ed.markNow(line);
      return;
    }
    const id = lineMap ? lineMap[line] : null;
    if (id != null) {
      const row = root.querySelector(`.g-node[data-id="${CSS.escape(String(id))}"]`);
      if (row) row.classList.add("now");
    }
    const l = linesEl.querySelector(`.g-line[data-line="${line}"]`);
    if (l) l.classList.add("now");
  }

  // ---- Python 준비 상태 ----
  function paintPy() {
    const { status, phase } = ctx.pyState();
    const busy = S.state !== "idle";
    runBtn.disabled = busy || status !== "ready";
    if (status === "ready") { pyChip.hidden = true; return; }
    pyChip.hidden = false;
    if (status === "error") {
      pyChip.className = "py-chip err";
      pyChip.innerHTML = `${t`파이썬을 받지 못했어요. 인터넷 연결을 확인해 주세요.`} <button class="link" id="g-pyretry">${t`다시 시도`}</button>`;
      pyChip.querySelector("#g-pyretry").addEventListener("click", () => { ctx.py.preload().catch(() => {}); });
    } else {
      pyChip.className = "py-chip";
      pyChip.innerHTML = `<span class="dot" aria-hidden="true"></span>${phase === "restart" ? t`다시 준비 중` : t`파이썬 준비 중`}`;
    }
  }
  const offPy = ctx.onPy(paintPy);

  function setState(st) {
    S.state = st;
    scr.dataset.state = st;
    root.querySelector("#g-idle").hidden = st === "replay";
    root.querySelector("#g-replay").hidden = st !== "replay";
    progEl.inert = st !== "idle";
    root.querySelector("#g-grow").disabled = st !== "idle";
    const nb = root.querySelector("#g-notes");
    if (nb) nb.disabled = st !== "idle";
    orderEl.inert = st !== "idle";
    paintPy();
  }

  function paintAll() {
    paintStore();
    paintBoard();
    paintOrder();
    paintProg();
    paintPy();
  }

  // ---- 편집 ----
  function nextId() {
    let max = 0;
    const walk = (list) => (list || []).forEach((n) => {
      if (Number.isInteger(n.id) && n.id > max) max = n.id;
      walk(n.body); walk(n.orelse);
    });
    walk(S.garden.program);
    return max + 1;
  }
  function setProgram(p) {
    dropUndo();
    S.runErr = null;
    save({ ...S.garden, program: p });
    paintProg();
  }
  // 비우기: 확인 → 빈 프로그램 저장 → 5초 동안 「되돌리기」(그 사이 다른 편집·모드 바꾸기·떠나기면 되돌리기 없앰)
  let undoClose = null;
  function dropUndo() { if (undoClose) { undoClose(); undoClose = null; } }
  async function clearAll() {
    const prev = S.garden.program;
    const n = countNodes(prev);
    if (S.state !== "idle" || S.garden.mode !== "nodes" || !n) return;
    const ok = await dialog({
      title: t`노드 ${n}개를 모두 지울까요?`,
      buttons: [{ label: tp("cancel", "그만두기"), value: false }, { label: t`지우기`, value: true, kind: "coral" }],
    });
    if (!ok || S.destroyed || S.state !== "idle" || S.garden.program !== prev) return;
    setProgram([]);
    S.overlay = {};
    paintBoard();
    resultEl.innerHTML = `<p class="g-msg idle">${esc(runHint())}</p>`;
    focusFirst(addSel(null, "body"));
    const close = toast(t`노드를 모두 지웠어요`, "", {
      ms: UNDO_MS,
      action: {
        label: t`되돌리기`,
        onClick: () => {
          undoClose = null;
          if (S.destroyed || S.state !== "idle" || S.garden.mode !== "nodes") return;
          setProgram(prev);
          focusFirst("#g-clear");
        },
      },
    });
    undoClose = close;
  }
  // 편집 창이 닫힌 뒤 노드 흐름을 다시 그리면 누른 단추가 사라지므로, 그 노드(없으면 가까운 단추)로 초점을 옮긴다
  const nodeSel = (id) => `.g-node[data-id="${CSS.escape(String(id))}"]`;
  const addSel = (parentId, slot) => `.g-add[data-parent="${CSS.escape(parentId == null ? "" : String(parentId))}"][data-slot="${slot}"]`;
  function focusFirst(...sels) {
    for (const sel of sels) {
      const e = sel ? root.querySelector(sel) : null;
      if (e) { e.focus({ preventScroll: true }); return; }
    }
  }
  function findWithParent(list, id, parent = null, slot = "body") {
    for (let i = 0; i < (list || []).length; i++) {
      const n = list[i];
      if (String(n.id) === String(id)) return { node: n, list, index: i, parent, slot };
      for (const s of ["body", "orelse", "handler"]) {
        const r = findWithParent(n[s], id, n, s);
        if (r) return r;
      }
    }
    return null;
  }

  async function openAdd(parentId, slot) {
    const prog = S.garden.program;
    if (countNodes(prog) >= MAX_NODES) { toast(NODE_MSG.tooMany); return; }
    const top = parentId == null;
    const html = `<ul class="g-pick">${KIND_ORDER.map((k) => {
      const spec = NODES[k];
      const open = unlocked.has(k);
      const nested = k === "def" && !top;
      const why = !open ? NODE_MSG.locked(spec.chapter) : nested ? NODE_MSG.defTop : "";
      return `<li><button class="g-pick-btn ${chapterClass(k)}" data-v="${k}" data-kind="${k}"${why ? ` disabled aria-disabled="true"` : ""}>
        <span class="g-pick-name">${esc(spec.label)}</span>${why ? `<small>${esc(why)}</small>` : `<code>${esc(sampleCode(k))}</code>`}</button></li>`;
    }).join("")}</ul>`;
    const kind = await sheet({ title: t`노드 더하기`, html, cls: "g-add-sheet" });
    if (!kind || S.destroyed) return;
    // 부모 id는 화면 글자(data-parent)로 오므로 프로그램에서 찾아 원래 값(숫자·글자 그대로)을 쓴다
    let parent = null;
    if (!top) {
      const f = findWithParent(S.garden.program, parentId);
      if (!f) return;
      parent = f.node.id;
    }
    const n = newNode(kind, nextId());
    if (kind === "call") {
      const defs = S.garden.program.filter((x) => x.kind === "def").map((x) => x.args.name);
      if (defs.length) n.args.name = defs[0];
    }
    if (kind === "def") {
      const used = new Set(S.garden.program.filter((x) => x.kind === "def").map((x) => x.args.name));
      n.args.name = FUNC_NAMES.find((f) => !used.has(f)) || FUNC_NAMES[0];
    }
    if (kind === "foreach") {
      // 목록 종류는 만들 때 정한다(작물 목록 → crop, 방향 목록 → way)
      const lt = await sheet({
        title: t`어떤 목록인가요?`, cls: "g-ltype-sheet",
        html: `<ul class="g-pick">${LIST_TYPES.map((ty) => `<li><button class="g-pick-btn" data-v="${ty}">
          <span class="g-pick-name">${esc(listLabel(ty))}</span><code>${esc(LIST_ITEMS[ty].map((x) => itemName(ty, x)).join("·"))}</code></button></li>`).join("")}</ul>`,
      });
      if (!LIST_TYPES.includes(lt) || S.destroyed) return;
      n.args.list = { type: lt, items: LIST_DEFAULTS[lt].slice() };
    }
    let next = insertNode(S.garden.program, parent, slot, Infinity, n);
    if (kind === "sayval" || kind === "writelog") {
      // 그 자리에서 쓸 수 있는 첫 값(기억한 값 → x·y → 목록 값 → 쪽지 값). 없으면 기본 count 그대로(오류로 알려 줌)
      const first = availableValues(next, n.id)[0];
      // 쪽지 값·위치·목록 값이면 기본 「당근 」·「개」를 비움(v0.12.1, 「당근 수확 3개개」 막기)
      if (first) next = updateArgs(next, n.id, { var: first.arg, ...valueTextReset(kind, n.args, first.source) });
    }
    setProgram(next);
    focusFirst(`${nodeSel(n.id)} .g-arg`, `${nodeSel(n.id)} .g-menu`);
    ctx.sound.play("correct");
  }

  function sampleCode(kind) {
    const n = newNode(kind, 0);
    if (NODES[kind].body) n.body = [];
    // 패턴 찾기는 맨 위에 import re가 붙으므로 그 다음 줄
    return codegen([n]).code.split("\n").find((l) => l !== "import re") ?? "";
  }

  async function openMenu(id) {
    const f = findWithParent(S.garden.program, id);
    if (!f) return;
    const n = f.node;
    const spec = NODES[n.kind];
    const first = f.index === 0;
    const last = f.index === f.list.length - 1;
    const elseBtn = spec?.orelse
      ? (Array.isArray(n.orelse)
        ? `<li><button class="g-menu-btn" data-v="else-off" data-act="else-off">${t`아니면 떼기`}</button></li>`
        : `<li><button class="g-menu-btn" data-v="else-on" data-act="else-on">${t`아니면 붙이기`}</button></li>`)
      : "";
    const html = `<ul class="g-pick">
      <li><button class="g-menu-btn" data-v="up" data-act="up"${first ? " disabled" : ""}>${icon("up")}<span>${t`위로`}</span></button></li>
      <li><button class="g-menu-btn" data-v="down" data-act="down"${last ? " disabled" : ""}>${icon("down")}<span>${t`아래로`}</span></button></li>
      ${elseBtn}
      <li><button class="g-menu-btn danger" data-v="del" data-act="del">${icon("trash")}<span>${t`지우기`}${spec?.body && n.body?.length ? t` (안의 노드도 함께)` : ""}</span></button></li>
    </ul>`;
    const act = await sheet({ title: t`${spec ? spec.label : n.kind} 노드`, html, cls: "g-menu-sheet" });
    if (!act || S.destroyed) return;
    const menuOf = (id) => `${nodeSel(id)} .g-menu`;
    if (act === "up" || act === "down") {
      setProgram(moveNode(S.garden.program, n.id, act === "up" ? -1 : 1));
      focusFirst(menuOf(n.id));
    } else if (act === "else-on") {
      setProgram(setElse(S.garden.program, n.id, true));
      focusFirst(addSel(n.id, "orelse"), menuOf(n.id));
    } else if (act === "else-off") {
      const inside = countNodes(n.orelse || []);
      if (inside > 0) {
        const ok = await dialog({
          title: t`아니면을 뗄까요?`,
          body: `<p>${t`아니면 안의 노드 ${inside}개도 함께 지워져요.`}</p>`,
          buttons: [{ label: tp("cancel", "그만두기"), value: false }, { label: t`떼기`, value: true, kind: "primary" }],
        });
        if (!ok || S.destroyed) { focusFirst(menuOf(n.id)); return; }
      }
      setProgram(setElse(S.garden.program, n.id, false));
      focusFirst(menuOf(n.id));
    } else if (act === "del") {
      const after = f.list[f.index + 1] ?? f.list[f.index - 1] ?? null;
      setProgram(removeNode(S.garden.program, n.id));
      focusFirst(after ? menuOf(after.id) : null, addSel(f.parent ? f.parent.id : null, f.slot), menuOf(f.parent?.id ?? ""));
    }
  }

  async function openArg(id, arg) {
    const f = findWithParent(S.garden.program, id);
    if (!f) return;
    const n = f.node;
    const spec = NODES[n.kind];
    const aspec = spec.args[arg];
    const cur = n.args[arg];
    const ARG_NAME = {
      dir: () => t`방향`, crop: () => t`작물`, text: () => t`할 말`,
      name: () => (n.kind === "def" || n.kind === "call" ? t`내 노드 이름` : t`값 이름`), value: () => t`숫자`, n: () => t`몇 번`,
      cond: () => t`조건`, pre: () => t`앞 글자`, post: () => t`뒤 글자`, var: () => t`값`, list: () => t`목록`, file: () => t`쪽지`, pattern: () => t`패턴`,
    };
    const title = `${spec.label}: ${Object.hasOwn(ARG_NAME, arg) ? ARG_NAME[arg]() : arg}`;
    // 안쪽 열쇠(방향·작물·쪽지 이름)는 지금 언어 이름으로 보인다(data-v는 열쇠 그대로)
    const showVal = (c) => (arg === "dir" ? dirName(c) : arg === "crop" ? cropName(c) : arg === "file" ? fileName(c) : c);
    const refocus = () => focusFirst(`${nodeSel(n.id)} .g-arg[data-arg="${arg}"]`, `${nodeSel(n.id)} .g-menu`);
    // 잠긴 값(10장 전 토마토)은 흐리게 + 이유
    const lockOf = (c) => (c === TOMATO && !tomatoOpen ? NODE_MSG.locked(MARK_LOCKS[TOMATO_LOCK]) : "");
    const listBtns = (choices, mono) => `<ul class="g-pick">${choices.map((c) => {
      const on = String(c) === String(cur);
      const why = lockOf(c);
      return `<li><button class="g-pick-btn${on ? " on" : ""}" data-v="${esc(c)}"${on ? ' aria-current="true"' : ""}${why ? ' disabled aria-disabled="true"' : ""}>${mono ? `<code>${esc(c)}</code>` : `<span class="g-pick-name">${esc(showVal(c))}</span>`}${why ? `<small>${esc(why)}</small>` : ""}</button></li>`;
    }).join("")}</ul>`;
    const extraBtn = (v, name, code, on) => `<li><button class="g-pick-btn g-lv${on ? " on" : ""}" data-v="${v}"${on ? ' aria-current="true"' : ""}>
      <span class="g-pick-name">${esc(name)}</span><code>${esc(code)}</code></button></li>`;
    const addBtns = (html, more) => (more ? html.replace(/<\/ul>$/, `${more}</ul>`) : html);
    const noValHTML = () => `<p class="g-note">${esc(t`여기서 쓸 수 있는 값이 없어요. 위쪽에서 「${NODES.setvar.label}」·「${NODES.where.label}」로 값을 먼저 만들어요.`)}</p>`;

    if (aspec.type === "choice" && arg === "pattern") {
      // 패턴 찾기: 이름 + 정규식 미리보기 + 생기는 값
      const v = await sheet({
        title, cls: "g-pattern-sheet",
        html: `<p class="g-note">${t`쪽지 줄(line)에서 패턴에 맞는 글자를 모두 찾아 하나씩 꺼내요.`}</p><ul class="g-pick">${aspec.choices.map((id) => {
          const p = PATTERNS[id];
          const on = id === cur;
          return `<li><button class="g-pick-btn g-pat${on ? " on" : ""}" data-v="${esc(id)}"${on ? ' aria-current="true"' : ""}>
            <span class="g-pick-name">${esc(p.label)}<small>${esc(t`${p.vars.join(", ")}이 생겨요`)}</small></span>
            <code class="g-re">r"${esc(p.re)}"</code></button></li>`;
        }).join("")}</ul>`,
      });
      if (v == null || S.destroyed || !PATTERNS[v]) return;
      setProgram(updateArgs(S.garden.program, n.id, { pattern: v }));
      refocus();
      return;
    }
    if (aspec.type === "choice") {
      const mono = arg === "name";
      let note = "";
      if (n.kind === "call") {
        const defs = S.garden.program.filter((x) => x.kind === "def").map((x) => x.args.name);
        note = `<p class="g-note">${defs.length ? t`만든 내 노드: ${defs.map((d) => `<code>${esc(d)}</code>`).join(" ")}` : esc(t`먼저 「${NODES.def.label}」로 만들어요`)}</p>`;
      }
      // 목록에서 하나씩 안이면 그 목록 변수(crop·way)도 고를 수 있다
      const lvName = aspec.loopType ? loopVarAvailable(S.garden.program, n.id, aspec.loopType) : null;
      // 줄 나누기·패턴 찾기 뒤의 심기는 쪽지 값 crop도 고를 수 있다
      const nvName = aspec.noteVar ? noteVarAvailable(S.garden.program, n.id, aspec.noteVar) : null;
      if (n.kind === "readnote") note = `<p class="g-note">${esc(t`쪽지함의 쪽지예요. 받은 쪽지는 읽기만 하고, ${fileName(LOG_FILE)}는 ${NODES.writelog.label}로 써요.`)}</p>`;
      const html = addBtns(note + listBtns(aspec.choices, mono),
        (lvName ? extraBtn("__loop", t`목록 값`, lvName, isLV(cur)) : "") + (nvName ? extraBtn("__note", t`쪽지 값`, nvName, isNV(cur)) : ""));
      const v = await sheet({ title, html });
      if (v == null || S.destroyed) return;
      const nv = v === "__loop" ? { loopVar: true, type: aspec.loopType } : v === "__note" ? { noteVar: aspec.noteVar } : v;
      setProgram(updateArgs(S.garden.program, n.id, { [arg]: nv }));
      refocus();
      return;
    }
    if (aspec.type === "int") {
      // 반복 횟수: 쪽지 값 n이 있는 자리면 「쪽지 값 n번」(range(int(n)))도 고를 수 있다
      const num = Number.isInteger(cur) ? cur : aspec.default;
      let get = () => num;
      const nvName = aspec.noteValue ? noteVarAvailable(S.garden.program, n.id, aspec.noteValue) : null;
      const noteHTML = nvName ? `<ul class="g-pick g-pick-note">${extraBtn("__note", t`쪽지 값 ${nvName}번`, `range(int(${nvName}))`, isNC(cur))}</ul>
          <p class="g-note">${t`또는 수로 정하기`}</p>` : "";
      const v = await sheet({
        title,
        html: `${noteHTML}${stepperHTML("g-step", num, aspec.min, aspec.max)}<p class="g-note">${t`${aspec.min}부터 ${aspec.max}까지`}</p>
          <button class="btn primary wide" id="g-ok">${t`정하기`}</button>`,
        bind: (box, done) => {
          get = bindStepper(box.querySelector("#g-step"));
          box.querySelector("#g-ok").addEventListener("click", () => done("ok"));
        },
      });
      if ((v !== "ok" && v !== "__note") || S.destroyed) return;
      setProgram(updateArgs(S.garden.program, n.id, { [arg]: v === "__note" ? { value: aspec.noteValue } : get() }));
      refocus();
      return;
    }
    if (aspec.type === "text") {
      const min = aspec.min ?? 1;
      let val = cur;
      const v = await sheet({
        title,
        html: `<label class="g-label" for="g-text">${arg === "pre" ? t`값 앞에 붙일 글자` : arg === "post" ? t`값 뒤에 붙일 글자` : t`파이가 말풍선으로 말해요`} (${min ? t`${aspec.max}자까지` : t`${aspec.max}자까지, 비워도 돼요`})</label>
          <input class="g-input" id="g-text" type="text" value="${esc(cur)}" autocomplete="off" enterkeyhint="done" data-autofocus>
          <p class="g-note" id="g-text-n"></p>
          <button class="btn primary wide" id="g-ok">${t`정하기`}</button>`,
        bind: (box, done) => {
          const inp = box.querySelector("#g-text");
          const cnt = box.querySelector("#g-text-n");
          const ok = box.querySelector("#g-ok");
          const paint = () => {
            const len = [...inp.value].length;
            const empty = min > 0 && !inp.value.trim();
            const good = !empty && len <= aspec.max;
            cnt.textContent = t`${len}/${aspec.max}자` + (len > aspec.max ? t` · 너무 길어요` : empty ? t` · 한 글자 이상 써요` : "");
            cnt.classList.toggle("bad", !good);
            ok.disabled = !good;
            val = inp.value;
          };
          inp.addEventListener("input", paint);
          inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !ok.disabled) { e.preventDefault(); done("ok"); } });
          ok.addEventListener("click", () => done("ok"));
          paint();
        },
      });
      if (v !== "ok" || S.destroyed) return;
      S.textEdited.add(`${n.id}:${arg}`);
      setProgram(updateArgs(S.garden.program, n.id, { [arg]: val }));
      refocus();
      return;
    }
    if (aspec.type === "value") {
      const vals = availableValues(S.garden.program, n.id);
      const same = (x) => (isLV(cur) ? isLV(x.arg) && x.arg.type === cur.type
        : isNV(cur) ? isNV(x.arg) && x.arg.noteVar === cur.noteVar : x.arg === cur);
      // 일지 쓰기는 값 없이 글자만 쓸 수도 있다(앞·뒤 글자 중 하나는 있어야)
      const noneOk = !!aspec.optional && ((n.args.pre ?? "") !== "" || (n.args.post ?? "") !== "");
      const none = aspec.optional ? `<li><button class="g-pick-btn g-lv${cur == null ? " on" : ""}" data-v="none"${noneOk ? "" : ' disabled aria-disabled="true"'}>
          <span class="g-pick-name">${t`값 없이 글자만`}</span>${noneOk ? `<code>${esc(`"${n.args.pre ?? ""}${n.args.post ?? ""}"`)}</code>` : `<small>${t`앞·뒤 글자를 먼저 써요`}</small>`}</button></li>` : "";
      const v = await sheet({
        title,
        html: vals.length || none ? `<ul class="g-pick">${vals.map((x, i) => `<li><button class="g-pick-btn${same(x) ? " on" : ""}" data-v="${i}" data-name="${esc(x.name)}">
            <code class="g-pick-name">${esc(x.name)}</code><small>${esc(VAL_SRC[x.source]?.() ?? "")}</small></button></li>`).join("")}${none}</ul>`
            + (vals.length ? "" : noValHTML())
          : noValHTML(),
      });
      if (v === "none" && noneOk && !S.destroyed) {
        setProgram(updateArgs(S.garden.program, n.id, { [arg]: null }));
        refocus();
        return;
      }
      if (v == null || S.destroyed || !vals[+v]) return;
      // 쪽지 값·위치·목록 값을 고르면 기본 앞·뒤 글자는 비움(이번에 직접 쓴 글자는 둠, v0.12.1)
      const reset = valueTextReset(n.kind, n.args, vals[+v].source);
      for (const k of Object.keys(reset)) if (S.textEdited.has(`${n.id}:${k}`)) delete reset[k];
      setProgram(updateArgs(S.garden.program, n.id, { [arg]: vals[+v].arg, ...reset }));
      refocus();
      return;
    }
    if (aspec.type === "list") {
      // 저장 정리가 목록 모양을 맞추지만, 혹시 이상한 값이 와도 창이 깨지지 않게 기본 목록으로 연다
      const L = cleanList(cur);
      const name = feName(n);
      let sel = -1;
      const v = await sheet({
        title, cls: "g-list-sheet",
        html: `<p class="g-note">${esc(listLabel(L.type))} · ${t`하나씩 꺼낸 값의 이름`} <code>${esc(name)}</code></p>
          <ol class="g-li" id="g-li" aria-label="${t`목록 칸(눌러서 고르기)`}"></ol>
          <div class="g-li-tools">
            <button class="btn ghost" id="g-li-left" aria-label="${t`고른 칸 앞으로`}">←</button>
            <button class="btn ghost" id="g-li-right" aria-label="${t`고른 칸 뒤로`}">→</button>
            <button class="btn ghost" id="g-li-del">${icon("trash")}<span>${t`빼기`}</span></button>
          </div>
          <p class="g-note" id="g-li-n"></p>
          <div class="g-li-add">${LIST_ITEMS[L.type].filter((it) => !lockOf(it)).map((it) => `<button class="btn ghost" data-add="${esc(it)}">${icon("plus")}<span>${esc(itemName(L.type, it))}</span></button>`).join("")}</div>
          <pre class="code g-li-code"></pre>
          <button class="btn primary wide" id="g-ok">${t`정하기`}</button>`,
        bind: (box, done) => {
          const ol = box.querySelector("#g-li");
          const q = (s) => box.querySelector(s);
          const paint = (focusSel) => {
            ol.innerHTML = L.items.map((it, i) => `<li><button class="g-li-item${i === sel ? " on" : ""}" data-i="${i}" data-item="${esc(it)}" aria-pressed="${i === sel}">
              <small>${i + 1}</small>${esc(itemName(L.type, it))}</button></li>`).join("");
            q("#g-li-left").disabled = sel <= 0;
            q("#g-li-right").disabled = sel < 0 || sel >= L.items.length - 1;
            q("#g-li-del").disabled = sel < 0 || L.items.length <= 1;
            box.querySelectorAll("[data-add]").forEach((b) => { b.disabled = L.items.length >= LIST_MAX; });
            q("#g-li-n").textContent = t`${L.items.length}/${LIST_MAX}개` + (sel < 0 ? t` · 칸을 눌러 고르면 옮기거나 뺄 수 있어요` : "");
            q(".g-li-code").textContent = `for ${name} in [${L.items.map((x) => JSON.stringify(itemName(L.type, x))).join(", ")}]:`;
            if (focusSel && sel >= 0) ol.querySelector(`[data-i="${sel}"]`)?.focus({ preventScroll: true });
          };
          // 누른 단추가 막히면(빼기 뒤·6개가 참) 초점이 몸통으로 빠지지 않게 옮긴다
          const keepFocus = (sel2) => (typeof sel2 === "string" ? box.querySelector(sel2) : ol.querySelector(`[data-i="${sel2}"]`))
            ?.focus({ preventScroll: true });
          const swap = (d) => {
            const j = sel + d;
            if (sel < 0 || j < 0 || j >= L.items.length) return;
            [L.items[sel], L.items[j]] = [L.items[j], L.items[sel]];
            sel = j;
            paint();
          };
          ol.addEventListener("click", (e) => {
            const b = e.target.closest("[data-i]");
            if (!b) return;
            sel = sel === +b.dataset.i ? -1 : +b.dataset.i;
            paint(true);
          });
          q("#g-li-left").addEventListener("click", () => swap(-1));
          q("#g-li-right").addEventListener("click", () => swap(1));
          q("#g-li-del").addEventListener("click", () => {
            if (sel < 0 || L.items.length <= 1) return;
            const at = Math.min(sel, L.items.length - 2);
            L.items.splice(sel, 1);
            sel = -1;
            paint();
            keepFocus(at);
          });
          box.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
            if (L.items.length >= LIST_MAX) return;
            L.items.push(b.dataset.add);
            paint();
            if (L.items.length >= LIST_MAX) keepFocus("#g-ok");
          }));
          q("#g-ok").addEventListener("click", () => done("ok"));
          paint();
        },
      });
      if (v !== "ok" || S.destroyed) return;
      setProgram(updateArgs(S.garden.program, n.id, { list: L }));
      refocus();
      return;
    }
    if (aspec.type === "cond") {
      // 창고 비교 { store } 와 값 비교 { var } 는 둘 다 객체라 따로 가른다
      const isStore = isStoreCond(cur);
      const isVar = !!cur && typeof cur === "object" && !isStore;
      const varOpen = unlocked.has("setvar");
      const storeOpen = unlocked.has("cond:store");
      const vc = isVar ? { ...cur } : { var: VAR_NAMES[0], op: "<", num: 5 };
      const sc = isStore ? { ...cur.store } : { crop: CROP_NAMES[0], op: "<", num: 10 };
      // 값 비교에 쓸 이름: 기억하기 이름 + 이 자리에서 쓸 수 있는 x·y(목록 변수는 빼고)
      const pos = availableValues(S.garden.program, n.id).filter((x) => x.source === "pos").map((x) => x.name);
      const names = [...VAR_NAMES, ...pos];
      if (isVar && !names.includes(vc.var)) names.push(vc.var);
      let getNum = () => vc.num;
      let getNum2 = () => sc.num;
      const segHTML = (label, attr, list, on, show = (x) => x) => `<div class="g-seg" role="radiogroup" aria-label="${esc(label)}">${list.map((x) =>
        `<button class="g-seg-btn mono${x === on ? " on" : ""}" role="radio" aria-checked="${x === on}" data-${attr}="${esc(x)}">${esc(show(x))}</button>`).join("")}</div>`;
      const storeHTML = storeOpen ? `<section class="g-varcond g-storecond">
          <h3>${t`창고 보기`} <code>store()</code></h3>
          ${segHTML(t`작물`, "scrop", CROP_NAMES.filter((c) => !lockOf(c) || c === sc.crop), sc.crop, cropName)}${segHTML(t`비교`, "sop", OPS, sc.op)}
          ${stepperHTML("g-step2", sc.num, VALUE_RANGE.min, VALUE_RANGE.max)}
          <button class="btn primary wide" id="g-store-ok">${t`창고 보기로 정하기`}</button>
        </section>` : `<section class="g-varcond g-storecond locked"><h3>${icon("lock")}<span>${t`창고 보기`}</span></h3>
          <p class="g-note">${esc(NODE_MSG.locked(COND_LOCKS["cond:store"]))}</p></section>`;
      const varHTML = varOpen ? `<section class="g-varcond">
          <h3>${t`값과 비교하기`}</h3>
          ${segHTML(t`값 이름`, "var", names, vc.var)}${segHTML(t`비교`, "op", OPS, vc.op)}
          ${stepperHTML("g-step", vc.num, VALUE_RANGE.min, VALUE_RANGE.max)}
          <button class="btn primary wide" id="g-ok">${t`값 비교로 정하기`}</button>
        </section>` : `<p class="g-note">${esc(NODE_MSG.locked(NODES.setvar.chapter))}: ${t`값과 비교하기`}</p>`;
      const v = await sheet({
        title,
        html: `<ul class="g-pick">${COND.map((c) => `<li><button class="g-pick-btn${!isVar && c.id === cur ? " on" : ""}" data-v="${c.id}">
          <span class="g-pick-name">${esc(c.label)}</span><code>${esc(c.code)}</code></button></li>`).join("")}</ul>${varHTML}${storeHTML}`,
        bind: (box, done) => {
          const seg = (attr, obj, key) => box.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener("click", () => {
            obj[key] = b.dataset[attr];
            box.querySelectorAll(`[data-${attr}]`).forEach((x) => {
              const on = x === b;
              x.classList.toggle("on", on);
              x.setAttribute("aria-checked", String(on));
            });
          }));
          if (varOpen) {
            seg("var", vc, "var");
            seg("op", vc, "op");
            getNum = bindStepper(box.querySelector("#g-step"));
            box.querySelector("#g-ok").addEventListener("click", () => done("var"));
          }
          if (storeOpen) {
            seg("scrop", sc, "crop");
            seg("sop", sc, "op");
            getNum2 = bindStepper(box.querySelector("#g-step2"));
            box.querySelector("#g-store-ok").addEventListener("click", () => done("store"));
          }
        },
      });
      if (v == null || S.destroyed) return;
      const cond = v === "var" ? { var: vc.var, op: vc.op, num: getNum() }
        : v === "store" ? { store: { crop: sc.crop, op: sc.op, num: getNum2() } } : v;
      setProgram(updateArgs(S.garden.program, n.id, { cond }));
      refocus();
    }
  }

  // ---- 모드 ----
  function flushCode() {
    if (S.codeTimer) { clearTimeout(S.codeTimer); S.codeTimer = null; }
    if (!S.ed) return;
    const code = S.ed.getCode();
    if (code !== S.garden.code) save({ ...S.garden, code });
  }
  function toCode() {
    if (S.state !== "idle") return;
    dropUndo();
    const { code } = codegen(S.garden.program);
    S.runErr = null;
    S.overlay = {};
    save({ ...S.garden, mode: "code", code });
    paintBoard();
    paintProg();
    paintOrder();
    markNow(null);
  }
  async function toNodes() {
    if (S.state !== "idle") return;
    flushCode();
    const edited = !codeMatchesNodes(S.garden.program, S.garden.code);
    if (edited) {
      const ok = await dialog({
        title: t`노드로 돌아갈까요?`,
        body: `<p>${t`코드에서 고친 것은 사라져요. 노드는 코드로 쓰기 전 그대로예요.`}</p>`,
        buttons: [{ label: tp("cancel", "그만두기"), value: false }, { label: t`노드로 돌아가기`, value: true, kind: "primary" }],
      });
      if (!ok || S.destroyed) return;
    }
    S.overlay = {};
    save({ ...S.garden, mode: "nodes", code: "" });
    paintBoard();
    paintProg();
    paintOrder();
  }

  // ---- 실행 ----
  function sleep(ms) {
    return new Promise((res) => {
      const tm = setTimeout(() => { S.wake = null; res(); }, ms);
      S.wake = () => { clearTimeout(tm); S.wake = null; res(); };
    });
  }
  async function replay(frames, lineMap, code) {
    setState("replay");
    S.skip = false;
    const top = root.querySelector(".g-board");
    const r = top.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight * 0.75) window.scrollTo({ top: 0, behavior: "smooth" });
    for (const f of frames) {
      if (S.skip || S.destroyed) break;
      paintBoard(f.state, { facing: f.facing, say: frameSay(f), fx: f.fx });
      markNow(f.line, lineMap, code);
      const n = frames.length;
      const base = S.speed === 2 ? 150 : 340;
      const per = Math.max(S.speed === 2 ? 20 : 40, Math.min(base, (S.speed === 2 ? 6000 : 12000) / n));
      await sleep(f.event.t === "say" ? Math.min(900, per * 2.5) : per);
    }
  }

  function resultHTML({ ap, r, err, code, short = null }) {
    const parts = [];
    const got = cropNames(ap ? ap.harvested : {});
    if (got.length) {
      parts.push(`<p class="g-harvest">${got.map(([c, n]) => `<span class="g-got">${CROP_ICON[c] || ""}${esc(cropName(c))} +${n}</span>`).join("")}</p>`);
    }
    const stopped = r && r.farm && r.farm.stopped;
    const rejected = !!(ap && ap.rejected);
    if (ap) parts.push(`<p class="g-msg${stopped || err || rejected ? " warn" : ""}">${esc(ap.message)}</p>`);
    if (r && r.farm && !rejected) {
      const ev = r.farm.events || [];
      const lost = {};
      for (const e of ev) if (e.t === "harvest_young") lost[e.crop] = (lost[e.crop] || 0) + 1;
      const notes = Object.entries(lost).map(([c, n]) => t`덜 자란 ${cropWord(c, n)} ${n}개가 사라졌어요`);
      const noSeed = ev.filter((e) => e.t === "plant_fail" && e.reason === "no_seed").length;
      const full = ev.filter((e) => e.t === "plant_fail" && e.reason === "occupied").length;
      if (noSeed) notes.push(t`감자 씨앗이 없어 ${noSeed}번 못 심었어요(「성장」에서 사요)`);
      if (full) notes.push(t`이미 심긴 칸이라 ${full}번 못 심었어요`);
      const noTomato = ev.filter((e) => e.t === "plant_fail" && e.reason === "no_tomato_seed").length;
      if (noTomato && !err) notes.push(t`토마토 씨앗이 없어 ${noTomato}번 못 심었어요(다 자란 토마토를 거두면 2개 생겨요)`);
      if (notes.length) parts.push(`<p class="g-lost">${notes.map(esc).join("<br>")}</p>`);
      // v0.12.1 쪽지대로 심기 주문: 쪽지와 이번에 심은 것, 까닭(칸이 참·토마토 씨앗)
      if (short) parts.push(`<div class="g-short" role="group" aria-label="${t`주문과 다른 점`}">${short.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`);
      parts.push(`<p class="g-meta">${t`행동 ${r.farm.actions}번`}</p>`);
    }
    // 텃밭 전용 설명이 있으면 먼저(오류 줄의 코드 글로 store()["수박"] 같은 KeyError를 가림)
    if (err) {
      const ex = gardenExplain(err, err.line ? (code || "").split("\n")[err.line - 1] ?? null : null);
      // 「move·plant·…」 긴 명령 줄이 글자 중간에서 꺾이지 않게 「·」 뒤에 보이지 않는 줄바꿈 자리
      parts.push(errorPanel(err, ctx.save.outfit, ex && { title: ex.title, text: ex.text.replaceAll("·", "·\u200b") }));
    }
    return parts.join("");
  }

  async function doRun() {
    if (S.state !== "idle") return;
    if (ctx.pyState().status !== "ready") { paintPy(); return; }
    const mode = S.garden.mode;
    const program = S.garden.program;
    let code, lineMap = null;
    S.runErr = null;
    if (mode === "nodes") {
      const errs = validate(program, unlocked);
      paintProg();
      if (errs.length) {
        ctx.sound.play("error");
        resultEl.innerHTML = `<p class="g-msg warn">${icon("cross")}<span>${t`빨간 노드를 먼저 고쳐요. ${esc(errs[0].msg)}`}</span></p>`;
        const bad = root.querySelector(".g-node.bad");
        if (bad) bad.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" });
        return;
      }
      const gen = codegen(program);
      code = gen.code;
      lineMap = gen.lineMap;
    } else {
      flushCode();
      code = S.ed ? S.ed.getCode() : S.garden.code;
      if (S.ed) { S.ed.markLine(null); S.ed.markNow(null); }
    }
    setState("running");
    S.overlay = {};
    paintBoard();
    resultEl.innerHTML = `<p class="g-msg">${t`파이가 노드를 읽고 있어요…`}</p>`;
    const start = runInput(S.garden, passed);   // tomato_ok: 10장을 끝냈을 때만(판정 C71 I1)
    let r;
    try {
      // 쪽지함(v0.12): 받은 쪽지(읽기만)·농장일지 — 실행이 끝나면 일지가 결과로 돌아와 applyRun이 저장한다.
      // 쪽지함이 열린 뒤(11장)에만 넘긴다(판정 C71 I1). 그 전에는 실행 폴더에 쪽지가 없고 일지도 그대로.
      const opts = notesOpen ? { farm: start, files: runFiles(S.garden) } : { farm: start };
      r = await ctx.py.run(code, "", [], opts);
    } catch (e) {
      r = { error: { type: "WorkerError", msg: String(e && e.message || e) } };
    }
    if (r.error && SYSTEM_ERRORS.has(r.error.type)) {
      if (S.destroyed) return;
      setState("idle");
      resultEl.innerHTML = `<div class="err-panel soft"><h3>${t`파이썬이 아직 준비되지 않았어요`}</h3>
        <p>${t`인터넷 연결을 확인하고 잠시 뒤 다시 눌러 주세요. 텃밭은 그대로예요.`}</p></div>`;
      return;
    }
    // 실행 중 화면을 떠났어도 결과는 저장한다(그리기만 건너뜀). 그 사이 저장의 텃밭이 바뀌었으면(다시 들어와
    // 다른 일을 함) 이 결과는 옛 상태에서 나온 것이라 버린다.
    if (S.destroyed) {
      const now = fillGarden(ctx.save).garden;
      if (JSON.stringify(runInput(now, passed)) !== JSON.stringify(start)) return;
      S.garden = now;
    }
    const was = currentOrder(S.garden, passed);   // 실행 전 주문(쪽지 주문을 못 해냈을 때 까닭을 보이려고)
    const ap = applyRun(S.garden, r, { program, mode, passed });
    const short = !ap.orderDone && !ap.rejected && !was.waiting ? orderShortfall(was.order, r) : null;
    save(ap.garden);
    const done = ap.orderDone ? finishOrders(ap.orderDone) : [];
    if (S.destroyed) return;
    const frames = r.farm && !ap.rejected ? replayFrames(start, r.farm.events, S.facing) : [];

    if (frames.length && !reduced()) await replay(thinFrames(frames), lineMap, code);
    if (S.destroyed) return;

    // 끝 장면
    const lastF = frames[frames.length - 1];
    if (lastF) S.facing = lastF.facing;
    const stopped = !ap.rejected && r.farm && r.farm.stopped;
    S.overlay = { say: stopped ? (TIRED_SAY[stopped] || TIRED_SAY.tired)() : (lastF && frameSay(lastF)) || null };
    markNow(null);
    paintBoard();
    paintStore();
    paintOrder();
    const err = r.error || null;
    if (err && mode === "nodes" && err.line && lineMap) S.runErr = lineMap[err.line] ?? null;
    if (mode === "nodes") paintProg();
    else if (err && S.ed && err.line) S.ed.markLine(err.line, false);
    resultEl.innerHTML = resultHTML({ ap, r, err, code, short });
    if (err || ap.rejected) ctx.sound.play("error");
    else if (cropNames(ap.harvested).length) ctx.sound.play("correct");
    setState("idle");
    if (done.length) await showOrders(done);
    else if (err || ap.rejected) resultEl.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
  }

  // ---- 주문 완료 ----
  /** 주문 완료 창 하나. after: 이 주문 다음에 걸리는 { order, waiting } (이어서 끝난 주문이 있으면 그것) */
  async function orderDone(order, res, after = currentOrder(S.garden, passed)) {
    ctx.sound.play("done");
    const { order: next, waiting } = after;
    const nextLine = !next ? t`주문을 모두 해냈어요! 텃밭은 계속 가꿀 수 있어요.`
      : waiting ? t`다음 주문은 ${next.need}장을 끝내면 이어져요.`
        : t`다음 주문은 「${next.title}」${jo(next.title, "이에요")}.`;
    const text = t`「${order.title}」 주문 완료! 파이 덕분에 텃밭이 북적여요. ${nextLine}`;
    await dialog({
      title: t`주문 완료!`,
      body: `<div class="g-done-body">${riaSays({ outfit: ctx.save.outfit, face: "joy", text, size: 84, sfx: t`딩동!` })}
        <p class="g-done-xp">${icon("xp")}<span>XP +${res ? res.xp : order.xp}</span></p></div>`,
      buttons: [{ label: t`좋아요`, value: true, kind: "primary" }],
    });
    if (S.destroyed) return;
    save(dropPendingDone(S.garden, order.id));
    // 창을 닫으면 초점은 실행 단추로(재생·보내기 단추는 사라졌을 수 있음)
    if (!runBtn.disabled && !runBtn.closest("[hidden]")) runBtn.focus({ preventScroll: true });
    else {
      const h = orderEl.querySelector("#g-order-title");
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
    if (res && res.milestone) await celebrate({ outfit: ctx.save.outfit, milestone: res.milestone });
    const names = (res && res.newBadges ? res.newBadges : []).map((id) => {
      const b = BADGES.find((x) => x.id === id);
      return b ? tx(`badge.${b.id}.name`, b.name) : null;
    }).filter(Boolean);
    if (names.length) toast(t`새 배지를 받았어요: ${names.join(", ")}`);
  }

  async function doDeliver() {
    if (S.state !== "idle") return;
    const d = deliver(S.garden, passed);
    if (d.error) { toast(d.error); return; }
    save(d.garden);
    const done = finishOrders(d.orderDone);
    S.overlay = {};
    paintBoard();
    paintStore();
    paintOrder();
    resultEl.innerHTML = `<p class="g-msg">${esc(t`${cropCount(d.orderDone.goal.crop, d.orderDone.goal.n)}를 보냈어요`)}</p>`;
    await showOrders(done);
  }

  // ---- 쪽지함(v0.12) ----
  // 받은 쪽지(지금 주문의 쪽지 또는 오늘의 쪽지, 읽기만)와 농장일지(내용·글자 수·비우기). 실행 때 놓이는 것과 같은 글(runFiles)
  async function openNotes() {
    if (S.state !== "idle" || !notesOpen) return;
    const files = runFiles(S.garden);
    const order = currentOrder(S.garden, passed).order;
    // 글 칸은 길면 안에서 스크롤되므로 키보드로도 초점을 받아 스크롤할 수 있게(판정 C71 I4)
    const textHTML = (txt, f) => (txt === "" ? `<p class="g-note g-note-empty">${t`(비어 있어요)`}</p>` : "")
      + `<pre class="code g-note-text" tabindex="0" role="region" aria-label="${esc(t`${fileName(f)} 내용`)}"${txt === "" ? " hidden" : ""}>${esc(txt)}</pre>`;
    const card = (f) => {
      const txt = files[f] ?? "";
      if (isLog(f)) {
        return `<section class="g-file log" data-file="${esc(f)}" aria-labelledby="gf-log">
          <h3 id="gf-log"><span class="mono">${esc(fileName(f))}</span><span class="g-file-tag log">${t`일지 · 쓸 수 있어요`}</span></h3>
          <div class="g-file-body">${textHTML(txt, f)}</div>
          <div class="g-log-row"><span class="g-num-small" id="g-log-n">${t`${[...txt].length}/${JOURNAL_MAX}자`}</span>
            <button class="btn ghost small" id="g-log-clear"${txt === "" ? " disabled" : ""}>${icon("trash")}<span>${t`일지 비우기`}</span></button></div>
          <div class="g-log-ask" id="g-log-ask" hidden><p>${t`농장일지를 모두 지울까요?`}</p>
            <button class="btn ghost small" id="g-log-no">${tp("cancel", "그만두기")}</button><button class="btn coral small" id="g-log-yes">${t`비우기`}</button></div>
        </section>`;
      }
      const mine = order?.note?.file === f;
      const hid = `gf-note-${NOTE_FILES.indexOf(f)}`;
      return `<section class="g-file" data-file="${esc(f)}" aria-labelledby="${hid}">
        <h3 id="${hid}"><span class="mono">${esc(fileName(f))}</span><span class="g-file-tag">${icon("lock")}${t`받은 쪽지`}</span></h3>
        <p class="g-note">${mine ? t`지금 주문의 쪽지예요. 읽기만 해요.` : t`오늘의 쪽지예요(실행할 때마다 바뀌어요). 읽기만 해요.`}</p>
        <div class="g-file-body">${textHTML(txt, f)}</div>
      </section>`;
    };
    await sheet({
      title: t`쪽지함`, cls: "g-notes-sheet",
      html: `<p class="g-note">${esc(t`「${NODES.readnote.label}」 노드로 여는 쪽지들이에요.`)}</p>${NOTE_FILES.map(card).join("")}`,
      bind: (box) => {
        const q = (sel) => box.querySelector(sel);
        const ask = (on) => {
          q("#g-log-ask").hidden = !on;
          q("#g-log-clear").hidden = on;
          q(on ? "#g-log-no" : "#g-log-clear").focus({ preventScroll: true });
          // 확인 줄이 창 아래로 숨지 않게
          if (on) q("#g-log-ask").scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
        };
        q("#g-log-clear").addEventListener("click", () => ask(true));
        q("#g-log-no").addEventListener("click", () => ask(false));
        q("#g-log-yes").addEventListener("click", () => {
          if (S.destroyed || S.state !== "idle") return;
          save({ ...S.garden, files: { ...S.garden.files, [LOG_FILE]: "" } });
          q(".g-file.log .g-file-body").innerHTML = textHTML("", LOG_FILE);
          q("#g-log-n").textContent = t`${0}/${JOURNAL_MAX}자`;
          q("#g-log-clear").disabled = true;
          ask(false);
          q("#g-log-clear").hidden = false;
          box.closest(".g-sheet").querySelector(".gs-close").focus({ preventScroll: true });
          toast(t`농장일지를 비웠어요`);
        });
      },
    });
  }

  // ---- 성장 ----
  async function openGrow() {
    if (S.state !== "idle") return;
    const g = S.garden;
    const costHTML = (cost) => {
      const icons = Object.entries(cost).map(([crop, n]) => `<span class="g-cost">${CROP_ICON[crop] || ""}${n}</span>`).join("");
      return `<p class="g-costs" aria-label="${esc(t`값: ${Object.entries(cost).map(([cr, n]) => cropCount(cr, n)).join(", ")}`)}">${icons}</p>`;
    };
    // 토마토 씨앗 5개(판정 C71 C2): 10장 뒤에만 보이고, 여러 번 살 수 있음. 지금 씨앗 수를 함께 보여 준다
    const seedPack = () => {
      const c = canBuy(g, SEED_PACK.id, passed);
      const n = cleanSeeds(g.seeds);
      return `<li class="g-up g-up-seeds">
        <div class="g-up-main"><h3>${esc(SEED_PACK.label)}</h3><p>${esc(t`씨앗 봉투에 ${SEED_PACK.seeds}개를 더해요(최대 ${SEEDS_MAX}개, 여러 번 살 수 있어요)`)}</p>
          <p class="g-seed-now">${SEED_ICON}<span>${esc(t`지금 ${n}/${SEEDS_MAX}개`)}</span></p>${costHTML(SEED_PACK.cost)}
          ${c.ok ? "" : `<p class="g-why">${esc(c.reason)}</p>`}</div>
        <button class="btn ${c.ok ? "sun" : "ghost"} small" data-v="${esc(SEED_PACK.id)}" data-up="${esc(SEED_PACK.id)}"${c.ok ? "" : " disabled"}>${t`사기`}</button>
      </li>`;
    };
    const html = `<p class="g-note">${t`창고의 작물로 텃밭을 키워요.`}</p><ul class="g-ups">${UPGRADES.map((u) => {
      const c = canBuy(g, u.id, passed);
      const owned = g.upgrades.includes(u.id);
      const what = u.size ? t`밭이 ${u.size}×${u.size}로 넓어져요` : u.id === POTATO_SEED ? t`감자를 심을 수 있어요` : t`작물이 더 빨리 자라요(당근 6, 감자 9)`;
      return `<li class="g-up${owned ? " owned" : ""}">
        <div class="g-up-main"><h3>${esc(u.label)}</h3><p>${esc(what)}</p>${costHTML(u.cost)}
          ${c.ok ? "" : `<p class="g-why">${esc(c.reason)}</p>`}</div>
        <button class="btn ${c.ok ? "sun" : "ghost"} small" data-v="${esc(u.id)}" data-up="${esc(u.id)}"${c.ok ? "" : " disabled"}>${owned ? t`가짐` : t`사기`}</button>
      </li>`;
    }).join("")}${tomatoOpen ? seedPack() : ""}</ul>`;
    const id = await sheet({ title: t`성장`, html, cls: "g-grow-sheet" });
    if (!id || S.destroyed) return;
    const b = buy(S.garden, id, passed);
    if (b.error) { toast(b.error); return; }
    save(b.garden);
    const done = b.orderDone ? finishOrders(b.orderDone) : [];
    ctx.sound.play("buy");
    const up = UPGRADES.find((u) => u.id === id);
    const label = up ? up.label : id;
    resultEl.innerHTML = `<p class="g-msg">${esc(id === SEED_PACK.id
      ? t`토마토 씨앗 ${SEED_PACK.seeds}개를 샀어요(지금 ${cleanSeeds(b.garden.seeds)}개)` : t`「${label}」 성장을 샀어요`)}</p>`;
    S.overlay = {};
    paintAll();
    await showOrders(done);
  }

  // ---- 기호 줄(코드 모드) ----
  const keep = (e) => e.preventDefault();
  symWrap.querySelectorAll(".sym").forEach((b) => {
    b.addEventListener("mousedown", keep);
    b.addEventListener("pointerdown", keep);
    b.addEventListener("click", () => {
      if (!S.ed || S.state !== "idle") return; // 실행·재생 중에는 코드를 고치지 않음
      const sy = SYMBOL_ORDER[+b.dataset.s];
      if (sy.act === "newline") S.ed.newline();
      else if (sy.act === "indent") S.ed.indent();
      else if (sy.act === "dedent") S.ed.dedent();
      else S.ed.insert(sy.ins, sy.back || 0);
    });
  });

  // ---- 화면 키보드 위로 아래 줄 올리기 ----
  const vv = window.visualViewport;
  function place() {
    const gap = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    foot.style.transform = gap > 0 ? `translateY(${-gap}px)` : "";
  }
  if (vv) { vv.addEventListener("resize", place); vv.addEventListener("scroll", place); }

  // ---- 누르기(한 곳에서) ----
  // v0.13.6: 고르기 창·물음 창이 이미 열려 있으면 새 창을 열지 않는다 — 아이폰에서 단추가 빠르게 두 번 눌리면
  // 같은 창이 두 장 겹쳐, 고른 뒤에도 아래 창이 남았다(사용자 보고)
  const modalOpen = () => !!document.querySelector(".modal-back");
  const whenFree = (fn) => () => { if (!modalOpen()) fn(); };
  root.addEventListener("click", (e) => {
    const el0 = e.target;
    if (S.state !== "idle") return; // 실행·재생 중에는 편집하지 않음(나가기·재생 단추는 따로 묶음)
    if (modalOpen()) return;
    const arg = el0.closest(".g-arg");
    if (arg) { openArg(arg.closest(".g-node").dataset.id, arg.dataset.arg); return; }
    const menu = el0.closest(".g-menu");
    if (menu) { openMenu(menu.closest(".g-node").dataset.id); return; }
    const add = el0.closest(".g-add");
    if (add) { openAdd(add.dataset.parent === "" ? null : add.dataset.parent, add.dataset.slot); return; }
  });
  // v0.12.5: 들어오기 전 화면(하단 메뉴에서 왔으면 그 화면)으로
  const BACK_TO = new Set(["home", "badges", "closet", "settings"]);
  const backTo = BACK_TO.has(params?.from) ? params.from : "home";
  root.querySelector("#g-back").addEventListener("click", () => ctx.show(backTo));
  runBtn.addEventListener("click", doRun);
  root.querySelector("#g-grow").addEventListener("click", whenFree(openGrow));
  root.querySelector("#g-notes")?.addEventListener("click", whenFree(openNotes));
  root.querySelector("#g-skip").addEventListener("click", () => { S.skip = true; if (S.wake) S.wake(); });
  const speedBtn = root.querySelector("#g-speed");
  speedBtn.addEventListener("click", () => {
    S.speed = S.speed === 1 ? 2 : 1;
    speedBtn.textContent = t`${S.speed}배`;
    speedBtn.setAttribute("aria-label", t`재생 속도 ${S.speed}배, 누르면 ${S.speed === 1 ? 2 : 1}배`);
  });
  codeEl.addEventListener("toggle", () => { S.previewOpen = codeEl.open; });

  // ---- 열기 ----
  // 처음 열 때 저장에 텃밭이 없으면(옛 저장) 채워 둔다
  if (!ctx.save.garden) save(S.garden);
  const settled = finishOrders(null);
  paintAll();
  resultEl.innerHTML = `<p class="g-msg idle">${esc(runHint())}</p>`;
  // 아직 창을 못 본 주문(재생 중 떠남·새로 고침, v0.12.1) + 지금 막 끝난 주문: 차례로 「주문 완료!」
  const resOf = new Map(settled.map((x) => [x.order.id, x.res]));
  const pending = S.garden.pendingDone.map((id) => ORDERS.find((o) => o.id === id)).filter(Boolean)
    .map((order) => ({ order, res: resOf.get(order.id) ?? null }));
  if (pending.length) setTimeout(() => { if (!S.destroyed) showOrders(pending); }, 0);

  return () => {
    S.destroyed = true;
    dropUndo();
    if (S.wake) S.wake();
    flushCode();
    offPy();
    if (vv) { vv.removeEventListener("resize", place); vv.removeEventListener("scroll", place); }
    if (S.ed) { S.ed.destroy(); S.ed = null; }
    document.querySelectorAll(".modal-back").forEach((m) => m.remove());
  };
}

export { argChips, goalText, condLabel };
