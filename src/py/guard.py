"""경비실 판정 엔진(설계서 2026-11-12 경비실 §2). runner.run(..., guard=)이 부른다.

배포(계획 R6): runner 글자 = 이 파일 + 줄바꿈 + runner.py(한 모듈로 이어 붙임, 이 파일이 앞).
그래서 이 파일은 runner.py의 이름을 쓰지 않고, `from __future__`도 쓰지 않는다.
시험(pytest)에서는 runner.py가 `from guard import ...`로 이 이름들을 가져간다.

세 방식(§2-3):
- script: 시도마다 학습자 코드를 새 이름공간에서 한 번씩(attempt만 바꿔서). 부른 block()/allow()가 판정,
  아무것도 안 부르면 "none"(= 들임).
- loop: 학습자 코드를 한 번. next_try()로 꺼낸 시도마다 그 뒤 부른 block()/allow(). 꺼내지 않은 시도는 "none".
- func: 학습자 코드를 한 번(정의) → 시도마다 check(attempt). True = 들임, False = 막음, 그 밖은 GuardAnswerError.
공통: 한 시도에 두 번째 판정은 무시하고 twice. 잘못 쓴 명령은 GuardUsageError(BaseException, 계획 R3) —
첫 사용 오류를 gs["usage_error"]에 적고, 학습자가 except로 삼켜도 학습자 코드 다음 줄에서 다시 던진다.
오류가 난 시도부터는 판정하지 않는다(그 시도의 사건은 지움). 시도는 앞 20개까지.
"""

import sys as _guard_sys
import types as _guard_types

# 학습자가 sys.settrace 같은 것을 바꿔도(실행 사이) 엔진은 처음 것을 쓴다
_guard_getframe = _guard_sys._getframe
_guard_settrace = _guard_sys.settrace
_guard_gettrace = _guard_sys.gettrace

GUARD_TRIES_MAX = 20
_GUARD_USER_FILE = "<user>"
_GUARD_MODES = ("script", "loop", "func")

GUARD_NO_MORE_MSG = "더 이상 시도가 없어요 — has_try()로 먼저 확인해요"
GUARD_FUNC_ONLY_MSG = "이 사건에서는 check가 True/False를 돌려줘요"
GUARD_NO_CHECK_MSG = "check 함수를 만들어 주세요: def check(attempt):"
GUARD_BOOL_MSG = "check는 True나 False를 돌려줘야 해요"
GUARD_BOOL_GOT_MSG = "돌려준 값: {}"
GUARD_NO_NEXT_MSG = "이 사건에서는 next_try()를 쓰지 않아요"

# 한국어 문구 → 영어(계획 R4: runner의 _EN과 따로, 바꿀 수 없는 표)
_GUARD_EN = _guard_types.MappingProxyType({
    GUARD_NO_MORE_MSG: "No more tries — check has_try() first",
    GUARD_FUNC_ONLY_MSG: "In this case, check returns True or False",
    GUARD_NO_CHECK_MSG: "Please make a check function: def check(attempt):",
    GUARD_BOOL_MSG: "check must return True or False",
    GUARD_BOOL_GOT_MSG: "returned: {}",
    GUARD_NO_NEXT_MSG: "This case doesn't use next_try()",
})

# 학습자가 builtins를 지워도 엔진이 돌도록 미리 잡아 둔다.
_g_type = type
_g_len = len
_g_str = str
_g_int = int
_g_bool = bool
_g_dict = dict
_g_list = list
_g_tuple = tuple
_g_callable = callable
_g_getattr = getattr
_g_BaseException = BaseException
_g_exec = exec
_g_range = range
_g_all = all


class GuardUsageError(BaseException):
    """경비실 명령을 잘못 썼을 때(방식에 없는 명령, 시도 없는데 next_try(), check 없음)."""


class GuardAnswerError(BaseException):
    """check가 True/False가 아닌 값을 돌려줬을 때."""


def _guard_tr(lang):
    en = _GUARD_EN
    if lang != "en":
        return lambda s: s
    return lambda s: en.get(s, s)


def _guard_prepare(guard, lang):
    """입력 다듬기 → 상태 gs. 받은 guard는 고치지 않는다."""
    if _g_type(guard) is not _g_dict:
        guard = {}
    mode = guard.get("mode")
    if mode not in _GUARD_MODES:
        mode = "script"
    raw = guard.get("tries")
    raw = raw if _g_type(raw) in (_g_list, _g_tuple) else []
    tries = []
    for t in raw[:GUARD_TRIES_MAX]:
        t = t if _g_type(t) is _g_dict else {}
        v = t.get("value")
        if _g_type(v) not in (_g_str, _g_int):   # bool도 여기서 걸러짐(type is로 비교)
            v = "" if v is None else _g_str(v)
        tries.append((v, "block" if t.get("expect") == "block" else "allow"))
    gs = {"mode": mode, "tries": _g_tuple(tries), "lang": "en" if lang == "en" else "ko",
          "events": [], "cur": None, "pos": 0,
          "usage_error": None, "usage_line": None, "err_line": None,
          "trace_on": False, "error": False}
    pw = guard.get("password")
    if _g_type(pw) in (_g_str, _g_int):
        gs["password"] = pw
    return gs


def _guard_caller_line():
    f = _guard_getframe(1)
    while f is not None:
        if f.f_code.co_filename == _GUARD_USER_FILE:
            return f.f_lineno
        f = f.f_back
    return None


def _guard_usage(gs, msg):
    """사용 오류: 첫 것을 적고 던진다. 그 뒤로는 학습자 코드 한 줄마다 다시 던진다(except로 삼켜도 끝나게)."""
    text = _guard_tr(gs["lang"])(msg)
    if gs["usage_error"] is None:
        gs["usage_error"] = text
        gs["usage_line"] = _guard_caller_line()
    user_file = _GUARD_USER_FILE
    settrace = _guard_settrace

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != user_file:
            return None
        if event == "line" or event == "call":
            raise GuardUsageError(gs["usage_error"])
        return tracer

    if not gs["trace_on"]:
        gs["trace_on"] = True
        settrace(tracer)
        f = _guard_getframe(1)
        while f is not None:
            if f.f_code.co_filename == user_file:
                f.f_trace = tracer
            f = f.f_back
    raise GuardUsageError(text)


def _guard_new_event(gs, i):
    ev = {"i": i, "verdict": "none"}
    gs["events"].append(ev)
    gs["cur"] = ev
    return ev


def _guard_cmds(gs):
    """실행 전역에 넣을 명령(+ password)."""
    mode = gs["mode"]
    tries = gs["tries"]
    nlen = _g_len

    def _judge(v):
        if mode == "func":
            _guard_usage(gs, GUARD_FUNC_ONLY_MSG)
        ev = gs["cur"]
        if ev is None:      # loop에서 next_try() 전: 판정할 시도가 없음 → 무시
            return
        if ev["verdict"] == "none":
            ev["verdict"] = v
        else:
            ev["twice"] = True

    def block():
        """지금 시도를 막아요."""
        _judge("block")

    def allow():
        """지금 시도를 들여요."""
        _judge("allow")

    def _not_loop():
        _guard_usage(gs, GUARD_FUNC_ONLY_MSG if mode == "func" else GUARD_NO_NEXT_MSG)

    def has_try():
        """남은 시도가 있으면 True."""
        if mode != "loop":
            _not_loop()
        return gs["pos"] < nlen(tries)

    def next_try():
        """다음 시도 값을 꺼내 「지금 시도」로 삼아요."""
        if mode != "loop":
            _not_loop()
        gs["cur"] = None    # 다음을 꺼내려 하면 앞 시도는 끝난 것(그 뒤 오류가 나도 앞 판정은 남음)
        i = gs["pos"]
        if i >= nlen(tries):
            _guard_usage(gs, GUARD_NO_MORE_MSG)
        gs["pos"] = i + 1
        _guard_new_event(gs, i)
        return tries[i][0]

    cmds = {"block": block, "allow": allow, "has_try": has_try, "next_try": next_try}
    if "password" in gs:
        cmds["password"] = gs["password"]
    return cmds


def _guard_drop_current(gs):
    ev = gs["cur"]
    if ev is not None and gs["events"] and gs["events"][-1] is ev:
        gs["events"].pop()
    gs["cur"] = None


def _guard_exec(gs, compiled, user_globals):
    """모드별 실행. 학습자 코드의 예외는 그대로 위로(오류가 난 시도의 사건은 지움)."""
    mode = gs["mode"]
    tries = gs["tries"]
    run_code, nrange, nlen = _g_exec, _g_range, _g_len   # 학습자가 builtins를 지워도(시도 사이) 엔진은 돈다
    old_trace = _guard_gettrace()
    try:
        if mode == "script":
            base = _g_dict(user_globals)
            for i in nrange(nlen(tries)):
                ns = _g_dict(base)
                ns["attempt"] = tries[i][0]
                _guard_new_event(gs, i)
                try:
                    run_code(compiled, ns)
                except SystemExit:
                    pass      # exit()는 이 시도의 실행 끝(판정은 그대로)
                gs["cur"] = None
        elif mode == "loop":
            try:
                run_code(compiled, user_globals)
            except SystemExit:
                _guard_leftover(gs)
                raise
            _guard_leftover(gs)
        else:
            run_code(compiled, user_globals)
            check = user_globals.get("check")
            if not _g_callable(check):
                _guard_usage(gs, GUARD_NO_CHECK_MSG)
            code = _g_getattr(check, "__code__", None)
            first = _g_getattr(code, "co_firstlineno", None)
            if code is None or _g_getattr(code, "co_filename", None) != _GUARD_USER_FILE:
                first = None
            for i in nrange(nlen(tries)):
                try:
                    r = check(tries[i][0])
                except _g_BaseException as e:
                    if not _guard_has_user_frame(e.__traceback__):
                        gs["err_line"] = first   # 판정 G-C1: 부르는 자리에서 난 오류(인자 수 등) → def check 줄
                    raise
                if _g_type(r) is not _g_bool:
                    gs["err_line"] = first
                    tr = _guard_tr(gs["lang"])
                    name = "None" if r is None else _g_getattr(_g_type(r), "__qualname__", "?")
                    raise GuardAnswerError(tr(GUARD_BOOL_MSG) + " (" + tr(GUARD_BOOL_GOT_MSG).replace("{}", _g_str(name)) + ")")
                ev = _guard_new_event(gs, i)
                ev["verdict"] = "allow" if r else "block"
                gs["cur"] = None
    except _g_BaseException as e:
        if _g_type(e) is not SystemExit:   # loop의 exit()는 정상 끝(남은 시도는 위에서 none)
            _guard_drop_current(gs)
        raise
    finally:
        if gs["trace_on"]:
            _guard_settrace(old_trace)


def _guard_has_user_frame(tb):
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _GUARD_USER_FILE:
            return True
        tb = tb.tb_next
    return False


def _guard_leftover(gs):
    """loop가 끝났을 때 꺼내지 않은 시도는 "none"(= 들임). 사용 오류가 있었으면 판정하지 않는다."""
    gs["cur"] = None
    if gs["usage_error"] is not None:
        return
    while gs["pos"] < _g_len(gs["tries"]):
        _guard_new_event(gs, gs["pos"])
        gs["pos"] += 1
    gs["cur"] = None


def _guard_result(gs):
    """result["guard"](§2-4). 학습자가 닫힘으로 gs를 건드렸어도 JSON 모양으로 다시 만든다."""
    tries = gs["tries"]
    n = _g_len(tries)
    events = []
    raw = gs["events"] if _g_type(gs["events"]) is _g_list else []
    for ev in raw[:n]:
        if _g_type(ev) is not _g_dict:
            continue
        i = ev.get("i")
        if _g_type(i) is not _g_int or not 0 <= i < n:
            continue
        v = ev.get("verdict")
        v = v if v in ("block", "allow", "none") else "none"
        expect = tries[i][1]
        e = {"i": i, "verdict": v, "ok": v == expect}
        if ev.get("twice") is True:
            e["twice"] = True
        events.append(e)
    stats = {"attacks_blocked": 0, "attacks_total": 0, "guests_allowed": 0, "guests_total": 0}
    for _v, expect in tries:
        stats["attacks_total" if expect == "block" else "guests_total"] += 1
    for e in events:
        if e["ok"]:
            stats["attacks_blocked" if tries[e["i"]][1] == "block" else "guests_allowed"] += 1
    failed = gs["error"] is True
    solved = (not failed and n > 0 and _g_len(events) == n
              and [e["i"] for e in events] == _g_list(range(n)) and _g_all(e["ok"] for e in events))
    return {"events": events, "stats": stats, "solved": solved, "stopped": "error" if failed else None}
