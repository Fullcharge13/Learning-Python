import sys as _guard_sys
import types as _guard_types
_guard_getframe = _guard_sys._getframe
_guard_settrace = _guard_sys.settrace
_guard_gettrace = _guard_sys.gettrace
GUARD_TRIES_MAX = 20
_GUARD_USER_FILE = '<user>'
_GUARD_MODES = ('script', 'loop', 'func')
GUARD_NO_MORE_MSG = '더 이상 시도가 없어요 — has_try()로 먼저 확인해요'
GUARD_FUNC_ONLY_MSG = '이 사건에서는 check가 True/False를 돌려줘요'
GUARD_NO_CHECK_MSG = 'check 함수를 만들어 주세요: def check(attempt):'
GUARD_BOOL_MSG = 'check는 True나 False를 돌려줘야 해요'
GUARD_BOOL_GOT_MSG = '돌려준 값: {}'
GUARD_NO_NEXT_MSG = '이 사건에서는 next_try()를 쓰지 않아요'
_GUARD_EN = _guard_types.MappingProxyType({GUARD_NO_MORE_MSG: 'No more tries — check has_try() first', GUARD_FUNC_ONLY_MSG: 'In this case, check returns True or False', GUARD_NO_CHECK_MSG: 'Please make a check function: def check(attempt):', GUARD_BOOL_MSG: 'check must return True or False', GUARD_BOOL_GOT_MSG: 'returned: {}', GUARD_NO_NEXT_MSG: "This case doesn't use next_try()"})
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
    pass

class GuardAnswerError(BaseException):
    pass

def _guard_tr(lang):
    en = _GUARD_EN
    if lang != 'en':
        return lambda s: s
    return lambda s: en.get(s, s)

def _guard_prepare(guard, lang):
    if _g_type(guard) is not _g_dict:
        guard = {}
    mode = guard.get('mode')
    if mode not in _GUARD_MODES:
        mode = 'script'
    raw = guard.get('tries')
    raw = raw if _g_type(raw) in (_g_list, _g_tuple) else []
    tries = []
    for t in raw[:GUARD_TRIES_MAX]:
        t = t if _g_type(t) is _g_dict else {}
        v = t.get('value')
        if _g_type(v) not in (_g_str, _g_int):
            v = '' if v is None else _g_str(v)
        tries.append((v, 'block' if t.get('expect') == 'block' else 'allow'))
    gs = {'mode': mode, 'tries': _g_tuple(tries), 'lang': 'en' if lang == 'en' else 'ko', 'events': [], 'cur': None, 'pos': 0, 'usage_error': None, 'usage_line': None, 'err_line': None, 'trace_on': False, 'error': False}
    pw = guard.get('password')
    if _g_type(pw) in (_g_str, _g_int):
        gs['password'] = pw
    return gs

def _guard_caller_line():
    f = _guard_getframe(1)
    while f is not None:
        if f.f_code.co_filename == _GUARD_USER_FILE:
            return f.f_lineno
        f = f.f_back
    return None

def _guard_usage(gs, msg):
    text = _guard_tr(gs['lang'])(msg)
    if gs['usage_error'] is None:
        gs['usage_error'] = text
        gs['usage_line'] = _guard_caller_line()
    user_file = _GUARD_USER_FILE
    settrace = _guard_settrace

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != user_file:
            return None
        if event == 'line' or event == 'call':
            raise GuardUsageError(gs['usage_error'])
        return tracer
    if not gs['trace_on']:
        gs['trace_on'] = True
        settrace(tracer)
        f = _guard_getframe(1)
        while f is not None:
            if f.f_code.co_filename == user_file:
                f.f_trace = tracer
            f = f.f_back
    raise GuardUsageError(text)

def _guard_new_event(gs, i):
    ev = {'i': i, 'verdict': 'none'}
    gs['events'].append(ev)
    gs['cur'] = ev
    return ev

def _guard_cmds(gs):
    mode = gs['mode']
    tries = gs['tries']
    nlen = _g_len

    def _judge(v):
        if mode == 'func':
            _guard_usage(gs, GUARD_FUNC_ONLY_MSG)
        ev = gs['cur']
        if ev is None:
            return
        if ev['verdict'] == 'none':
            ev['verdict'] = v
        else:
            ev['twice'] = True

    def block():
        _judge('block')

    def allow():
        _judge('allow')

    def _not_loop():
        _guard_usage(gs, GUARD_FUNC_ONLY_MSG if mode == 'func' else GUARD_NO_NEXT_MSG)

    def has_try():
        if mode != 'loop':
            _not_loop()
        return gs['pos'] < nlen(tries)

    def next_try():
        if mode != 'loop':
            _not_loop()
        gs['cur'] = None
        i = gs['pos']
        if i >= nlen(tries):
            _guard_usage(gs, GUARD_NO_MORE_MSG)
        gs['pos'] = i + 1
        _guard_new_event(gs, i)
        return tries[i][0]
    cmds = {'block': block, 'allow': allow, 'has_try': has_try, 'next_try': next_try}
    if 'password' in gs:
        cmds['password'] = gs['password']
    return cmds

def _guard_drop_current(gs):
    ev = gs['cur']
    if ev is not None and gs['events'] and (gs['events'][-1] is ev):
        gs['events'].pop()
    gs['cur'] = None

def _guard_exec(gs, compiled, user_globals):
    mode = gs['mode']
    tries = gs['tries']
    run_code, nrange, nlen = (_g_exec, _g_range, _g_len)
    old_trace = _guard_gettrace()
    try:
        if mode == 'script':
            base = _g_dict(user_globals)
            for i in nrange(nlen(tries)):
                ns = _g_dict(base)
                ns['attempt'] = tries[i][0]
                _guard_new_event(gs, i)
                try:
                    run_code(compiled, ns)
                except SystemExit:
                    pass
                gs['cur'] = None
        elif mode == 'loop':
            try:
                run_code(compiled, user_globals)
            except SystemExit:
                _guard_leftover(gs)
                raise
            _guard_leftover(gs)
        else:
            run_code(compiled, user_globals)
            check = user_globals.get('check')
            if not _g_callable(check):
                _guard_usage(gs, GUARD_NO_CHECK_MSG)
            code = _g_getattr(check, '__code__', None)
            first = _g_getattr(code, 'co_firstlineno', None)
            if code is None or _g_getattr(code, 'co_filename', None) != _GUARD_USER_FILE:
                first = None
            for i in nrange(nlen(tries)):
                try:
                    r = check(tries[i][0])
                except _g_BaseException as e:
                    if not _guard_has_user_frame(e.__traceback__):
                        gs['err_line'] = first
                    raise
                if _g_type(r) is not _g_bool:
                    gs['err_line'] = first
                    tr = _guard_tr(gs['lang'])
                    name = 'None' if r is None else _g_getattr(_g_type(r), '__qualname__', '?')
                    raise GuardAnswerError(tr(GUARD_BOOL_MSG) + ' (' + tr(GUARD_BOOL_GOT_MSG).replace('{}', _g_str(name)) + ')')
                ev = _guard_new_event(gs, i)
                ev['verdict'] = 'allow' if r else 'block'
                gs['cur'] = None
    except _g_BaseException as e:
        if _g_type(e) is not SystemExit:
            _guard_drop_current(gs)
        raise
    finally:
        if gs['trace_on']:
            _guard_settrace(old_trace)

def _guard_has_user_frame(tb):
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _GUARD_USER_FILE:
            return True
        tb = tb.tb_next
    return False

def _guard_leftover(gs):
    gs['cur'] = None
    if gs['usage_error'] is not None:
        return
    while gs['pos'] < _g_len(gs['tries']):
        _guard_new_event(gs, gs['pos'])
        gs['pos'] += 1
    gs['cur'] = None

def _guard_result(gs):
    tries = gs['tries']
    n = _g_len(tries)
    events = []
    raw = gs['events'] if _g_type(gs['events']) is _g_list else []
    for ev in raw[:n]:
        if _g_type(ev) is not _g_dict:
            continue
        i = ev.get('i')
        if _g_type(i) is not _g_int or not 0 <= i < n:
            continue
        v = ev.get('verdict')
        v = v if v in ('block', 'allow', 'none') else 'none'
        expect = tries[i][1]
        e = {'i': i, 'verdict': v, 'ok': v == expect}
        if ev.get('twice') is True:
            e['twice'] = True
        events.append(e)
    stats = {'attacks_blocked': 0, 'attacks_total': 0, 'guests_allowed': 0, 'guests_total': 0}
    for _v, expect in tries:
        stats['attacks_total' if expect == 'block' else 'guests_total'] += 1
    for e in events:
        if e['ok']:
            stats['attacks_blocked' if tries[e['i']][1] == 'block' else 'guests_allowed'] += 1
    failed = gs['error'] is True
    solved = not failed and n > 0 and (_g_len(events) == n) and ([e['i'] for e in events] == _g_list(range(n))) and _g_all((e['ok'] for e in events))
    return {'events': events, 'stats': stats, 'solved': solved, 'stopped': 'error' if failed else None}
'학습자 코드를 실행하고 결과를 dict로 돌려준다.\n\nCPython 3.13(시험)과 Pyodide(Python 3.14, Web Worker 안)에서 같이 돈다.\n스레드·시그널·네트워크를 쓰지 않는다. 시간 제한은 바깥(작업자 종료)에서 건다.\n\n격리(검토 C18 I2): 실행마다 builtins 전체·재귀 한도·sys.modules 목록을 저장해 두었다가 되돌린다.\n알려진 한계:\n- 이미 import되어 있던 표준 모듈을 학습자가 고치는 것(예: math.pi = 3)은 되돌리지 않는다.\n  이런 변경은 같은 작업자의 다음 실행에 남는다.\n- 실행 중 새로 import된 모듈은 sys.modules에서 지워 다음 실행에서 새로 불러오게 한다.\n  C 확장처럼 다시 import할 수 없거나 두 번째 import에서 상태가 어긋나는 모듈은\n  이 방식으로 깨끗이 되돌릴 수 없다(그럴 때는 작업자를 새로 띄우는 수밖에 없다).\n\n학습자가 builtins를 지우거나 바꿔도(예: del builtins.str) runner가 결과를 돌려주도록,\n학습자 코드가 도는 동안 불리는 runner 코드는 아래 _len·_str 같은 모듈 변수만 쓰고,\n결과(dict) 만들기는 finally에서 builtins를 되돌린 뒤에 한다.\n\n가상 파일·연습 서버(v0.4 E1·E2):\n- 실행마다 새 임시 폴더를 만들어 작업 위치(cwd)로 삼고, files(이름 → 글자)를 UTF-8로 써 둔다.\n  끝나면 원래 위치로 돌아가고 폴더를 통째로 지운다(학습자가 만든 파일도). 실행 사이에 흔적이 없다.\n  files가 없어도 빈 폴더에서 돈다. 절대 경로로 다른 곳에 쓰는 것까지 막지는 않는다.\n- server(주소 → {"status": int, "body": str, "type"?: str})가 있으면 실행 동안\n  urllib.request.urlopen이 이 표에서 답한다(소켓을 열지 않음). 표에 없는 주소는 URLError,\n  status 400 이상은 HTTPError. 끝나면 진짜 urlopen으로 되돌린다. server가 None이면 손대지 않는다.\n\n차트(v0.5 E3): 실행마다 새 `chart` 모듈을 sys.modules에 넣는다(끝나면 지워져 실행 사이에 상태가 없다).\n  matplotlib.pyplot과 거의 같은 이름(line만 pyplot에서는 plot): bar(이름들, 값들), line(이름들, 값들), title(글), xlabel(글), ylabel(글), legend(선 이름들), show().\n  show()가 그림 하나를 결과의 charts에 넣고 그림을 비운다. show() 없이 끝나면 그리지 않는다. 한 실행에 CHART_MAX개까지.\n  인자는 차례로만 받는다(color= 같은 이름 붙은 인자는 한국어 TypeError). 이름은 글자로 바꿔 담고, 값은 JSON에 넣을 수 있는 수(int·float, bool·nan·inf 아님).\n  그림 하나에 막대는 하나만. 꺾은선은 같은 이름들(가로축)로 CHART_LINES_MAX개까지 겹칠 수 있다(v0.9, 17장 심화).\n  막대와 꺾은선은 섞지 않는다. legend(이름들)는 선 이름표 — 부르는 차례는 line 앞뒤 상관없고, show() 때 개수가 선 수와 같아야 한다.\n  그림 모양: 꺾은선 하나이고 legend가 없으면 예전 그대로 {kind, labels, values, …}.\n             꺾은선이 둘 이상이거나 legend가 있으면 values 대신 series: [{"name"?: 글, "values": [수]}, …].\n\n텃밭(v0.10, 설계서 2026-11-05 §2): farm(dict)이 있으면 실행마다 새 `farm` 모듈을 sys.modules에 넣고(끝나면 지움)\n  명령 move(방향)·plant(작물)·harvest()·can_harvest()·what_here()·store()·where()·seeds()를 실행 전역에도 미리 넣는다(import 없이 씀,\n  `from farm import *`·`import farm`도 됨). print는 그대로 출력하면서 say 사건도 남긴다(표준 출력에 쓸 때만).\n  받은 상태는 고치지 않고 다듬은 사본(_farm_state) 위에서 돈다. 시간 1짜리 행동(move·plant·harvest, 실패한\n  심기·빈 칸 수확 포함)은 지금 clock에 일어나고 clock += 1. 다 자람: clock − planted_at ≥ 자라는 시간(당근 8,\n  감자 12, upgrades에 "비료"면 6·9). 감자는 upgrades에 "감자 씨앗"이 있어야 심어짐.\n  한 실행에 행동 FARM_ACTIONS_MAX(500)번까지 — 501번째에 FarmTired(BaseException)로 멈추고, 학습자가 except로\n  삼켜도 추적 함수가 학습자 코드 다음 줄에서 다시 던진다. 결과는 오류가 아니라 stopped "tired".\n  확인(can_harvest·what_here·store·where, 시간 0)은 한 실행에 FARM_CHECKS_MAX(2000)번까지 — 2001번째에 같은 방식으로 멈추고\n  stopped "waited"(`while not can_harvest(): pass`처럼 시간이 흐르지 않는 기다리기, 판정 C60). 확인은 사건을 남기지 않는다.\n  v0.11(설계서 2026-11-05 6~9장 §1): store()는 창고 사본 {"당근": n, "감자": n}(새 dict — 바꿔도 진짜 창고·결과는\n  그대로, 없는 작물 이름은 KeyError), where()는 파이의 자리 튜플 (x, y). 둘 다 확인 하나로 세고 사건은 없다(사건 모양 그대로).\n  둘 중 먼저 걸린 이유가 stopped에 남고, 멈춘 뒤로는 행동·확인 모두 다시 던진다.\n  v0.12(설계서 2026-11-05 10~17장 §1·§2·§4):\n  - 토마토: 자라는 시간 10(비료 7), 업그레이드 없이 심어짐(장마다 여는 것은 앱이 함). 토마토 씨앗 봉투 state["seeds"]\n    (없으면 5, 0..20으로 다듬음): 토마토 심기 성공 −1, 다 자란 토마토 거두기 +2(최대 20). 봉투가 비었을 때 plant("토마토")는\n    시간 1을 쓰고 plant_fail(reason "no_tomato_seed")을 남긴 뒤 ValueError("토마토 씨앗이 떨어졌어요")를 던진다\n    (학습자가 try/except ValueError로 잡을 수 있음). 봉투 검사가 먼저이고(빈 봉투면 칸이 차 있어도 이 오류), 씨앗이\n    있는데 칸이 차 있으면 예전처럼 plant_fail "occupied"(씨앗은 그대로). store()는 세 작물 모두, what_here()는 "토마토"도.\n  - seeds(): 남은 토마토 씨앗 수. 시간 0, 확인 하나로 셈(C60), 사건 없음.\n  - 쪽지함: farm과 files를 함께 주면 files 가운데 "농장일지.txt"가 아닌 것은 받는 쪽지(읽기 전용) — 실행 동안\n    builtins.open·io.open을 감싸 그 파일을 쓰기("w"·"a"·"x"·"+")로 열면 PermissionError("받은 쪽지는 읽기만 해요").\n    경로는 realpath로 비교(절대 경로·링크도 막힘). os.open·_io.open 직접 쓰기는 막지 않는다(받는 쪽지는 실행마다\n    새로 놓이므로 남지 않음). 실행이 끝나면(오류·멈춤·SyntaxError 때도) 실행 폴더의 농장일지.txt를 읽어\n    result["farm"]["files"] = {"농장일지.txt": 끝 2000자}로 돌려준다. 지웠거나 없으면 "", 깨진 바이트는 U+FFFD.\n    다른 새 파일은 폴더와 함께 사라진다. files를 안 주면 open은 그대로이고 결과에 files가 없다.\n    텃밭 없이 files만 주면 예전 그대로(모든 파일 쓰기 가능).\n  v0.12 검토(판정 C71):\n  - 농장일지.txt를 쓰기·덧붙이기로 열 때마다(builtins.open·io.open 길) 행동 상한에 하나씩 든다: 시간 1짜리 행동과\n    일지 쓰기 열기를 합쳐 FARM_ACTIONS_MAX(500)번까지, 넘으면 stopped "tired". 시계는 흐르지 않고 사건도 없으며\n    결과의 actions는 시간 1짜리 행동만 센다(앱의 결과 대조 C62가 그대로 맞게). 끝없는 일지 쓰기 반복이 시간 제한\n    대신 「지침」으로 끝난다. 읽기로 여는 것은 세지 않는다.\n  - farm["tomato_ok"]가 False면(앱: 10장 전) plant("토마토")는 시간 1을 쓰고 plant_fail(reason "tomato_locked")을\n    남긴 뒤 ValueError("토마토는 10장을 끝내면 심을 수 있어요")(봉투 검사보다 먼저). seeds()는 그대로 됨.\n    없거나 다른 값이면 열림. 끝 상태(state)에는 넣지 않는다.\n  - 일지를 돌려줄 때 바로가기(symlink)는 따라가지 않는다(일지 없음 "").\n  result["farm"] = {\n      "events": [ {"t": "move", "line", "dir", "x", "y"}            # x, y = 움직인 뒤 자리\n                | {"t": "plant", "line", "crop", "x", "y"}\n                | {"t": "plant_fail", "line", "reason": "occupied" | "no_seed" | "no_tomato_seed" | "tomato_locked", "crop", "x", "y"}\n                | {"t": "harvest", "line", "crop", "x", "y"}          # 다 자람 → store[crop] += 1\n                | {"t": "harvest_young", "line", "crop", "x", "y"}    # 덜 자람 → 작물만 사라짐\n                | {"t": "harvest_empty", "line", "x", "y"}            # 빈 칸(시간은 1 듦)\n                | {"t": "say", "line", "text"} ],                     # print 한 번(끝 줄바꿈 뺌, 40자까지)\n                # line: 그 명령을 부른 학습자 코드 줄(가장 안쪽). say는 FARM_SAYS_MAX(100)개까지만 남긴다(넘는 print는\n                # 출력만). 시간 1짜리 사건은 행동 상한(500) 안이라 하나도 버리지 않는다 → 사건만으로 끝 상태를 다시 만들 수 있다.\n      "state": {"size", "cells": [None | {"crop", "planted_at"}] (y*size+x), "pie": {"x", "y"},\n                "clock", "store": {"당근", "감자", "토마토"}, "upgrades": [str], "seeds": int},   # 끝 상태(오류가 나도 그 직전까지)\n      "stopped": None | "tired" | "waited", "actions": int,   # actions: 이번 실행의 시간 1짜리 행동 수\n      "files"?: {"농장일지.txt": str} }   # files를 함께 준 텃밭 실행에만(v0.12, 2000자까지)\n  결과 farm은 학습자 코드가 닫힘으로 상태·사건을 건드렸어도 다시 다듬은 사본이다(JSON 모양, nan 없음).\n  규칙 표는 실행마다 바꿀 수 없는 원본에서 새로 만들고, 이 모듈의 전역 이름은 실행이 끝나면 되돌린다(검토 C62 I1).\n  farm=None이면 result에 "farm"이 없다(예전 그대로).\n\n경비실(v0.15, 설계서 2026-11-12 경비실 §2): guard={"mode": "script"|"loop"|"func", "tries": [{"value": str|int,\n  "expect": "block"|"allow"}, …], "password"?: str}가 있으면 guard.py 규칙으로 실행한다(farm과 함께 오면 guard만 씀).\n  명령 block()·allow()·has_try()·next_try()(+ password)를 실행 전역에 넣는다. 판정 규칙은 guard.py 설명 글.\n  학습자가 삼킨 사용 오류(GuardUsageError)도 결과 오류로 알린다. check를 부르는 자리에서 난 오류(인자 수·bool 아님)는\n  def check 줄(판정 G-C1).\n  result["guard"] = {"events": [{"i", "verdict": "block"|"allow"|"none", "ok": bool, "twice"?: True}],\n                     "stats": {"attacks_blocked", "attacks_total", "guests_allowed", "guests_total"},\n                     "solved": bool, "stopped": None | "error"}   # events는 오류 전까지만, guard=None이면 열쇠 없음\n\nrun(code, stdin, require, files=None, server=None, farm=None, lang=None, guard=None) -> {\n    "stdout": str, "stderr": str,\n    "error": None | {"type": str, "line": int | None, "msg": str},\n    "missing": [str, ...],   # require 중 코드에 없는 것(ast 마디 이름, Call:/Name:/Method:/Def:/SQL:, Comment·Elif·Else, SelfCall·FormatSpec·TripleStr, NamedGroup·Reraise)\n    "charts": [{"kind": "bar" | "line", "labels": [str], "values": [int | float],\n                "title"?: str, "xlabel"?: str, "ylabel"?: str}\n               | {"kind": "line", "labels": [str], "series": [{"name"?: str, "values": [...]}, ...], ...}, ...],\n}\nstdin은 "12\n30" 같은 문자열(레슨 데이터 형식) 또는 문자열 목록.\n\n'
import ast
import builtins
import io
import linecache
import os
import shutil
import sys
import tempfile
import tokenize
import traceback
USER_FILE = '<user>'
OUTPUT_LIMIT = 100000
_len = len
_str = str
_BaseException = BaseException
_StringIO_write = io.StringIO.write
_isinstance = isinstance
_getattr = getattr
_chdir = os.chdir
_getcwd = os.getcwd
_rmtree = shutil.rmtree
_BytesIO = io.BytesIO
_io_open = io.open
NO_SUCH_URL = '연습 서버에 없는 주소예요'
try:
    _guard_prepare
except NameError:
    from guard import GuardUsageError, GuardAnswerError, _guard_prepare, _guard_cmds, _guard_exec, _guard_result
import types as _types
_EN = _types.MappingProxyType({'연습 서버에 없는 주소예요': "That address isn't on the practice server", '%s은 글자나 숫자로 줘요(지금 %s)': '%s must be text or a number (got %s)', '%s은 %d글자까지 쓸 수 있어요': '%s can be at most %d characters', '%s은 리스트로 줘요(예: [1, 2, 3])': '%s must be a list (e.g. [1, 2, 3])', '값은 숫자여야 해요(지금 %s)': 'Values must be numbers (got %s)', '값에 nan이나 inf는 쓸 수 없어요': "Values can't be nan or inf", 'chart.%s()에는 %s= 같은 이름 붙은 인자를 쓰지 않아요. 값만 차례로 써요(%s)': "chart.%s() doesn't take named arguments like %s=. Just give the values in order (%s)", 'chart.%s()에는 값을 %d개 줘요(%s)': 'chart.%s() takes %d values (%s)', 'chart.%s()에는 아무것도 넣지 않아요(%s)': 'chart.%s() takes nothing (%s)', '그림 하나에는 막대 그래프 하나만 그려요. 먼저 chart.show()를 불러요': 'One picture holds one bar chart. Call chart.show() first', '막대와 꺾은선은 한 그림에 섞지 않아요. 먼저 chart.show()를 불러요': "Don't mix bars and lines in one picture. Call chart.show() first", '꺾은선은 한 그림에 %d개까지 겹칠 수 있어요': 'One picture can hold up to %d lines', '이름들': 'Labels', '값들': 'Values', '이름': 'A label', '제목': 'The title', '가로축 이름': 'The x-axis label', '세로축 이름': 'The y-axis label', '선 이름들': 'Line names', '선 이름': 'A line name', '이름과 값의 개수가 달라요': 'Labels and values have different lengths', '그릴 값이 하나도 없어요': 'There are no values to draw', '그래프 하나에 값은 %d개까지 그릴 수 있어요': "This app's chart can draw up to %d values", '선마다 이름(가로축)이 같아야 해요': 'Every line needs the same labels (x-axis)', 'chart.bar(이름들, 값들)': 'chart.bar(labels, values)', 'chart.line(이름들, 값들)': 'chart.line(labels, values)', 'chart.title("제목")': 'chart.title("title")', 'chart.xlabel("가로축 이름")': 'chart.xlabel("x-axis label")', 'chart.ylabel("세로축 이름")': 'chart.ylabel("y-axis label")', 'chart.legend(["선 이름", "선 이름"])': 'chart.legend(["line name", "line name"])', '선 이름이 하나도 없어요': 'There are no line names', '선 이름은 %d개까지 줄 수 있어요(꺾은선이 %d개까지라서)': 'Give at most %d line names (a picture holds up to %d lines)', '그릴 그래프가 없어요. chart.bar()나 chart.line()을 먼저 불러요': "There's nothing to draw. Call chart.bar() or chart.line() first", 'chart.legend()는 꺾은선 그래프에만 써요': 'chart.legend() is only for line charts', '선 이름(legend)의 개수가 선 개수와 달라요(선 %d개, 이름 %d개)': "The number of line names (legend) doesn't match the lines (%d lines, %d names)", '그림은 한 번 실행에 %d개까지 보여 줄 수 있어요': 'One run can show up to %d pictures', '방향은 위·아래·왼쪽·오른쪽 중 하나예요': 'Direction must be up, down, left or right', '작물은 당근·감자·토마토 중 하나예요': 'Crop must be carrot, potato or tomato', '토마토 씨앗이 떨어졌어요': 'Out of tomato seeds', '토마토는 10장을 끝내면 심을 수 있어요': 'Tomatoes can be planted after you finish Chapter 10', '받은 쪽지는 읽기만 해요': 'Notes you received are read-only', '파이가 멈췄어요': 'Pi stopped'})
_EN_DOC = _types.MappingProxyType({'chart': "Ria & Python! chart: bar, line, title, xlabel, ylabel, legend, show (almost the same names as matplotlib.pyplot; line is pyplot's plot)", 'chart.bar': 'Bar chart: chart.bar(["apple", "pear"], [3, 5])', 'chart.line': 'Line chart: chart.line(["Mon", "Tue"], [12, 15]). Call again with the same labels to add a line (up to 3)', 'chart.title': 'Picture title', 'chart.xlabel': 'x-axis label', 'chart.ylabel': 'y-axis label', 'chart.legend': 'Line names: chart.legend(["Minji", "Jun"]) — in the order the lines were drawn', 'chart.show': "Shows what you've drawn so far and starts a new picture", 'farm': "Ria & Python! Pi's Garden: move(direction), plant(crop), harvest(), can_harvest(), what_here(), store(), where(), seeds()", 'farm.move': 'Moves Pi one square: move("up"), "down", "left", "right". At the edge Pi wraps to the other side', 'farm.plant': 'Plants on this square: plant("carrot"), plant("potato"), plant("tomato"). A tomato uses one seed from the seed bag', 'farm.harvest': "Harvests the crop on this square. If it isn't grown yet, the crop is lost", 'farm.can_harvest': 'True if this square has a fully grown crop (takes no time)', 'farm.what_here': 'This square: "carrot", "potato", "tomato" or "empty" (takes no time)', 'farm.store': 'A copy of storage {"carrot": n, "potato": n, "tomato": n} (takes no time). Changing the copy leaves real storage alone', 'farm.where': "Pi's position (x, y) (takes no time)", 'farm.seeds': 'Tomato seeds left (takes no time)'})
_FARM_EN_RULES = (('crop', (('당근', 'carrot'), ('감자', 'potato'), ('토마토', 'tomato'))), ('dir', (('위', 'up'), ('아래', 'down'), ('왼쪽', 'left'), ('오른쪽', 'right'))), ('empty', (('빈칸', 'empty'),)), ('file', (('주문서.txt', 'orders.txt'), ('손글씨주문.txt', 'handwritten.txt'), ('농장일지.txt', 'farm_log.txt'))))
FARM_EN = _types.MappingProxyType({k: _types.MappingProxyType(dict(v)) for k, v in _FARM_EN_RULES})

def _norm_lang(v):
    return 'en' if v == 'en' else 'ko'

def _tr_for(lang):
    en = _EN
    if lang != 'en':
        return lambda s: s
    return lambda s: en.get(s, s)

class InputMissing(BaseException):
    pass

class OutputLimit(BaseException):
    pass

def _caller_user_line():
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == USER_FILE:
            return f.f_lineno
        f = f.f_back
    return None

class _CappedIO(io.StringIO):

    def __init__(self, state):
        super().__init__()
        self._state = state

    def write(self, s):
        s = _str(s)
        left = OUTPUT_LIMIT - self._state['used']
        if _len(s) > left:
            if left > 0:
                _StringIO_write(self, s[:left])
            self._state['used'] = OUTPUT_LIMIT
            if self._state['output_limit'] is None:
                self._state['output_limit'] = _caller_user_line()
            raise OutputLimit('output is longer than %d characters' % OUTPUT_LIMIT)
        self._state['used'] += _len(s)
        return _StringIO_write(self, s)

    def raw_write(self, s):
        return _StringIO_write(self, s)

    def close(self):
        pass

def _split_stdin(stdin):
    if stdin is None:
        return []
    if isinstance(stdin, str):
        items = stdin.split('\n')
        if items and items[-1] == '':
            items.pop()
        return items
    return [str(v) for v in stdin]

def _make_input(values, out, state):
    queue = list(values)

    def fake_input(prompt=''):
        if prompt:
            out.write(_str(prompt))
        if not queue:
            if state['input_missing'] is None:
                state['input_missing'] = _caller_user_line()
            raise InputMissing('input() needed more values than were given')
        return _str(queue.pop(0))
    return fake_input

def _user_line(tb):
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == USER_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line

def _user_tb(tb):
    while tb is not None and tb.tb_frame.f_code.co_filename != USER_FILE:
        tb = tb.tb_next
    return tb

def _safe_str(e):
    try:
        return str(e)
    except BaseException:
        return type(e).__name__

def _format_tb(e, tb):
    try:
        return ''.join(traceback.format_exception(type(e), e, tb))
    except BaseException:
        return '%s: %s\n' % (type(e).__name__, _safe_str(e))

def _has_comment(code):
    try:
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type == tokenize.COMMENT:
                return True
    except BaseException:
        return False
    return False

def _has_triple_str(code):
    kinds = {tokenize.STRING}
    for extra in ('FSTRING_START', 'TSTRING_START'):
        if hasattr(tokenize, extra):
            kinds.add(getattr(tokenize, extra))
    try:
        for tok in tokenize.generate_tokens(io.StringIO(code).readline):
            if tok.type in kinds:
                body = tok.string.lstrip('rRbBuUfFtT')
                if body.startswith('"""') or body.startswith("'''"):
                    return True
    except BaseException:
        return False
    return False

def _has_self_call(tree):
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for stmt in fn.body:
                for node in ast.walk(stmt):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and (node.func.id == fn.name):
                        return True
    return False

def _is_elif(node, lines):
    try:
        line = lines[node.lineno - 1].encode('utf-8')
        return line[node.col_offset:].startswith(b'elif')
    except BaseException:
        return False

def _missing(tree, require, code=''):
    if not require:
        return []
    lines = code.splitlines()
    sql_words = [name[4:] for name in require if name.startswith('SQL:') and name[4:]]
    texts = []
    found = set()
    for node in ast.walk(tree):
        found.add(type(node).__name__)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            found.add('Call:' + node.func.id)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            found.add('Method:' + node.func.attr)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            found.add('Name:' + node.id)
        if isinstance(node, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try)) and node.orelse:
            if isinstance(node, ast.If) and len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If) and _is_elif(node.orelse[0], lines):
                found.add('Elif')
            else:
                found.add('Else')
        elif isinstance(node, getattr(ast, 'TryStar', ())) and node.orelse:
            found.add('Else')
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if '(?P<' in node.value:
                found.add('NamedGroup')
            if sql_words:
                texts.append(node.value)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            found.add('Def:' + node.name)
        if isinstance(node, ast.ExceptHandler) and any((isinstance(r, ast.Raise) and r.exc is None for st in node.body for r in ast.walk(st))):
            found.add('Reraise')
        if isinstance(node, ast.FormattedValue) and node.format_spec is not None:
            spec = node.format_spec
            if not (isinstance(spec, ast.JoinedStr) and (not spec.values)):
                found.add('FormatSpec')
    if 'Comment' in require and _has_comment(code):
        found.add('Comment')
    if 'SelfCall' in require and _has_self_call(tree):
        found.add('SelfCall')
    if 'TripleStr' in require and _has_triple_str(code):
        found.add('TripleStr')
    if sql_words:
        import re
        for w in sql_words:
            pat = re.compile('(?<![A-Za-z0-9_])' + re.escape(w) + '(?![A-Za-z0-9_])', re.IGNORECASE)
            if any((pat.search(t) for t in texts)):
                found.add('SQL:' + w)
    return [name for name in require if name not in found]

def _make_run_dir(files):
    d = tempfile.mkdtemp(prefix='ria-run-')
    root = os.path.realpath(d)
    for name, text in (files or {}).items():
        path = os.path.realpath(os.path.join(root, str(name)))
        if os.path.dirname(path) != root and (not path.startswith(root + os.sep)):
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write('' if text is None else str(text))
    return root

def _make_urlopen(server, lang='ko'):
    import email.message
    import http
    import urllib.error
    import urllib.response

    class PracticeResponse(urllib.response.addinfourl):

        def getheader(self, name, default=None):
            return self.headers.get(name, default)

        @property
        def reason(self):
            return _phrase(self.code)

    def _phrase(code):
        try:
            return http.HTTPStatus(code).phrase
        except ValueError:
            return ''
    no_such = _tr_for(lang)(NO_SUCH_URL)
    table = {}
    for url, resp in (server or {}).items():
        resp = resp or {}
        status = int(resp.get('status', 200))
        body = resp.get('body', '')
        body = body.encode('utf-8') if _isinstance(body, str) else bytes(body or b'')
        ctype = str(resp.get('type') or 'text/plain')
        if 'charset' not in ctype:
            ctype += '; charset=utf-8'
        table[str(url)] = (status, body, ctype)

    def urlopen(url, data=None, timeout=None, *args, **kwargs):
        full = _getattr(url, 'full_url', url)
        full = _str(full)
        if full not in table:
            raise urllib.error.URLError(no_such)
        status, body, ctype = table[full]
        headers = email.message.Message()
        headers['Content-Type'] = ctype
        headers['Content-Length'] = _str(_len(body))
        if status >= 400:
            raise urllib.error.HTTPError(full, status, _phrase(status), headers, _BytesIO(body))
        return PracticeResponse(_BytesIO(body), headers, full, status)
    return urlopen
CHART_MAX = 3
CHART_POINTS_MAX = 24
CHART_TEXT_MAX = 40
CHART_LINES_MAX = 3
_float = float
_int = int
_bool = bool
_list = list
_tuple = tuple
_ValueError = ValueError
_TypeError = TypeError
_type = type
_enumerate = enumerate
_INT_SAFE = 2 ** 53

def _make_chart(charts, lang='ko'):
    import types
    tr = _tr_for(lang)
    mod = types.ModuleType('chart')
    mod.__doc__ = '리아와 파이썬! 차트: bar, line, title, xlabel, ylabel, legend, show (matplotlib.pyplot과 거의 같은 이름, line은 pyplot의 plot)'
    fig = {}

    def _text(v, what):
        if _isinstance(v, _bool) or not _isinstance(v, (_str, _int, _float)):
            raise _TypeError(tr('%s은 글자나 숫자로 줘요(지금 %s)') % (tr(what), _type(v).__name__))
        s = _str(v)
        if _len(s) > CHART_TEXT_MAX:
            raise _ValueError(tr('%s은 %d글자까지 쓸 수 있어요') % (tr(what), CHART_TEXT_MAX))
        return s

    def _seq(v, what):
        if not _isinstance(v, (_list, _tuple)):
            raise _TypeError(tr('%s은 리스트로 줘요(예: [1, 2, 3])') % tr(what))
        return _list(v)

    def _num(v):
        if _isinstance(v, _bool) or not _isinstance(v, (_int, _float)):
            raise _TypeError(tr('값은 숫자여야 해요(지금 %s)') % _type(v).__name__)
        if _isinstance(v, _int):
            return v if -_INT_SAFE <= v <= _INT_SAFE else _float(v)
        if v != v or v in (_float('inf'), _float('-inf')):
            raise _ValueError(tr('값에 nan이나 inf는 쓸 수 없어요'))
        return v

    def _args(name, args, kw, n, shape):
        if kw:
            raise _TypeError(tr('chart.%s()에는 %s= 같은 이름 붙은 인자를 쓰지 않아요. 값만 차례로 써요(%s)') % (name, _list(kw)[0], tr(shape)))
        if _len(args) != n:
            raise _TypeError(tr('chart.%s()에는 값을 %d개 줘요(%s)') % (name, n, tr(shape)) if n else tr('chart.%s()에는 아무것도 넣지 않아요(%s)') % (name, tr(shape)))
        return args

    def _plot(kind, labels, values):
        if fig.get('kind') == 'bar' and kind == 'bar':
            raise _ValueError(tr('그림 하나에는 막대 그래프 하나만 그려요. 먼저 chart.show()를 불러요'))
        if fig.get('kind') and fig['kind'] != kind:
            raise _ValueError(tr('막대와 꺾은선은 한 그림에 섞지 않아요. 먼저 chart.show()를 불러요'))
        if fig.get('kind') == 'line' and _len(fig['lines']) >= CHART_LINES_MAX:
            raise _ValueError(tr('꺾은선은 한 그림에 %d개까지 겹칠 수 있어요') % CHART_LINES_MAX)
        labels = _seq(labels, '이름들')
        values = _seq(values, '값들')
        if _len(labels) != _len(values):
            raise _ValueError(tr('이름과 값의 개수가 달라요'))
        if not labels:
            raise _ValueError(tr('그릴 값이 하나도 없어요'))
        if _len(labels) > CHART_POINTS_MAX:
            raise _ValueError(tr('그래프 하나에 값은 %d개까지 그릴 수 있어요') % CHART_POINTS_MAX)
        labels = [_text(x, '이름') for x in labels]
        values = [_num(x) for x in values]
        if fig.get('kind'):
            if labels != fig['labels']:
                raise _ValueError(tr('선마다 이름(가로축)이 같아야 해요'))
            fig['lines'].append(values)
            return
        fig['labels'] = labels
        fig['lines'] = [values]
        fig['kind'] = kind

    def bar(*args, **kw):
        labels, values = _args('bar', args, kw, 2, 'chart.bar(이름들, 값들)')
        _plot('bar', labels, values)

    def line(*args, **kw):
        labels, values = _args('line', args, kw, 2, 'chart.line(이름들, 값들)')
        _plot('line', labels, values)

    def title(*args, **kw):
        text, = _args('title', args, kw, 1, 'chart.title("제목")')
        fig['title'] = _text(text, '제목')

    def xlabel(*args, **kw):
        text, = _args('xlabel', args, kw, 1, 'chart.xlabel("가로축 이름")')
        fig['xlabel'] = _text(text, '가로축 이름')

    def ylabel(*args, **kw):
        text, = _args('ylabel', args, kw, 1, 'chart.ylabel("세로축 이름")')
        fig['ylabel'] = _text(text, '세로축 이름')

    def legend(*args, **kw):
        names, = _args('legend', args, kw, 1, 'chart.legend(["선 이름", "선 이름"])')
        names = _seq(names, '선 이름들')
        if not names:
            raise _ValueError(tr('선 이름이 하나도 없어요'))
        if _len(names) > CHART_LINES_MAX:
            raise _ValueError(tr('선 이름은 %d개까지 줄 수 있어요(꺾은선이 %d개까지라서)') % (CHART_LINES_MAX, CHART_LINES_MAX))
        fig['legend'] = [_text(x, '선 이름') for x in names]

    def show(*args, **kw):
        _args('show', args, kw, 0, 'chart.show()')
        if not fig.get('kind'):
            raise _ValueError(tr('그릴 그래프가 없어요. chart.bar()나 chart.line()을 먼저 불러요'))
        names = fig.get('legend')
        if names is not None and fig['kind'] != 'line':
            raise _ValueError(tr('chart.legend()는 꺾은선 그래프에만 써요'))
        if names is not None and _len(names) != _len(fig['lines']):
            raise _ValueError(tr('선 이름(legend)의 개수가 선 개수와 달라요(선 %d개, 이름 %d개)') % (_len(fig['lines']), _len(names)))
        if _len(charts) >= CHART_MAX:
            raise _ValueError(tr('그림은 한 번 실행에 %d개까지 보여 줄 수 있어요') % CHART_MAX)
        c = {'kind': fig['kind'], 'labels': fig['labels']}
        if _len(fig['lines']) == 1 and names is None:
            c['values'] = fig['lines'][0]
        else:
            c['series'] = [{'name': names[i], 'values': v} if names is not None else {'values': v} for i, v in _enumerate(fig['lines'])]
        for k in ('title', 'xlabel', 'ylabel'):
            if k in fig:
                c[k] = fig[k]
        charts.append(c)
        fig.clear()
    for f in (bar, line, title, xlabel, ylabel, legend, show):
        f.__module__ = 'chart'
        if lang == 'en':
            f.__doc__ = _EN_DOC['chart.' + f.__name__]
        setattr(mod, f.__name__, f)
    if lang == 'en':
        mod.__doc__ = _EN_DOC['chart']
    return mod
FARM_ACTIONS_MAX = 500
FARM_CHECKS_MAX = 2000
FARM_SAYS_MAX = 100
FARM_EVENTS_MAX = FARM_ACTIONS_MAX + FARM_SAYS_MAX
FARM_SAY_MAX = 40
FARM_SIZE_MAX = 12
FARM_FERTILIZER = '비료'
FARM_POTATO_SEED = '감자 씨앗'
FARM_DIR_MSG = '방향은 위·아래·왼쪽·오른쪽 중 하나예요'
FARM_CROP_MSG = '작물은 당근·감자·토마토 중 하나예요'
FARM_TOMATO = '토마토'
FARM_SEEDS_DEFAULT = 5
FARM_SEEDS_MAX = 20
FARM_SEEDS_PER_HARVEST = 2
FARM_NO_TOMATO_SEED_MSG = '토마토 씨앗이 떨어졌어요'
FARM_TOMATO_LOCKED_MSG = '토마토는 10장을 끝내면 심을 수 있어요'
FARM_JOURNAL = '농장일지.txt'
FARM_JOURNAL_MAX = 2000
FARM_NOTE_READONLY_MSG = '받은 쪽지는 읽기만 해요'
FARM_NAMES = ('move', 'plant', 'harvest', 'can_harvest', 'what_here', 'store', 'where', 'seeds')
_FARM_CROP_RULES = (('당근', 8, 6), ('감자', 12, 9), ('토마토', 10, 7))
_FARM_DIR_RULES = (('위', 0, -1), ('아래', 0, 1), ('왼쪽', -1, 0), ('오른쪽', 1, 0))

def _farm_tables():
    import types
    crops = tuple((c for c, _g, _f in _FARM_CROP_RULES))
    grow = types.MappingProxyType({c: g for c, g, _f in _FARM_CROP_RULES})
    fert = types.MappingProxyType({c: f for c, _g, f in _FARM_CROP_RULES})
    dirs = types.MappingProxyType({d: (dx, dy) for d, dx, dy in _FARM_DIR_RULES})
    return (crops, grow, fert, dirs)
FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS = _farm_tables()
_dict = dict
_print = print
_settrace = sys.settrace

class FarmTired(BaseException):
    pass
_FARM_INT_MAX = 2 ** 53

def _farm_int(v, default):
    t = _type(v)
    if t is _float and v == v and (-_FARM_INT_MAX <= v <= _FARM_INT_MAX):
        return _int(v)
    if t is not _int or not -_FARM_INT_MAX <= v <= _FARM_INT_MAX:
        return default
    return v

def _farm_state(farm):
    if _type(farm) is not _dict:
        farm = {}
    get = _dict.get
    size = max(1, min(FARM_SIZE_MAX, _farm_int(get(farm, 'size'), 3)))
    raw = get(farm, 'cells')
    raw = _list(raw) if _type(raw) in (_list, _tuple) else []
    cells = []
    for i in range(size * size):
        c = raw[i] if i < _len(raw) else None
        crop = get(c, 'crop') if _type(c) is _dict else None
        if _type(crop) is _str and crop in FARM_CROPS:
            cells.append({'crop': crop, 'planted_at': _farm_int(get(c, 'planted_at'), 0)})
        else:
            cells.append(None)
    pie = get(farm, 'pie')
    pie = pie if _type(pie) is _dict else {}
    store = {c: 0 for c in FARM_CROPS}
    given = get(farm, 'store')
    if _type(given) is _dict:
        for k, v in _list(_dict.items(given)):
            if _type(k) is _str and k in FARM_CROPS:
                store[k] = max(0, _farm_int(v, 0))
    ups = get(farm, 'upgrades')
    ups = [u for u in ups if _type(u) is _str] if _type(ups) in (_list, _tuple) else []
    seeds = max(0, min(FARM_SEEDS_MAX, _farm_int(get(farm, 'seeds'), FARM_SEEDS_DEFAULT)))
    return {'size': size, 'cells': cells, 'pie': {'x': _farm_int(get(pie, 'x'), 0) % size, 'y': _farm_int(get(pie, 'y'), 0) % size}, 'clock': max(0, _farm_int(get(farm, 'clock'), 0)), 'store': store, 'upgrades': ups, 'seeds': seeds}

def _farm_copy(st):
    return _farm_state(st)
_FARM_EVENT_TYPES = ('move', 'plant', 'plant_fail', 'harvest', 'harvest_young', 'harvest_empty', 'say')
_FARM_EVENT_KEYS = (('line', 'int'), ('x', 'int'), ('y', 'int'), ('dir', 'str'), ('crop', 'str'), ('reason', 'str'), ('text', 'str'))

def _farm_events_copy(events):
    out = []
    if _type(events) is not _list:
        return out
    for e in _list(events)[:FARM_EVENTS_MAX]:
        if _type(e) is not _dict:
            continue
        t = _dict.get(e, 't')
        if _type(t) is not _str or t not in _FARM_EVENT_TYPES:
            continue
        c = {'t': t}
        for k, kind in _FARM_EVENT_KEYS:
            if not _dict.__contains__(e, k):
                continue
            v = _dict.get(e, k)
            if kind == 'int':
                v = None if v is None else _farm_int(v, None)
                if v is None and k != 'line':
                    continue
            elif _type(v) is not _str:
                continue
            c[k] = v
        out.append(c)
    return out

def _farm_journal_text(v):
    return v[-FARM_JOURNAL_MAX:] if _type(v) is _str else ''

def _farm_result(fs, journal=None):
    stopped = _dict.get(fs, 'stopped')
    res = {'events': _farm_events_copy(_dict.get(fs, 'events')), 'state': _farm_copy(_dict.get(fs, 'state')), 'stopped': stopped if _type(stopped) is _str and stopped in ('tired', 'waited') else None, 'actions': max(0, _farm_int(_dict.get(fs, 'actions'), 0))}
    if journal is not None:
        res['files'] = {FARM_JOURNAL: _farm_journal_text(journal)}
    return res

def _read_journal(root, name=FARM_JOURNAL):
    path = os.path.join(root, name)
    try:
        if os.path.islink(path) or not os.path.isfile(path):
            return ''
        with _io_open(path, 'rb') as f:
            f.seek(0, 2)
            size = f.tell()
            take = 4 * FARM_JOURNAL_MAX + 4
            f.seek(max(0, size - take))
            data = f.read(take)
        return _farm_journal_text(data.decode('utf-8', 'replace'))
    except BaseException:
        return ''

def _make_note_guard(readonly, real_open, journal=None, on_journal_write=None, lang='ko'):
    ro = frozenset(readonly)
    realpath = os.path.realpath
    fspath = os.fspath
    isinst = _isinstance
    str_t = _str
    int_t = _int
    perm = PermissionError
    msg = _tr_for(lang)(FARM_NOTE_READONLY_MSG)

    def open(file, mode='r', *args, **kw):
        if isinst(mode, str_t) and ('w' in mode or 'a' in mode or 'x' in mode or ('+' in mode)) and (not isinst(file, int_t)):
            try:
                p = realpath(fspath(file))
            except BaseException:
                p = None
            if p is not None and p in ro:
                raise perm(msg)
            if p is not None and p == journal and (on_journal_write is not None):
                on_journal_write()
        return real_open(file, mode, *args, **kw)
    return open

def _make_farm(fs, out):
    import types
    st = fs['state']
    events = fs['events']
    crops, grow_normal, grow_fert, dirs = _farm_tables()
    actions_max = FARM_ACTIONS_MAX
    checks_max = FARM_CHECKS_MAX
    says_max = FARM_SAYS_MAX
    events_max = FARM_EVENTS_MAX
    say_len = FARM_SAY_MAX
    seed = FARM_POTATO_SEED
    tomato = FARM_TOMATO
    seeds_max = FARM_SEEDS_MAX
    seeds_gain = FARM_SEEDS_PER_HARVEST
    no_tomato_msg = FARM_NO_TOMATO_SEED_MSG
    tomato_locked_msg = FARM_TOMATO_LOCKED_MSG
    tomato_ok = fs.get('tomato_ok', True) is not False
    fertilizer = FARM_FERTILIZER
    lang = fs.get('lang', 'ko')
    tr = _tr_for(lang)
    en = {k: _dict(v) for k, v in _FARM_EN_RULES}
    crop_in = {e: k for k, e in en['crop'].items()}
    dir_in = {e: k for k, e in en['dir'].items()}
    crop_out = en['crop'] if lang == 'en' else {}
    empty_out = en['empty']['빈칸'] if lang == 'en' else '빈칸'
    no_tomato_msg = tr(no_tomato_msg)
    tomato_locked_msg = tr(tomato_locked_msg)
    dir_msg = tr(FARM_DIR_MSG)
    crop_msg = tr(FARM_CROP_MSG)
    tired_msg = tr('파이가 멈췄어요')
    stop_exc = FarmTired
    user_file = USER_FILE
    caller_line = _caller_user_line
    settrace = _settrace
    getframe = sys._getframe
    py_print = _print
    isinst = _isinstance
    str_t = _str
    value_error = _ValueError
    nlen = _len
    sys_mod = sys

    def _ev(t, extra):
        if t == 'say':
            if fs['says'] >= says_max:
                return
            fs['says'] += 1
        if nlen(events) < events_max:
            e = {'t': t, 'line': caller_line()}
            e.update(extra)
            events.append(e)

    def _tired_tracer(frame, event, arg):
        if frame.f_code.co_filename != user_file:
            return None
        if event == 'line' or event == 'call':
            raise stop_exc(tired_msg)
        return _tired_tracer

    def _stop(why):
        if fs['stopped'] is None:
            fs['stopped'] = why
        if not fs['trace_on']:
            fs['trace_on'] = True
            settrace(_tired_tracer)
            f = getframe(1)
            while f is not None:
                if f.f_code.co_filename == user_file:
                    f.f_trace = _tired_tracer
                f = f.f_back
        raise stop_exc(tired_msg)

    def _spent():
        return fs['actions'] + fs.get('writes', 0)

    def _act():
        if fs['stopped'] is not None or _spent() >= actions_max:
            _stop('tired')
        fs['actions'] += 1
        now = st['clock']
        st['clock'] = now + 1
        return now

    def journal_write():
        if fs['stopped'] is not None or _spent() >= actions_max:
            _stop('tired')
        fs['writes'] = fs.get('writes', 0) + 1

    def _here():
        return st['pie']['y'] * st['size'] + st['pie']['x']

    def _ripe(cell, now):
        grow = grow_fert if fertilizer in st['upgrades'] else grow_normal
        return now - cell['planted_at'] >= grow[cell['crop']]

    def move(direction):
        if isinst(direction, str_t) and direction in dir_in:
            direction = dir_in[direction]
        if not isinst(direction, str_t) or direction not in dirs:
            raise value_error(dir_msg)
        _act()
        dx, dy = dirs[direction]
        n = st['size']
        st['pie']['x'] = (st['pie']['x'] + dx) % n
        st['pie']['y'] = (st['pie']['y'] + dy) % n
        _ev('move', {'dir': direction, 'x': st['pie']['x'], 'y': st['pie']['y']})

    def plant(crop):
        if isinst(crop, str_t) and crop in crop_in:
            crop = crop_in[crop]
        if not isinst(crop, str_t) or crop not in crops:
            raise value_error(crop_msg)
        now = _act()
        i = _here()
        pos = {'crop': crop, 'x': st['pie']['x'], 'y': st['pie']['y']}
        if crop == tomato and (not tomato_ok):
            pos['reason'] = 'tomato_locked'
            _ev('plant_fail', pos)
            raise value_error(tomato_locked_msg)
        if crop == tomato and st['seeds'] <= 0:
            pos['reason'] = 'no_tomato_seed'
            _ev('plant_fail', pos)
            raise value_error(no_tomato_msg)
        if st['cells'][i] is not None:
            pos['reason'] = 'occupied'
            _ev('plant_fail', pos)
        elif crop == '감자' and seed not in st['upgrades']:
            pos['reason'] = 'no_seed'
            _ev('plant_fail', pos)
        else:
            st['cells'][i] = {'crop': crop, 'planted_at': now}
            if crop == tomato:
                st['seeds'] -= 1
            _ev('plant', pos)

    def harvest():
        now = _act()
        i = _here()
        cell = st['cells'][i]
        pos = {'x': st['pie']['x'], 'y': st['pie']['y']}
        if cell is None:
            _ev('harvest_empty', pos)
            return
        st['cells'][i] = None
        pos['crop'] = cell['crop']
        if _ripe(cell, now):
            st['store'][cell['crop']] = st['store'].get(cell['crop'], 0) + 1
            if cell['crop'] == tomato:
                st['seeds'] = min(seeds_max, st['seeds'] + seeds_gain)
            _ev('harvest', pos)
        else:
            _ev('harvest_young', pos)

    def _check():
        if fs['stopped'] is not None or fs['checks'] >= checks_max:
            _stop('waited')
        fs['checks'] += 1

    def can_harvest():
        _check()
        cell = st['cells'][_here()]
        return cell is not None and _ripe(cell, st['clock'])

    def what_here():
        _check()
        cell = st['cells'][_here()]
        return empty_out if cell is None else crop_out.get(cell['crop'], cell['crop'])

    def store():
        _check()
        have = st['store']
        return {crop_out.get(c, c): have.get(c, 0) for c in crops}

    def where():
        _check()
        return (st['pie']['x'], st['pie']['y'])

    def seeds():
        _check()
        return st['seeds']

    class _SayTee:

        def __init__(self, target):
            self.out = target
            self.parts = []

        def write(self, s):
            n = self.out.write(s)
            self.parts.append(s)
            return n

        def flush(self):
            pass

    def say_print(*args, **kw):
        target = kw.get('file')
        if target is None:
            target = sys_mod.stdout
        if target is not out:
            return py_print(*args, **kw)
        tee = _SayTee(out)
        kw['file'] = tee
        py_print(*args, **kw)
        text = ''.join(tee.parts)
        if text.endswith('\n'):
            text = text[:-1]
        _ev('say', {'text': text[:say_len]})
    mod = types.ModuleType('farm')
    mod.__doc__ = '리아와 파이썬! 파이의 텃밭: move(방향), plant(작물), harvest(), can_harvest(), what_here(), store(), where(), seeds()'
    if lang == 'en':
        mod.__doc__ = _EN_DOC['farm']
    mod.__all__ = list(FARM_NAMES)
    cmds = {}
    for f in (move, plant, harvest, can_harvest, what_here, store, where, seeds):
        f.__module__ = 'farm'
        if lang == 'en':
            f.__doc__ = _EN_DOC['farm.' + f.__name__]
        setattr(mod, f.__name__, f)
        cmds[f.__name__] = f
    return (mod, cmds, say_print, journal_write)

def _restore_farm_tables():
    global FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS
    FARM_CROPS, FARM_GROW, FARM_GROW_FERTILIZED, FARM_DIRS = _farm_tables()

def run(code, stdin=None, require=None, files=None, server=None, farm=None, lang=None, guard=None):
    if guard is not None:
        farm = None
    if lang is None and _type(farm) is _dict:
        lang = _dict.get(farm, 'lang')
    if lang is None and _type(guard) is _dict:
        lang = _dict.get(guard, 'lang')
    lang = _norm_lang(lang)
    code = '' if code is None else str(code)
    stdin = _split_stdin(stdin)
    require = list(require or [])
    state = {'used': 0, 'input_missing': None, 'output_limit': None}
    out = _CappedIO(state)
    err = _CappedIO(state)
    charts = []
    result = {'stdout': '', 'stderr': '', 'error': None, 'missing': [], 'charts': charts}
    fs = None
    if farm is not None:
        fs = {'state': _farm_state(farm), 'events': [], 'actions': 0, 'checks': 0, 'says': 0, 'stopped': None, 'trace_on': False, 'writes': 0, 'tomato_ok': not (_type(farm) is _dict and _dict.get(farm, 'tomato_ok', True) is False), 'lang': lang}
        result['farm'] = {'events': fs['events'], 'state': None, 'stopped': None, 'actions': 0}
    farm_notes = fs is not None and files is not None
    gs = _guard_prepare(guard, lang) if guard is not None else None
    journal_in = None
    if farm_notes:
        journal_in = _dict.get(files, FARM_JOURNAL, '') if _type(files) is _dict else ''
        journal_in = journal_in if _type(journal_in) is _str else ''
    linecache.cache[USER_FILE] = (len(code), None, code.splitlines(True), USER_FILE)
    try:
        compiled = compile(code, USER_FILE, 'exec')
    except BaseException as e:
        if isinstance(e, SyntaxError):
            result['error'] = {'type': type(e).__name__, 'line': e.lineno, 'msg': _safe_str(e.msg)}
            try:
                text = ''.join(traceback.format_exception_only(type(e), e))
            except BaseException:
                text = '%s: %s\n' % (type(e).__name__, _safe_str(e.msg))
        else:
            result['error'] = {'type': type(e).__name__, 'line': None, 'msg': _safe_str(e)}
            text = '%s: %s\n' % (type(e).__name__, _safe_str(e))
        result['stderr'] = text[:2000]
        linecache.cache.pop(USER_FILE, None)
        if fs is not None:
            result['farm'] = _farm_result(fs, journal_in)
        if gs is not None:
            gs['error'] = True
            result['guard'] = _guard_result(gs)
        return result
    try:
        result['missing'] = _missing(ast.parse(code, USER_FILE), require, code)
    except BaseException:
        result['missing'] = []
    urlreq = real_urlopen = None
    if server is not None:
        import urllib.request as urlreq
        real_urlopen = urlreq.urlopen
        fake_urlopen = _make_urlopen(server, lang)
    old_cwd = _getcwd()
    journal_name = FARM_JOURNAL
    if farm_notes and lang == 'en' and (_type(files) is _dict):
        names = _dict(_FARM_EN_RULES)['file']
        names = _dict(names)
        files = {names.get(_str(k), k): v for k, v in files.items()}
        journal_name = names[FARM_JOURNAL]
    run_dir = _make_run_dir(files)
    note_guard = None
    journal_path = os.path.realpath(os.path.join(run_dir, journal_name)) if farm_notes else None
    old_out, old_err = (sys.stdout, sys.stderr)
    old_builtins = dict(builtins.__dict__)
    old_limit = sys.getrecursionlimit()
    old_modules = set(sys.modules)
    old_modules.discard('chart')
    old_modules.discard('farm')
    old_trace = sys.gettrace()
    mod_globals = globals()
    saved_globals = dict(mod_globals)
    sys.modules['chart'] = _make_chart(charts, lang)
    user_globals = {'__name__': '__main__', '__builtins__': builtins}
    if fs is not None:
        farm_mod, farm_cmds, say_print, journal_write = _make_farm(fs, out)
        if farm_notes:
            readonly = [os.path.realpath(os.path.join(run_dir, str(n))) for n in files if str(n) != journal_name]
            note_guard = _make_note_guard(readonly, _io_open, journal_path, journal_write, lang)
        sys.modules['farm'] = farm_mod
        user_globals.update(farm_cmds)
        builtins.print = say_print
    if gs is not None:
        user_globals.update(_guard_cmds(gs))
    if note_guard is not None:
        builtins.open = note_guard
        io.open = note_guard
    sys.stdout, sys.stderr = (out, err)
    builtins.input = _make_input(stdin, out, state)
    caught = None
    try:
        _chdir(run_dir)
        if urlreq is not None:
            urlreq.urlopen = fake_urlopen
        if gs is not None:
            _guard_exec(gs, compiled, user_globals)
        else:
            exec(compiled, user_globals)
    except _BaseException as e:
        caught = e
    finally:
        builtins.__dict__.clear()
        builtins.__dict__.update(old_builtins)
        mod_globals.clear()
        mod_globals.update(saved_globals)
        _restore_farm_tables()
        if fs is not None and fs['trace_on']:
            _settrace(old_trace)
        sys.stdout, sys.stderr = (old_out, old_err)
        sys.setrecursionlimit(old_limit)
        for name in set(sys.modules) - old_modules:
            del sys.modules[name]
        if urlreq is not None:
            urlreq.urlopen = real_urlopen
        if note_guard is not None:
            io.open = _io_open
        try:
            _chdir(old_cwd)
        except OSError:
            pass
        journal_out = _read_journal(run_dir, journal_name) if farm_notes else None
        _rmtree(run_dir, ignore_errors=True)
    tired = fs is not None and fs['stopped'] is not None
    if tired:
        caught = None
    if isinstance(caught, SystemExit):
        code_val = caught.code
        if code_val is not None and (not isinstance(code_val, int)):
            err.raw_write(_safe_str(code_val)[:1000] + '\n')
    elif caught is not None:
        tb = caught.__traceback__
        if isinstance(caught, SyntaxError):
            line = _user_line(tb) or caught.lineno
            msg = _safe_str(caught.msg)
        else:
            line = _user_line(tb)
            msg = _safe_str(caught)
        result['error'] = {'type': type(caught).__name__, 'line': line, 'msg': msg}
        if not isinstance(caught, (InputMissing, OutputLimit)):
            err.raw_write(_format_tb(caught, _user_tb(tb))[:2000])
    linecache.cache.pop(USER_FILE, None)
    if tired:
        pass
    elif state['input_missing'] is not None or (result['error'] or {}).get('type') == 'InputMissing':
        line = state['input_missing'] or result['error']['line']
        result['error'] = {'type': 'InputMissing', 'line': line, 'msg': 'input() needed more values than were given'}
        err.raw_write('InputMissing (line %s): input() needed more values than were given\n' % line)
    elif state['output_limit'] is not None or (result['error'] or {}).get('type') == 'OutputLimit':
        line = state['output_limit'] or result['error']['line']
        result['error'] = {'type': 'OutputLimit', 'line': line, 'msg': 'output is longer than %d characters' % OUTPUT_LIMIT}
        err.raw_write('OutputLimit (line %s): output is longer than %d characters\n' % (line, OUTPUT_LIMIT))
    elif gs is not None and gs['usage_error'] is not None:
        swallowed = (result['error'] or {}).get('type') != 'GuardUsageError'
        result['error'] = {'type': 'GuardUsageError', 'line': gs['usage_line'], 'msg': gs['usage_error']}
        if swallowed:
            err.raw_write('GuardUsageError (line %s): %s\n' % (gs['usage_line'], gs['usage_error']))
    if gs is not None:
        if result['error'] is not None and result['error']['line'] is None and (gs['err_line'] is not None):
            result['error']['line'] = gs['err_line']
        gs['error'] = result['error'] is not None
        result['guard'] = _guard_result(gs)
    if fs is not None:
        result['farm'] = _farm_result(fs, journal_out)
    result['stdout'] = out.getvalue()
    result['stderr'] = err.getvalue()
    return result
