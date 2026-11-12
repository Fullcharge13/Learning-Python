// tests/guard_incidents.py의 도우미: data/guard.js의 사건과 빈칸 채운 코드를 JSON으로 준다.
//   node tests/guard_incidents_helper.mjs   → { incidents, filled: { id: { answer, wrong: [{blank, option, code}] } } }
import { INCIDENTS, GUARD_XP } from "../data/guard.js";
import { fillBlanks, answerPicks } from "../src/guard/blanks.js";

const filled = {};
for (const inc of INCIDENTS) {
  const picks = answerPicks(inc.blanks);
  const wrong = [];
  inc.blanks.forEach((b, bi) => {
    b.options.forEach((opt, oi) => {
      if (oi === b.answer) return;
      const p = picks.slice();
      p[bi] = oi;
      wrong.push({ blank: bi, option: opt, code: fillBlanks(inc.start, inc.blanks, p).code });
    });
  });
  filled[inc.id] = { answer: fillBlanks(inc.start, inc.blanks, picks), wrong };
}
process.stdout.write(JSON.stringify({ incidents: INCIDENTS, xp: GUARD_XP, filled }));
