// v0.11 파이의 텃밭 전용 오류 설명 (설계 docs/specs/2026-11-05-텃밭-6-9장-설계.md §4). 순수 함수, 화면 없음.
//
// gardenExplain(error, codeLine) → { title, text } | null
//   error는 runner 결과의 error { type, line, msg }, codeLine은 오류가 난 줄의 코드 글(없어도 됨, KeyError·쪽지 작물에만 씀). 텃밭 명령에서 난 오류로 알아볼 수 있으면 텃밭 전용 설명을,
//   아니면 null(화면은 기존 data/errors.js 설명을 씀). 메시지는 src/py/runner.py가 내는 글을 그대로 맞춘다:
//     ValueError  FARM_DIR_MSG「방향은 …」/ FARM_CROP_MSG「작물은 …」(plant(1)처럼 글자가 아닌 값도 이 메시지)
//     TypeError   「_make_farm.<locals>.move() missing …」·「… takes 0 positional arguments …」(괄호 안 값 개수)
//     NameError   「name 'mvoe' is not defined」 → 명령 이름과 편집 거리 2 이하면 「혹시 move?」
//     KeyError    「'수박'」(store()["수박"]) → 당근·감자·토마토가 아닌 글자 열쇠이고, 오류 줄(codeLine)에 「store(」가 있을 때만
//                 (판정 C65: 학습자 딕셔너리의 KeyError는 기존 설명으로)
//   v0.12(설계 docs/specs/2026-11-05-텃밭-10-17장-설계.md §1):
//     ValueError  FARM_NO_TOMATO_SEED_MSG「토마토 씨앗이 떨어졌어요」, int()이 못 바꾼 글자「invalid literal for int() …」
//     FileNotFoundError  쪽지함에 없는 이름(텃밭 실행의 파일은 쪽지함뿐이므로 메시지와 관계없이)
//     PermissionError    FARM_NOTE_READONLY_MSG「받은 쪽지는 읽기만 해요」일 때만
//   v0.12 검토(판정 C71):
//     ValueError  「too many / not enough values to unpack」(줄 나누기 crop, n = line.split()) → 낱말이 두 개가 아님·패턴 찾기
//                 FARM_CROP_MSG이고 오류 줄(codeLine)이 plant(crop)(쪽지에서 읽은 값)이면 「쪽지에서 읽은 값이 작물 이름이 아니에요」
//                 FARM_TOMATO_LOCKED_MSG「토마토는 10장을 끝내면 심을 수 있어요」
// 글에는 자리 표시({…})를 쓰지 않고, 이름 뒤에 조사를 붙이지 않는다(「혹시 move?」).

export const FARM_COMMANDS = ["move", "plant", "harvest", "can_harvest", "what_here", "store", "where", "seeds"];
const CROPS = ["당근", "감자", "토마토"];
const DIR_MSG = "방향은 위·아래·왼쪽·오른쪽 중 하나예요";   // runner FARM_DIR_MSG
const CROP_MSG = "작물은 당근·감자·토마토 중 하나예요";    // runner FARM_CROP_MSG
const SEED_MSG = "토마토 씨앗이 떨어졌어요";               // runner FARM_NO_TOMATO_SEED_MSG
const READONLY_MSG = "받은 쪽지는 읽기만 해요";            // runner FARM_NOTE_READONLY_MSG
const LOCKED_MSG = "토마토는 10장을 끝내면 심을 수 있어요"; // runner FARM_TOMATO_LOCKED_MSG
const UNPACK_RE = /^(?:too many|not enough) values to unpack\b/;
const NOTE_PLANT_RE = /\bplant\(\s*crop\s*\)/;   // 노드 코드에서 쪽지 crop을 심는 줄(목록 값은 crop2부터)
const INT_RE = /^invalid literal for int\(\) with base \d+: /;
const NEAR_MAX = 2;
const NEAR_MIN_LEN = 3;

const TEXT = {
  dir: { title: "방향 값 오류 (ValueError)", text: 'move 안에는 "위"·"아래"·"왼쪽"·"오른쪽" 중 하나를 따옴표와 함께 넣어요' },
  crop: { title: "작물 값 오류 (ValueError)", text: 'plant 안에는 "당근"·"감자"·"토마토" 중 하나를 넣어요' },
  seed: { title: "토마토 씨앗 없음 (ValueError)",
    text: "씨앗 봉투가 비었어요. 다 자란 토마토를 거두면 씨앗이 2개 생겨요. 시도하기 노드로 안 되면 다른 작물을 심게 할 수 있어요" },
  noteCrop: { title: "작물 값 오류 (ValueError)",
    text: "쪽지에서 읽은 값이 작물 이름이 아니에요. 쪽지 줄이 「작물 개수」 모양인지, 패턴 찾기라면 작물+숫자 패턴인지 확인해요" },
  unpack: { title: "줄 나누기 오류 (ValueError)", text: "이 줄은 낱말이 두 개가 아니에요 — 손글씨 쪽지는 패턴 찾기를 써 봐요" },
  locked: { title: "아직 못 심는 토마토 (ValueError)", text: "토마토는 10장을 끝내면 심을 수 있어요. 지금은 당근이나 감자를 심어요" },
  int: { title: "숫자로 바꿀 수 없음 (ValueError)", text: "숫자로 바꿀 수 없는 글자예요. 쪽지 줄이 「작물 개수」 모양인지 확인해요" },
  file: { title: "없는 쪽지 (FileNotFoundError)", text: "쪽지함에 그 이름의 쪽지가 없어요. 쪽지 읽기에서 쪽지함에 있는 이름을 골라요" },
  readonly: { title: "읽기만 하는 쪽지 (PermissionError)", text: "받은 쪽지는 읽기만 해요. 쓸 수 있는 건 농장일지.txt" },
  args: { title: "명령 괄호 오류 (TypeError)", text: '명령 괄호 안의 값 개수·모양을 확인해요. 예: move("오른쪽")' },
  name: { title: "모르는 명령 (NameError)", text: `텃밭 명령은 ${FARM_COMMANDS.join("·")}예요. 철자를 확인해요` },
  key: { title: "창고에 없는 작물 (KeyError)", text: '창고에는 "당근"·"감자"·"토마토"만 있어요' },
};

// 텃밭 명령을 부를 때 파이썬이 내는 인자 오류: 「(…​.)move() missing …」「(…​.)harvest() takes …」
const ARGS_RE = new RegExp(`(?:^|\\.)(?:${FARM_COMMANDS.join("|")})\\(\\) (?:missing|takes|got)\\b`);
const NAME_RE = /^name '([^']*)' is not defined/;
const KEY_RE = /^'([^']*)'$/;

/** 두 글자열의 편집 거리(레벤슈타인: 넣기·빼기·바꾸기 각 1) */
function editDistance(a, b) {
  const A = [...a];
  const B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

/** 이름과 가장 가까운 텃밭 명령(편집 거리 2 이하, 대소문자 무시, 같은 거리면 표 순서). 3글자 미만·없으면 null */
export function nearCommand(name) {
  if (typeof name !== "string" || [...name].length < NEAR_MIN_LEN) return null;
  const low = name.toLowerCase();
  let best = null;
  let bestD = NEAR_MAX + 1;
  for (const c of FARM_COMMANDS) {
    const d = editDistance(low, c);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

const out = (t, extra = "") => ({ title: t.title, text: t.text + extra });

/** 텃밭 전용 오류 설명 { title, text }, 해당 없으면 null. codeLine: 오류 줄의 코드 글(KeyError·쪽지 작물 판단에만 씀) */
export function gardenExplain(error, codeLine = null) {
  if (!error || typeof error !== "object" || typeof error.msg !== "string") return null;
  const msg = error.msg;
  switch (error.type) {
    case "ValueError":
      if (msg === DIR_MSG) return out(TEXT.dir);
      if (msg === CROP_MSG) return out(typeof codeLine === "string" && NOTE_PLANT_RE.test(codeLine) ? TEXT.noteCrop : TEXT.crop);
      if (msg === SEED_MSG) return out(TEXT.seed);
      if (msg === LOCKED_MSG) return out(TEXT.locked);
      if (UNPACK_RE.test(msg)) return out(TEXT.unpack);
      if (INT_RE.test(msg)) return out(TEXT.int);
      return null;
    case "FileNotFoundError":
      return out(TEXT.file);
    case "PermissionError":
      return msg === READONLY_MSG ? out(TEXT.readonly) : null;
    case "TypeError":
      return ARGS_RE.test(msg) ? out(TEXT.args) : null;
    case "NameError": {
      const m = NAME_RE.exec(msg);
      const near = m && nearCommand(m[1]);
      return near ? out(TEXT.name, `. 혹시 ${near}?`) : null;
    }
    case "KeyError": {
      const m = KEY_RE.exec(msg);
      const fromStore = typeof codeLine === "string" && codeLine.includes("store(");
      return m && fromStore && !CROPS.includes(m[1]) ? out(TEXT.key) : null;
    }
    default:
      return null;
  }
}
