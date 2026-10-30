// 레슨 진행 상태 기계 (계획 작업 9): cards → items → retry → check → done
// 순수 함수만. 화면은 current()로 지금 보여 줄 것을 묻고, nextCard()/answer()로 다음 상태를 받는다.
// - 터치 문제를 틀리면 본 문제 줄 끝에 다시 넣는다(retry). 같은 문제는 최대 MAX_ATTEMPTS번.
// - 이해도 확인(check) 문제는 본 문제와 재도전이 모두 끝난 뒤에 나온다. 틀리면 확인 문제를 다시.
// - 직접 작성(write)은 화면 안에서 여러 번 제출하므로 다시 넣지 않는다. 틀린 채 끝나면 perfect만 false.

export const MAX_ATTEMPTS = 3;

export function startFlow(lesson) {
  const items = Array.isArray(lesson.items) ? lesson.items : [];
  const main = [];
  const check = [];
  items.forEach((it, i) => (it && it.type === "check" ? check : main).push({ i, retry: false }));
  return {
    cards: Array.isArray(lesson.cards) ? lesson.cards.length : 0,
    cardPos: 0,
    main, mainPos: 0,
    check, checkPos: 0,
    attempts: {},      // 문제 번호 → 답한 횟수
    firstTry: {},      // 문제 번호 → 첫 답이 맞았는지
    solved: {},        // 문제 번호 → 결국 맞혔는지
    gaveUp: [],        // 최대 횟수까지 틀린 문제 번호
    perfect: true,
    answered: 0,
    phase: "cards",
    _items: items.map((it) => (it && it.type) || ""),
    _lesson: lesson,
  };
}

function phaseOf(s) {
  if (s.cardPos < s.cards) return "cards";
  if (s.mainPos < s.main.length) return s.main[s.mainPos].retry ? "retry" : "items";
  if (s.checkPos < s.check.length) return "check";
  return "done";
}

function withPhase(s) {
  s.phase = phaseOf(s);
  return s;
}

function clone(s) {
  return {
    ...s,
    main: s.main.slice(), check: s.check.slice(),
    attempts: { ...s.attempts }, firstTry: { ...s.firstTry }, solved: { ...s.solved },
    gaveUp: s.gaveUp.slice(),
  };
}

/** 지금 보여 줄 것: { kind: "card", index } | { kind: "item", index, retry, attempt } | { kind: "done" }.
 *  lesson을 넘기면 card/item 내용도 붙인다. */
export function current(s, lesson = s._lesson) {
  const ph = phaseOf(s);
  if (ph === "cards") return { kind: "card", index: s.cardPos, card: lesson ? lesson.cards[s.cardPos] : undefined };
  if (ph === "done") return { kind: "done" };
  const e = ph === "check" ? s.check[s.checkPos] : s.main[s.mainPos];
  return {
    kind: "item", index: e.i, retry: e.retry, attempt: (s.attempts[e.i] || 0) + 1,
    item: lesson ? lesson.items[e.i] : { type: s._items[e.i], id: undefined },
  };
}

export function nextCard(s) {
  const n = clone(s);
  if (n.cardPos < n.cards) n.cardPos++;
  return withPhase(n);
}

export function answer(s, correct) {
  const ph = phaseOf(s);
  if (ph === "cards" || ph === "done") return withPhase(clone(s));
  const n = clone(s);
  const list = ph === "check" ? n.check : n.main;
  const e = list[ph === "check" ? n.checkPos : n.mainPos];
  const i = e.i;
  const tries = (n.attempts[i] || 0) + 1;
  n.attempts[i] = tries;
  n.answered++;
  if (tries === 1) n.firstTry[i] = !!correct;
  if (correct) {
    n.solved[i] = true;
  } else {
    n.perfect = false;
    const isWrite = n._items[i] === "write";
    if (!isWrite) {
      if (tries < MAX_ATTEMPTS) list.push({ i, retry: true });
      else n.gaveUp.push(i);
    }
  }
  if (ph === "check") n.checkPos++; else n.mainPos++;
  return withPhase(n);
}

/** 레슨 결과 요약 */
export function summary(s) {
  const total = s.main.filter((e) => !e.retry).length + s.check.filter((e) => !e.retry).length;
  const firstTry = Object.values(s.firstTry).filter(Boolean).length;
  const steps = s.cards + s.main.length + s.check.length;
  const doneSteps = s.cardPos + s.mainPos + s.checkPos;
  return {
    done: phaseOf(s) === "done",
    perfect: s.perfect,
    total,
    firstTry,
    accuracy: total ? firstTry / total : 1,
    gaveUp: s.gaveUp.slice(),
    progress: steps ? doneSteps / steps : 1,
  };
}
