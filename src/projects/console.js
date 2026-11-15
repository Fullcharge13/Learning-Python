// v0.21.0 한 판 이어 가기 (프로젝트 공방, 순수 로직: 화면·실행기 없이 시험 가능)
//
// 파이썬은 input()에서 멈출 수 없으므로 "멈췄다 다시 돌리기"로 흉내 낸다.
// 학습자가 답할 때마다 지금까지의 모든 답을 stdin으로 넣어 처음부터 다시 돌리고,
// 같은 씨앗(seed)을 써서 무작위도 매번 같게 만든다. 실행기는 입력이 모자라면
// 오류 대신 need_input({ prompt })을 돌려주고, 그때까지의 출력(마지막 안내 글 제외)은
// 다음 번 재실행 출력의 앞부분과 같다.
//
// run 호출 모양 (앱에서는 (code, stdin, opts) => ctx.py.run(code, stdin, [], opts)):
//   run(code: string, stdin: string[], { interactive: true, seed: int, files?: object })
//     -> Promise<{ stdout, stderr, error, missing, charts, need_input?: { prompt } }>
//   stdin은 "문자열 배열"로 넘긴다(답 안의 줄바꿈이 입력을 쪼개지 못하게).
//
// createSession({ code, run, seed, maxInputs = 50, files = null })
//   -> { start(), answer(text), restart(), inputs }   (inputs: 지금까지의 답 복사본)
// Frame = { output, appended, replaced, need: null | { prompt }, done, error, limit }
//   appended: 앞 Frame 출력 뒤로 새로 생긴 부분. 앞 출력으로 시작하지 않으면
//             (시각·무작위가 섞여 달라진 경우) 새 출력 전체로 바꾸고 replaced: true.
//   limit: 답이 maxInputs를 넘어 더 돌리지 않음(끝나지 않는 프로그램 막이). done도 true.
// 답은 500자까지만 쓰고(넘으면 앞 500자), 빈 답은 ""로 넘긴다(input()과 같음).

export const MAX_ANSWER_LEN = 500;

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function clip(text) {
  const s = text == null ? "" : String(text);
  const chars = Array.from(s); // 글자 쪼개짐 방지
  return chars.length > MAX_ANSWER_LEN ? chars.slice(0, MAX_ANSWER_LEN).join("") : s;
}

export function createSession({ code, run, seed = randomSeed(), maxInputs = 50, files = null }) {
  let curSeed = seed;
  let inputs = [];
  let prev = "";        // 앞 Frame의 출력
  let last = null;      // 앞 Frame
  let finished = false; // 끝났거나(done) 상한에 걸림

  async function execute() {
    const opts = { interactive: true, seed: curSeed };
    if (files) opts.files = files;
    const r = await run(code, [...inputs], opts);
    const output = String((r && r.stdout) || "");
    const need = r && r.need_input ? { prompt: String(r.need_input.prompt == null ? "" : r.need_input.prompt) } : null;
    const error = (r && r.error) || null;
    const replaced = !output.startsWith(prev);
    const frame = {
      output,
      appended: replaced ? output : output.slice(prev.length),
      replaced,
      need: error ? null : need,
      done: !need || !!error,
      error,
      limit: false,
    };
    prev = output;
    finished = frame.done;
    last = frame;
    return frame;
  }

  return {
    get inputs() { return [...inputs]; },
    start() {
      inputs = []; prev = ""; finished = false;
      return execute();
    },
    async answer(text) {
      if (!last) return this.start();
      if (finished) return { ...last, appended: "", replaced: false };
      if (inputs.length >= maxInputs) {
        finished = true;
        last = { ...last, appended: "", replaced: false, need: null, done: true, limit: true };
        return last;
      }
      inputs.push(clip(text));
      return execute();
    },
    restart() {
      let s = randomSeed();
      while (s === curSeed) s = randomSeed();
      curSeed = s;
      return this.start();
    },
  };
}
