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

def run(code, stdin=None, require=None, files=None, server=None, farm=None, lang=None):
    if lang is None and _type(farm) is _dict:
        lang = _dict.get(farm, 'lang')
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
        exec(compiled, user_globals)
    except _BaseException as e:
        caught = e
    finally:
        mod_globals.clear()
        mod_globals.update(saved_globals)
        _restore_farm_tables()
        if fs is not None and fs['trace_on']:
            _settrace(old_trace)
        builtins.__dict__.clear()
        builtins.__dict__.update(old_builtins)
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
    if fs is not None:
        result['farm'] = _farm_result(fs, journal_out)
    result['stdout'] = out.getvalue()
    result['stderr'] = err.getvalue()
    return result
