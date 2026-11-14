// v0.20.0 작업 6: 응용 사건의 「사건 파일」 카드 (설계 docs/specs/2026-11-14-경비실-응용-사건-설계.md §4-4)
// 처음 해결 창(guard.js solvedDialog)과 「사건 파일 보기」 창이 같은 HTML을 쓴다.
// 카드 글은 데이터에서 오므로 모두 esc(v0.19.2 출력 점검). 검색어는 꼬리표 글자만(링크·검색창 열기 없음: 앱 밖으로 내보내지 않음).
import { esc, icon } from "./dom.js";
import { t, tx, lang } from "../i18n.js";

const fileText = (inc, f) => tx(`guard.${inc.id}.file.${f}`, inc.file[f]);

/** 사건 파일 카드 HTML. inc.file이 없으면 "". 영어에서 공격 이름이 원어(alias)와 같으면 원어 줄은 생략 */
export function fileCardHTML(inc, l = lang()) {
  if (!inc || !inc.file) return "";
  const attack = fileText(inc, "attack");
  const alias = inc.file.alias;
  const showAlias = !!alias && !(l !== "ko" && attack === alias);
  const search = (inc.file.search || []).map((s, i) => tx(`guard.${inc.id}.file.search.${i}`, s));
  return `<section class="gd-file" aria-label="${esc(t`사건 파일`)}">
    <header class="gd-file-head">${icon("book")}<div><p class="gd-file-kind">${esc(t`사건 파일`)}</p>
      <p class="gd-file-attack">${esc(attack)}</p>${showAlias ? `<p class="gd-file-alias" lang="en">${esc(alias)}</p>` : ""}</div></header>
    <h3 class="gd-file-h">${esc(t`현실에서는`)}</h3><p class="gd-file-p">${esc(fileText(inc, "real"))}</p>
    <h3 class="gd-file-h">${esc(t`나를 지키려면`)}</h3><p class="gd-file-p">${esc(fileText(inc, "todo"))}</p>
    <h3 class="gd-file-h">${esc(t`더 찾아볼 말`)}</h3><ul class="gd-file-search">${search.map((s) => `<li class="gd-file-kw">${esc(s)}</li>`).join("")}</ul>
  </section>`;
}
