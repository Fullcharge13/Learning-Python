// v0.11 작업 3: 텃밭 전용 오류 설명 (설계 docs/specs/2026-11-05-텃밭-6-9장-설계.md §4)
// 오류 모양은 runner 결과의 error { type, line, msg } 그대로(메시지는 실제 runner 출력에서 옮김).
import { test } from "node:test";
import assert from "node:assert/strict";
import { gardenExplain, nearCommand, FARM_COMMANDS } from "../../src/garden/errors.js";

const E = (type, msg, line = 1) => ({ type, line, msg });
const LOCALS = "_make_farm.<locals>.";

test("FARM_COMMANDS: runner의 텃밭 명령 8개와 같음(v0.12 seeds)", () => {
  assert.deepEqual(FARM_COMMANDS, ["move", "plant", "harvest", "can_harvest", "what_here", "store", "where", "seeds"]);
});

test("ValueError 방향: move 안에 넣을 방향 4가지", () => {
  const r = gardenExplain(E("ValueError", "방향은 위·아래·왼쪽·오른쪽 중 하나예요"));
  assert.ok(r && r.title && r.text);
  assert.equal(r.text, 'move 안에는 "위"·"아래"·"왼쪽"·"오른쪽" 중 하나를 따옴표와 함께 넣어요');
});

test("ValueError 작물: plant 안에는 당근·감자·토마토 (plant(\"수박\")·plant(1) 모두 runner가 이 메시지)", () => {
  const r = gardenExplain(E("ValueError", "작물은 당근·감자·토마토 중 하나예요"));
  assert.equal(r.text, 'plant 안에는 "당근"·"감자"·"토마토" 중 하나를 넣어요');
});

test("ValueError 텃밭과 관계없는 것은 null → 기존 설명", () => {
  assert.equal(gardenExplain(E("ValueError", "math domain error")), null);
  assert.equal(gardenExplain(E("ValueError", "작물은 당근·감자 중 하나예요")), null, "v0.11 옛 메시지는 runner가 더 내지 않음");
});

// v0.12(설계 §1): 토마토 씨앗·쪽지함·int() 오류
test("ValueError 토마토 씨앗이 떨어짐: 봉투·거두면 2개·시도하기 안내", () => {
  const r = gardenExplain(E("ValueError", "토마토 씨앗이 떨어졌어요"));
  assert.equal(r.title, "토마토 씨앗 없음 (ValueError)");
  assert.match(r.text, /씨앗 봉투/);
  assert.match(r.text, /2개/);
  assert.match(r.text, /시도하기/);
});

test("ValueError int(): 숫자로 바꿀 수 없는 글자(쪽지 n이 「두」·「3개」일 때)", () => {
  for (const m of ["invalid literal for int() with base 10: '두'", "invalid literal for int() with base 10: '3개\\n'",
    "invalid literal for int() with base 10: 'a'"]) {
    const r = gardenExplain(E("ValueError", m));
    assert.ok(r, m);
    assert.equal(r.title, "숫자로 바꿀 수 없음 (ValueError)");
    assert.ok(r.text.startsWith("숫자로 바꿀 수 없는 글자예요"), r.text);
  }
});

test("FileNotFoundError: 쪽지함에 그 이름의 쪽지가 없어요", () => {
  const r = gardenExplain(E("FileNotFoundError", "[Errno 2] No such file or directory: '없는.txt'"));
  assert.equal(r.title, "없는 쪽지 (FileNotFoundError)");
  assert.ok(r.text.startsWith("쪽지함에 그 이름의 쪽지가 없어요"), r.text);
});

test("PermissionError: 받은 쪽지는 읽기만(runner 메시지일 때만)", () => {
  const r = gardenExplain(E("PermissionError", "받은 쪽지는 읽기만 해요"));
  assert.equal(r.title, "읽기만 하는 쪽지 (PermissionError)");
  assert.equal(r.text, "받은 쪽지는 읽기만 해요. 쓸 수 있는 건 농장일지.txt");
  assert.equal(gardenExplain(E("PermissionError", "[Errno 13] Permission denied: '/etc/x'")), null);
});

test("TypeError 텃밭 명령의 괄호 안 값 개수·모양", () => {
  const msgs = [
    `${LOCALS}move() missing 1 required positional argument: 'direction'`,
    `${LOCALS}harvest() takes 0 positional arguments but 1 was given`,
    `${LOCALS}move() takes 1 positional argument but 2 were given`,
    `${LOCALS}where() takes 0 positional arguments but 1 was given`,
    `${LOCALS}store() takes 0 positional arguments but 1 was given`,
    `${LOCALS}can_harvest() takes 0 positional arguments but 1 was given`,
    `${LOCALS}what_here() takes 0 positional arguments but 1 was given`,
    "plant() missing 1 required positional argument: 'crop'",
  ];
  for (const m of msgs) {
    const r = gardenExplain(E("TypeError", m));
    assert.ok(r, m);
    assert.equal(r.text, '명령 괄호 안의 값 개수·모양을 확인해요. 예: move("오른쪽")');
  }
});

test("TypeError 텃밭과 관계없는 것(글자 + 숫자, 내 함수)은 null", () => {
  assert.equal(gardenExplain(E("TypeError", 'can only concatenate str (not "int") to str')), null);
  assert.equal(gardenExplain(E("TypeError", "tend() takes 0 positional arguments but 1 was given")), null);
  assert.equal(gardenExplain(E("TypeError", "remove() takes exactly one argument (0 given)")), null);
});

test("NameError 명령 오타: 가까운 명령이 있으면 「혹시 ○○?」", () => {
  const cases = { mvoe: "move", harvset: "harvest", plnat: "plant", Plant: "plant", mov: "move", wehre: "where",
    stroe: "store", seds: "seeds", can_harvst: "can_harvest", whathere: "what_here", harvest_: "harvest" };
  for (const [typo, want] of Object.entries(cases)) {
    const r = gardenExplain(E("NameError", `name '${typo}' is not defined`));
    assert.ok(r, typo);
    assert.ok(r.text.startsWith("텃밭 명령은 move·plant·harvest·can_harvest·what_here·store·where·seeds예요. 철자를 확인해요"), typo);
    assert.ok(r.text.endsWith(`혹시 ${want}?`), `${typo} → ${r.text}`);
  }
});

test("NameError 명령과 먼 이름(값 이름·따옴표 빠짐)은 null → 기존 설명", () => {
  for (const name of ["count", "x", "total", "foo", "안녕", "당근", "printt"]) {
    assert.equal(gardenExplain(E("NameError", `name '${name}' is not defined`)), null, name);
  }
});

test("nearCommand: 편집 거리 2 이하에서 가장 가까운 명령(같으면 표 순서), 대소문자 무시", () => {
  assert.equal(nearCommand("mvoe"), "move");
  assert.equal(nearCommand("MOVE"), "move");
  assert.equal(nearCommand("haverst"), "harvest");
  assert.equal(nearCommand("count"), null);
  assert.equal(nearCommand("ab"), null, "너무 짧은 이름은 추측하지 않음");
  assert.equal(nearCommand(""), null);
  assert.equal(nearCommand(null), null);
});

test("KeyError: 오류 줄에 store(가 있을 때만 창고 설명(C65)", () => {
  const r = gardenExplain(E("KeyError", "'수박'"), 'if store()["수박"] < 3:');
  assert.equal(r.text, '창고에는 "당근"·"감자"·"토마토"만 있어요');
  assert.equal(gardenExplain(E("KeyError", "'토마토'"), 'store()["토마토"]'), null, "토마토는 창고에 있음");
  assert.ok(gardenExplain(E("KeyError", "'수박'"), '    s = store()\n'), "store( 가 들어 있으면");
  assert.equal(gardenExplain(E("KeyError", "'a'"), 'print(d["a"])'), null, "내 딕셔너리");
  assert.equal(gardenExplain(E("KeyError", "'수박'"), 'print(have["수박"])'), null, "store()를 담은 변수도 줄에 store(가 없으면 null");
  assert.equal(gardenExplain(E("KeyError", "'수박'")), null, "줄 글이 없으면 null");
  assert.equal(gardenExplain(E("KeyError", "'수박'"), null), null);
  assert.equal(gardenExplain(E("KeyError", "'당근'"), 'store()["당근"]'), null, "있는 작물 이름이면 창고 문제가 아님");
  assert.equal(gardenExplain(E("KeyError", "3"), "store()[3]"), null, "글자 열쇠가 아니면 null");
});

test("codeLine은 KeyError에만 쓰임: 다른 오류는 줄 글과 관계없이 같은 결과", () => {
  const e = E("NameError", "name 'mvoe' is not defined");
  assert.deepEqual(gardenExplain(e, "mvoe('위')"), gardenExplain(e));
});

test("다른 오류·이상한 입력은 null", () => {
  for (const e of [null, undefined, {}, E("SyntaxError", "invalid syntax"), E("Timeout", ""), E("ZeroDivisionError", "division by zero"),
    { type: "ValueError" }, { type: "NameError", msg: 3 }]) {
    assert.equal(gardenExplain(e), null, JSON.stringify(e));
  }
});

test("돌려주는 모양: { title, text } 두 칸, 해요체 · 자리표시 없음", () => {
  const all = [
    gardenExplain(E("ValueError", "방향은 위·아래·왼쪽·오른쪽 중 하나예요")),
    gardenExplain(E("ValueError", "작물은 당근·감자·토마토 중 하나예요")),
    gardenExplain(E("ValueError", "토마토 씨앗이 떨어졌어요")),
    gardenExplain(E("ValueError", "invalid literal for int() with base 10: '두'")),
    gardenExplain(E("FileNotFoundError", "[Errno 2] No such file or directory: 'a.txt'")),
    gardenExplain(E("PermissionError", "받은 쪽지는 읽기만 해요")),
    gardenExplain(E("TypeError", `${LOCALS}move() missing 1 required positional argument: 'direction'`)),
    gardenExplain(E("NameError", "name 'mvoe' is not defined")),
    gardenExplain(E("KeyError", "'수박'"), 'store()["수박"]'),
  ];
  for (const r of all) {
    assert.deepEqual(Object.keys(r).sort(), ["text", "title"]);
    assert.ok(r.title.length > 0 && r.title.length <= 30, r.title);
    assert.ok(!/[{}]/.test(r.text + r.title));
  }
});

// ---- v0.12 검토(C71 I2·I1) ----
test("C71 I2 ValueError 풀기: 낱말이 두 개가 아닌 줄 → 손글씨 쪽지는 패턴 찾기", () => {
  const want = "이 줄은 낱말이 두 개가 아니에요 — 손글씨 쪽지는 패턴 찾기를 써 봐요";
  for (const msg of ["too many values to unpack (expected 2)", "not enough values to unpack (expected 2, got 1)",
    "not enough values to unpack (expected 2, got 0)"]) {
    const r = gardenExplain(E("ValueError", msg), "        crop, n = line.split()");
    assert.ok(r, msg);
    assert.equal(r.text, want);
    assert.match(r.title, /ValueError/);
  }
});

test("C71 I2 ValueError 작물: plant(crop)(쪽지에서 읽은 값)이면 「쪽지에서 읽은 값이 작물 이름이 아니에요」", () => {
  const e = E("ValueError", "작물은 당근·감자·토마토 중 하나예요");
  const note = gardenExplain(e, "            plant(crop)");
  assert.match(note.text, /^쪽지에서 읽은 값이 작물 이름이 아니에요/);
  assert.notDeepEqual(note, gardenExplain(e));
  assert.deepEqual(gardenExplain(e, 'plant("수박")'), gardenExplain(e), "글자로 쓴 작물은 기존 설명");
  assert.deepEqual(gardenExplain(e, "plant(crop2)"), gardenExplain(e), "목록 값은 기존 설명");
});

test("C71 I1 ValueError 토마토 잠김: 10장을 끝내면 심을 수 있어요", () => {
  const r = gardenExplain(E("ValueError", "토마토는 10장을 끝내면 심을 수 있어요"));
  assert.ok(r);
  assert.match(r.text, /10장/);
});
