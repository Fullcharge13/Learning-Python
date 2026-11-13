// v0.17.0: 편집기 자리. 편집기 묶음(js/editor-<지문>.js)이 아직 안 왔으면 시작 코드를 읽기 전용 글로 보이고
// 「코드 입력창 준비 중…」을 겹친다. 오면 그 자리에 편집기를 끼운다(시작 코드 그대로).
// 못 받으면 까닭에 따라 「다시 시도」(연결 없음) 또는 「새로 고침」(새 판이 나와 옛 파일이 없음).
// 세 화면(레슨 코드 쓰기, 경비실 직접 쓰기, 텃밭 프로그램)이 같이 쓴다.
import { loadChunk } from "../chunks.js";
import { t } from "../i18n.js";
import { esc } from "./dom.js";

/**
 * @param {HTMLElement} slot 편집기를 넣을 자리(.editor-box)
 * @param {{ doc?: string, label: string, onChange?: Function, margins?: Function, onReady?: (ed: object) => void }} opts
 * @returns {Promise<object>} 편집기가 끼워지면 그 편집기. 자리가 화면에서 빠진 뒤 오면 끼우지 않고 끝나지 않는다.
 */
export function mountEditor(slot, opts) {
  const doc = opts.doc || "";
  const cover = (inner) => {
    slot.classList.add("ed-slot");
    // <pre> 바로 뒤 줄바꿈 하나는 HTML이 버리므로 하나 더 넣어 시작 코드를 글자 그대로 보인다
    slot.innerHTML = `<pre class="ed-pre mono">\n${esc(doc)}</pre><div class="ed-wait">${inner}</div>`;
  };
  const waiting = () => cover(`<p class="ed-msg" role="status"><span class="dot" aria-hidden="true"></span>${t`코드 입력창 준비 중…`}</p>`);
  return new Promise((resolve) => {
    function attempt() {
      waiting();
      loadChunk("editor").then((m) => {
        if (!slot.isConnected) return;
        slot.classList.remove("ed-slot");
        slot.innerHTML = "";
        const ed = m.createEditor(slot, { doc, label: opts.label, onChange: opts.onChange, margins: opts.margins });
        if (opts.onReady) opts.onReady(ed);
        resolve(ed);
      }, (e) => {
        if (!slot.isConnected) return;
        const stale = e && e.kind === "stale";
        cover(`<div class="ed-msg fail" role="alert"><p>${stale ? t`새 판이 나왔어요. 새로 고침하면 열려요` : t`코드 입력창을 불러오지 못했어요. 인터넷에 연결한 뒤 다시 열어 주세요`}</p>${stale
          ? `<button class="btn primary small ed-refresh">${t`새로 고침`}</button>`
          : `<button class="btn primary small ed-retry">${t`다시 시도`}</button>`}</div>`);
        slot.querySelector(".ed-refresh")?.addEventListener("click", () => location.reload());
        slot.querySelector(".ed-retry")?.addEventListener("click", attempt);
      });
    }
    attempt();
  });
}
