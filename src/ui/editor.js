// 코드 입력창: CodeMirror 6 (basicSetup에서 초보자에게 필요한 것만 골라 씀)
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration } from "@codemirror/view";
import { EditorState, StateField, StateEffect, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentMore, indentLess, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle, bracketMatching, indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { tags as t } from "@lezer/highlight";
// v0.17.0: 이 파일은 첫 파일 밖 묶음(js/editor-<지문>.js)으로 따로 나간다. 앱의 i18n.js를 묶지 않도록(언어 상태 한 벌)
// 화면 글(입력창 라벨)은 부르는 쪽이 t``로 옮겨 label로 넘긴다.

// 안드로이드 입력 방식은 CodeMirror 기본(크롬 EditContext)을 그대로 둔다. v0.12.2에서 엔터 문제 때문에 껐더니
// 삼성 키보드(천지인)에서 글자가 거의 입력되지 않았다(실기기 제보, v0.12.3에서 되돌림, C73). 끄지 말 것.

const setErr = StateEffect.define();
const errLine = Decoration.line({ class: "cm-errline" });
const errField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setErr)) {
        if (e.value == null) return Decoration.none;
        const n = Math.min(Math.max(1, e.value), tr.state.doc.lines);
        return Decoration.set([errLine.range(tr.state.doc.line(n).from)]);
      }
    }
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// v0.10 텃밭 재생: 지금 실행 중인 줄(오류 줄과 따로, 글을 고치면 지움)
const setNow = StateEffect.define();
const nowLine = Decoration.line({ class: "cm-nowline" });
const nowField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setNow)) {
        if (e.value == null) return Decoration.none;
        const n = Math.min(Math.max(1, e.value), tr.state.doc.lines);
        return Decoration.set([nowLine.range(tr.state.doc.line(n).from)]);
      }
    }
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  "&": { fontSize: "16px", backgroundColor: "var(--card)", borderRadius: "14px" },
  ".cm-content": { fontFamily: "var(--mono)", padding: "10px 0", minHeight: "8.5em", caretColor: "var(--ink)" },
  ".cm-gutters": { backgroundColor: "var(--paper-2)", color: "var(--ink-2)", border: "none", borderRadius: "14px 0 0 14px" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px", minWidth: "2.2em" },
  ".cm-activeLine": { backgroundColor: "rgba(31,158,147,0.07)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(31,158,147,0.15)" },
  ".cm-errline": { backgroundColor: "var(--coral-soft)", boxShadow: "inset 4px 0 0 var(--coral)" },
  ".cm-nowline": { backgroundColor: "var(--sun-soft)", boxShadow: "inset 4px 0 0 var(--sun-deep)" },
  "&.cm-focused": { outline: "3px solid var(--focus)", outlineOffset: "2px" },
});

// v0.19.0 밤의 연구 노트: 어두운 문법 색. 밝은 쪽은 defaultHighlightStyle 그대로(색 값 안 바꿈).
// 이 묶음은 앱 모듈(theme.js)을 가져오지 않으므로 <html data-theme>를 직접 읽고 속성 변화를 지켜본다.
// 색은 어두운 편집기 바탕(--card #1E2940)·현재 줄·오류 줄·실행 줄 위에서 4.5:1 이상(tests/contrast.py --theme dark --strict)
const darkStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#D9A5FF" },
  { tag: [t.atom, t.bool, t.url, t.contentSeparator, t.labelName], color: "#A9B8FF" },
  { tag: [t.literal, t.inserted], color: "#7FDBA0" },
  { tag: [t.string, t.deleted], color: "#FF9E8F" },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: "#FFA860" },
  { tag: t.definition(t.variableName), color: "#8FC0FF" },
  { tag: t.local(t.variableName), color: "#BDAEFF" },
  { tag: [t.typeName, t.namespace], color: "#5FD3A8" },
  { tag: t.className, color: "#6FD0E8" },
  { tag: [t.special(t.variableName), t.macroName], color: "#9FD6D6" },
  { tag: t.definition(t.propertyName), color: "#9DB4FF" },
  { tag: t.comment, color: "#C8A878" },
  { tag: t.invalid, color: "#FF8080" },
  { tag: t.heading, fontWeight: "bold", color: "#F1EBDD" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#9FD6D6", textDecoration: "underline" },
]);
const darkTheme = EditorView.theme({
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#F1EBDD" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#264066" },
  ".cm-activeLine": { backgroundColor: "rgba(95,211,196,0.09)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(95,211,196,0.16)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": { backgroundColor: "rgba(95,211,196,0.28)", outline: "none" },
}, { dark: true });
const LIGHT_LOOK = syntaxHighlighting(defaultHighlightStyle, { fallback: true });
const DARK_LOOK = [darkTheme, syntaxHighlighting(darkStyle)];
const isDark = () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";

/** @returns {{ view, getCode, setCode, focus, markLine, insert, indent, dedent, destroy }} */
// margins(): 화면에 고정된 머리 줄·아래 줄이 가리는 높이 { top, bottom }. 커서를 보이게 스크롤할 때 이만큼 비켜 둔다(C30)
export function createEditor(parent, { doc = "", label, onChange, margins } = {}) {
  if (!label) throw new Error("createEditor: label is required (translated by the caller)");
  const look = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(),
        history(), indentOnInput(), bracketMatching(), indentUnit.of("    "),
        look.of(isDark() ? DARK_LOOK : LIGHT_LOOK),
        python(), errField, nowField, theme,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        ...(margins ? [EditorView.scrollMargins.of(() => { const m = margins() || {}; return { top: m.top || 0, bottom: m.bottom || 0 }; })] : []),
        EditorView.contentAttributes.of({
          autocorrect: "off", autocapitalize: "off", spellcheck: "false", autocomplete: "off",
          "aria-label": label, enterkeyhint: "enter",
        }),
        EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); }),
      ],
    }),
  });
  // 앱 화면 설정·시스템 다크 모드가 바뀌면(<html data-theme>) 열려 있는 편집기도 문법 색을 바꾼다. 내용·커서는 그대로
  let shown = isDark();
  const mo = typeof MutationObserver !== "undefined" && typeof document !== "undefined"
    ? new MutationObserver(() => {
        const d = isDark();
        if (d === shown) return;
        shown = d;
        view.dispatch({ effects: look.reconfigure(d ? DARK_LOOK : LIGHT_LOOK) });
      })
    : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode(code) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code }, selection: { anchor: code.length } });
    },
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
    /** 커서가 있는 줄을 보이게 (입력창 안 스크롤과 페이지 스크롤 모두) */
    revealCursor() {
      view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest", yMargin: 12 }) });
    },
    /** 오류 줄 강조. scroll=false면 페이지를 그 줄로 옮기지 않음(제출 뒤 설명으로 옮길 때) */
    markLine(n, scroll = true) {
      view.dispatch({ effects: setErr.of(Number.isInteger(n) && n > 0 ? n : null) });
      if (scroll && Number.isInteger(n) && n > 0 && n <= view.state.doc.lines) {
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(n).from, { y: "center" }) });
      }
    },
    /** 지금 실행 중인 줄 표시(텃밭 재생, v0.10). 페이지는 옮기지 않음. null이면 지움 */
    markNow(n) {
      view.dispatch({ effects: setNow.of(Number.isInteger(n) && n > 0 ? n : null) });
    },
    /** 커서 자리에 글자 넣기. pair면 커서를 가운데로 */
    insert(text, caretBack = 0) {
      const r = view.state.selection.main;
      view.dispatch({
        changes: { from: r.from, to: r.to, insert: text },
        selection: { anchor: r.from + text.length - caretBack },
        scrollIntoView: true,
      });
      view.focus();
    },
    indent() { indentMore(view); view.focus(); },
    /** 줄 바꿈(엔터와 같음: 들여쓰기 맞춤). v0.12.2 기호 줄 단추 */
    newline() { insertNewlineAndIndent(view); view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest" }) }); view.focus(); },
    dedent() { indentLess(view); view.focus(); },
    destroy: () => { if (mo) mo.disconnect(); view.destroy(); },
  };
}
