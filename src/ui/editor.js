// 코드 입력창: CodeMirror 6 (basicSetup에서 초보자에게 필요한 것만 골라 씀)
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration } from "@codemirror/view";
import { EditorState, StateField, StateEffect } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentMore, indentLess, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentUnit } from "@codemirror/language";
import { python } from "@codemirror/lang-python";

// v0.12.2 (갤럭시 S25 제보: 세 번째 줄을 만들 수 없음): CodeMirror는 안드로이드에서만 크롬의 EditContext 입력을 쓰는데,
// 삼성 키보드에서 엔터가 무시되는 사례가 있다. 오래 써 온 예전 입력 방식(contenteditable)으로 돌린다.
EditorView.EDIT_CONTEXT = false;

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

/** @returns {{ view, getCode, setCode, focus, markLine, insert, indent, dedent, destroy }} */
// margins(): 화면에 고정된 머리 줄·아래 줄이 가리는 높이 { top, bottom }. 커서를 보이게 스크롤할 때 이만큼 비켜 둔다(C30)
export function createEditor(parent, { doc = "", label = "코드 입력창", onChange, margins } = {}) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(),
        history(), indentOnInput(), bracketMatching(), indentUnit.of("    "),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
    destroy: () => view.destroy(),
  };
}
