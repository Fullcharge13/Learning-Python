"""경비실 사건 정답 검사 (v0.15 작업 5, 설계서 docs/specs/2026-11-12-경비실-설계.md §3·§6).

사건마다(한국어·영어 각각):
  ① solution이 엔진(src/py/runner.py run(guard=…))에서 해결(solved)
  ② 빈칸을 정답으로 채운 코드(src/guard/blanks.js fillBlanks)도 해결
  ③ 오답 보기를 하나씩 넣은 코드는 해결에 실패
  ④ 「전부 막기」·「전부 들이기」 코드는 해결에 실패
  ⑤ solution이 그 장까지 배운 문법(AST 마디·부르는 이름)만 씀
  ⑥ 시도 1~20개, block·allow 각 1개 이상  ⑦ 사건 id 순서(장 순서), need 오름차순
  ⑧ 3~17장마다 기본 정확히 3개 + 응용(tier "field") 정확히 1개, 응용은 장의 마지막
  ⑨ 기본 id G1~G45 한 번씩, 응용 id = FIELD_IDS
  ⑩ WRONG_SOLUTIONS(어설픈 풀이)는 해결에 실패, 응용 사건은 어설픈 풀이 1개 이상
  ⑪ tier는 없거나 "field", 응용에만 사건 파일 카드(file)와 영어 카드 열쇠(check_file)
  ⑫ OVERLAP_PAIRS: 응용 정답을 기본 사건 시도로 돌리면 실패(같은 판정 규칙이 아님)
영어 실행은 시도 값을 value_en ?? value 로 만든다.

실행: python3 tests/guard_incidents.py   (하나라도 실패하면 종료 코드 1)
"""

import ast
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))

import runner  # noqa: E402

HELPER = os.path.join(ROOT, "tests", "guard_incidents_helper.mjs")

ENGINE_CMDS = {"block", "allow", "has_try", "next_try"}
COMMON = {"Module", "Expr", "Assign", "Name", "Constant", "Call", "BinOp"}
OPS_CTX = {"Eq", "NotEq", "Lt", "LtE", "Gt", "GtE", "In", "NotIn", "Is", "IsNot", "And", "Or", "Not", "Add", "Sub",
           "Mult", "Div", "FloorDiv", "Mod", "Pow", "USub", "UAdd", "Load", "Store", "arguments", "arg"}
# 장별 허용 문법(설계서 docs/specs/2026-11-13-경비실-사건-12개-설계.md §5-6, 누적)
NODES_BY_CH = {3: {"Compare", "BoolOp", "UnaryOp", "If"}, 4: {"FunctionDef", "Return"},
               5: {"While", "For", "AugAssign", "Break", "Continue"}, 6: {"Subscript", "Slice", "Attribute"},
               7: {"List", "Subscript", "Slice"},
               8: {"Dict"},
               9: {"Tuple", "Set", "BitAnd", "BitOr"},
               10: {"Try", "ExceptHandler", "Raise"},
               11: {"With", "withitem", "Import", "alias", "keyword"},
               13: {"ImportFrom"},
               15: {"ClassDef", "Pass"}}
# 장별로 import할 수 있는 모듈(누적)과 from-import로 가져올 이름
IMPORTS_BY_CH = {11: {"csv"}, 12: {"re"}, 13: {"urllib.parse"}, 14: {"json"}}
FROM_NAMES_BY_CH = {13: {"urlparse"}, 14: {"parse_qs"}}
CALLS_BY_CH = {4: {"len"}, 5: {"range"},
               7: {"sorted", "min", "max", "sum"},
               9: {"set", "type"},
               10: {"int", "float"},
               11: {"open"}, 13: {"urlparse"}, 14: {"parse_qs"}, 15: {"super"}}
METHODS = {"lower", "upper", "strip", "split", "replace", "find", "count", "startswith", "endswith"}
METHODS_BY_CH = {7: {"append", "remove", "sort"}, 8: {"get", "keys", "values", "items"}, 9: {"add"},
                 11: {"reader", "readlines", "read"},
                 12: {"search", "fullmatch", "findall", "sub"}, 14: {"loads"}}
WANT_IDS = ["G1", "G2", "G7", "G46", "G3", "G8", "G9", "G47", "G4", "G5", "G10", "G48", "G6", "G11", "G12", "G49",
            "G13", "G14", "G15", "G50", "G16", "G17", "G18", "G51", "G19", "G20", "G21", "G52",
            "G22", "G23", "G24", "G53", "G25", "G26", "G27", "G54", "G28", "G29", "G30", "G55",
            "G31", "G32", "G33", "G56", "G34", "G35", "G36", "G57", "G37", "G38", "G39", "G58",
            "G40", "G41", "G42", "G59", "G43", "G44", "G45", "G60"]
WANT_CHAPTERS = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9,
                 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15,
                 16, 16, 16, 16, 17, 17, 17, 17]
BASIC_IDS = ["G%d" % n for n in range(1, 46)]
# 응용 사건(tier "field", 설계 docs/specs/2026-11-14-경비실-응용-사건-설계.md §4-1·§6). 작업마다 늘린다.
FIELD_IDS = ["G46", "G47", "G48", "G49", "G50", "G51", "G52", "G53", "G54", "G55", "G56", "G57", "G58", "G59", "G60"]
# 겹침 검사(설계 §8): (응용, 기본) — 응용의 solution을 기본 사건의 시도로 돌리면 해결에 실패해야 한다
# (같은 판정 규칙이 아님). 방식(mode)이 같은 짝만 넣는다. 작업 4·5가 채운다.
# 실패는 오류 없이 판정이 틀려서여야 한다(오류로 멈춘 실패는 같은 규칙인지 알려 주지 않음).
# (G57, G12)는 넣지 않는다: G12 시도는 JSON이 아니라서 G57 정답이 json.loads에서 오류를 낸다.
# 대신 G12 정답을 WRONG_SOLUTIONS["G57"]에 넣어, G57 시도에서 판정이 틀려 실패함을 확인한다.
OVERLAP_PAIRS = [("G55", "G11"), ("G55", "G29"), ("G56", "G31")]


# ⑩ 틀린 풀이: 초보·대학생이 흔히 쓰는 어설픈 풀이. 시도를 보강한 뒤에는 각각 해결에 실패해야 한다
# (설계서 docs/specs/2026-11-13-경비실-v0.16.1-다듬기-설계.md §2-5). 풀이는 사건 방식(script/func)에 맞춘 코드다.
WRONG_SOLUTIONS = {
    "G1": [
        "if attempt.startswith(password):\n    allow()\nelse:\n    block()\n",
        "if attempt.strip() == password:\n    allow()\nelse:\n    block()\n",
        "if password in attempt:\n    allow()\nelse:\n    block()\n",
    ],
    "G46": [
        'if attempt == "asleep":\n    block()\nelse:\n    allow()\n',
        'if attempt == "asleep" or attempt == "lunch":\n    block()\nelse:\n    allow()\n',
    ],
    "G47": [
        'def check(attempt):\n    return attempt != "transfer"\n',
        'def asks_money(request):\n    return request == "transfer" or request == "safe_account"\n\n'
        "def check(attempt):\n    return not asks_money(attempt)\n",
    ],
    "G48": [
        "count = 0\nwhile has_try():\n    next_try()\n    count = count + 1\n    if count >= 3:\n        block()\n    else:\n        allow()\n",
        # 기본 G5의 정답(5개까지 들이고 그 뒤 막기) — 같은 판정 규칙이 아님을 확인
        "count = 0\nwhile has_try():\n    next_try()\n    if count < 5:\n        allow()\n        count = count + 1\n    else:\n        block()\n",
        'last = ""\nswitches = 0\nwhile has_try():\n    name = next_try()\n    if last != "" and name != last:\n'
        "        switches = switches + 1\n    if switches >= 2:\n        block()\n    else:\n        allow()\n",
        'last = ""\nswitches = 0\nwhile has_try():\n    name = next_try()\n    if last != "" and name != last:\n'
        "        switches = switches + 1\n        last = name\n        if switches >= 2:\n            block()\n        else:\n            allow()\n"
        "    else:\n        last = name\n        allow()\n",
    ],
    "G49": [
        'def check(attempt):\n    return "exe" not in attempt.lower()\n',
        'def check(attempt):\n    return not attempt.lower().endswith(".exe")\n',
        'def check(attempt):\n    ext = attempt.lower().split(".")[1]\n    if ext == "exe" or ext == "scr" or ext == "bat":\n'
        "        return False\n    return True\n",
    ],
    "G50": [
        'real = ["pinebank.example", "login.pi.example", "farm.pi.example"]\n\ndef check(attempt):\n    return attempt.lower() in real\n',
        'def check(attempt):\n    if "1" in attempt or "0" in attempt:\n        return False\n    return True\n',
        'real = ["pinebank.example", "login.pi.example", "farm.pi.example"]\n\ndef check(attempt):\n    name = attempt.lower()\n    if name in real:\n        return True\n'
        '    if name.replace("1", "l") in real:\n        return False\n    return True\n',
    ],
    "G51": [
        'def check(attempt):\n    return "010-" not in attempt\n',
        # 이름(키)을 찾는 풀이 — 번호가 아니라 이름을 봄
        'phones = {"minji": "010-0000-1234", "jun": "010-0001-5678", "sora": "010-0002-9012"}\n\n'
        'def check(attempt):\n    for name in phones:\n        if name in attempt:\n            return False\n'
        '    return True\n',
        # 반복 안에서 바로 True를 돌려줘 첫 고객만 봄
        'phones = {"minji": "010-0000-1234", "jun": "010-0001-5678", "sora": "010-0002-9012"}\n\n'
        'def check(attempt):\n    for phone in phones.values():\n        if phone in attempt:\n'
        '            return False\n        return True\n',
        'phones = {"minji": "010-0000-1234", "jun": "010-0001-5678", "sora": "010-0002-9012"}\n\n'
        'def check(attempt):\n    return "010-0000" not in attempt\n',
        # 사전 없이 숫자 개수만 세기(11자리 이상이면 막기) — 주문 번호를 막아 버림
        'def check(attempt):\n    n = 0\n    for ch in attempt:\n        if ch in "0123456789":\n            n = n + 1\n'
        '    return n < 11\n',
    ],
    "G52": [
        'allowed = {"pi-garden", "seed-calc", "weather-pi"}\n\ndef check(attempt):\n'
        '    return attempt in allowed\n',
        'allowed = {"pi-garden", "seed-calc", "weather-pi"}\n\ndef check(attempt):\n'
        '    return attempt.lower() in allowed\n',
        'allowed = {"pigarden", "seedcalc", "weatherpi"}\n\ndef check(attempt):\n'
        '    return attempt.lower().replace("_", "").replace("-", "") in allowed\n',
        'allowed = {"pi-garden", "seed-calc", "weather-pi"}\n\ndef check(attempt):\n'
        '    name = attempt.lower().replace("_", "-")\n    for a in allowed:\n        if name.startswith(a):\n'
        '            return True\n    return False\n',
        # 기본 G19 정답 모양(집합 부분집합)을 이 사건 집합에 맞춘 것 — 표기 맞추기가 없음
        'allowed = {"pi-garden", "seed-calc", "weather-pi"}\n\ndef check(attempt):\n'
        '    return set(attempt.split(",")) <= allowed\n',
    ],
    "G53": [
        # 기본 G24 정답 모양(KeyError 하나만 잡기)을 이 사건에 맞춘 것
        'backups = {"ledger": ["locked", "ok"], "photos": ["locked", "broken", "ok"], "diary": ["ok"]}\n\n'
        'def check(attempt):\n    try:\n        name, num = attempt.split(":")\n'
        '        state = backups[name][int(num)]\n    except KeyError:\n        return False\n'
        '    return state == "ok"\n',
        'backups = {"ledger": ["locked", "ok"], "photos": ["locked", "broken", "ok"], "diary": ["ok"]}\n\n'
        'def check(attempt):\n    try:\n        name, num = attempt.split(":")\n'
        '        state = backups[name][int(num)]\n    except ValueError:\n        return False\n'
        '    except KeyError:\n        return False\n    except IndexError:\n        return False\n'
        '    return True\n',
        'backups = {"ledger": ["locked", "ok"], "photos": ["locked", "broken", "ok"], "diary": ["ok"]}\n\n'
        'def check(attempt):\n    try:\n        name, num = attempt.split(":")\n'
        '        state = backups[name][int(num)]\n    except ValueError:\n        return False\n'
        '    except KeyError:\n        return False\n    except IndexError:\n        return False\n'
        '    return state != "locked"\n',
        'backups = {"ledger": ["locked", "ok"], "photos": ["locked", "broken", "ok"], "diary": ["ok"]}\n\n'
        'def check(attempt):\n    try:\n        name = attempt.split(":")[0]\n'
        '        state = backups[name][-1]\n    except KeyError:\n        return False\n'
        '    return state == "ok"\n',
    ],
    "G54": [
        'recorded = {}\nwith open("fingerprints.txt") as f:\n    for line in f:\n'
        '        mark, name = line.strip().split("  ")\n        recorded[name] = mark\n\ndef check(attempt):\n'
        '    name, mark = attempt.split(",")\n    return mark in recorded.values()\n',
        'recorded = {}\nwith open("fingerprints.txt") as f:\n    for line in f:\n'
        '        mark, name = line.strip().split("  ")\n        recorded[name] = mark\n\ndef check(attempt):\n'
        '    name, mark = attempt.split(",")\n    return name in recorded\n',
        'recorded = {}\nwith open("fingerprints.txt") as f:\n    for line in f:\n'
        '        mark, name = line.strip().split("  ")\n        recorded[name] = mark\n\ndef check(attempt):\n'
        '    name, mark = attempt.split(",")\n    return name in recorded and recorded[name].startswith(mark)\n',
        # 기본 G25 정답(파일 이름만 바꾸고 판정을 뒤집음): 요청이 파일의 한 줄과 똑같으면 들이기
        'with open("fingerprints.txt", encoding="utf-8") as f:\n    lines = f.readlines()\n\ndef check(attempt):\n'
        '    for line in lines:\n        if line.strip() == attempt:\n            return True\n    return False\n',
        # 파일 이름과 지문이 기록 글 어딘가에 따로따로 있기만 하면 들이기 — 다른 파일의 지문도 들어감
        'with open("fingerprints.txt") as f:\n    text = f.read()\n\ndef check(attempt):\n'
        '    name, mark = attempt.split(",")\n    return name in text and mark in text\n',
    ],
    "G55": [
        # 짧은 주소만 보고 막기
        'import re\n\ndef check(attempt):\n'
        '    return not re.search(r"https?://sl.example/\\w+", attempt.lower())\n',
        # 미끼 말만 보고 막기
        'import re\n\nbait = ["택배", "과태료", "청첩장", "parcel", "penalty", "invitation"]\n\ndef check(attempt):\n'
        '    for word in bait:\n        if word in attempt.lower():\n            return False\n    return True\n',
        'import re\n\nbait = ["택배", "과태료", "청첩장", "parcel", "penalty", "invitation"]\n\ndef check(attempt):\n'
        '    text = attempt.lower()\n    if re.search(r"https?://sl.example/\\w+", text):\n'
        '        return False\n    for word in bait:\n        if word in text:\n            return False\n'
        '    return True\n',
        'import re\n\nbait = ["택배", "과태료", "청첩장", "parcel", "penalty", "invitation"]\n\ndef check(attempt):\n'
        '    text = attempt\n    if not re.search(r"https?://sl.example/\\w+", text):\n        return True\n'
        '    for word in bait:\n        if word in text:\n            return False\n    return True\n',
        # 정규표현식 없이 글자 "sl.example/"가 들었는지만 보기 — 링크가 없는 주의 안내를 막아 버림
        'bait = ["택배", "과태료", "청첩장", "parcel", "penalty", "invitation"]\n\ndef check(attempt):\n'
        '    text = attempt.lower()\n    if "sl.example/" not in text:\n        return True\n'
        '    for word in bait:\n        if word in text:\n            return False\n    return True\n',
    ],
    "G56": [
        # 주소 글자 어딘가에 우리 도메인이 들었는지만 보기 — 경로에 넣은 가짜를 들여 버림
        'def check(attempt):\n    return "farm.pi.example" in attempt or "pay.pi.example" in attempt\n',
        # 앞부분만 보기 — farm.pi.example.evil.example, @ 주소를 들여 버림
        'def check(attempt):\n    return attempt.startswith("https://farm.pi.example") or attempt.startswith("https://pay.pi.example")\n',
        # netloc 끝만 보기 — evilpi.example을 들여 버림
        'from urllib.parse import urlparse\n\ndef check(attempt):\n    return urlparse(attempt).netloc.endswith("pi.example")\n',
        # 기본 G31 정답 그대로(https + 호스트가 farm.pi.example 하나) — 결제 도메인을 막아 버림
        'from urllib.parse import urlparse\n\ndef check(attempt):\n    if "\\\\" in attempt:\n        return False\n    url = urlparse(attempt)\n'
        '    return url.scheme == "https" and url.hostname == "farm.pi.example"\n',
        # 기본 G31 모양을 목록으로 넓힌 것(hostname) — 포트를 붙인 QR을 들여 버림
        'from urllib.parse import urlparse\n\nshops = ["farm.pi.example", "pay.pi.example"]\n\ndef check(attempt):\n'
        '    url = urlparse(attempt)\n    return url.scheme == "https" and url.hostname in shops\n',
        # urlparse 없이 「도메인 + /」로 시작하는지만 보기 — 경로 없이 ?가 붙은 주소를 막아 버림
        'def check(attempt):\n    return attempt.startswith("https://farm.pi.example/") or attempt.startswith("https://pay.pi.example/")\n',
        # urlparse 없이 /로 잘라 세 번째 조각을 보기 — 경로 없이 ?가 붙은 주소를 막아 버림
        'shops = ["farm.pi.example", "pay.pi.example"]\n\ndef check(attempt):\n    return attempt.split("/")[2] in shops\n',
    ],
    "G57": [
        # JSON을 풀지 않고 글자 그대로 태그를 찾기 — 「\u003c」로 숨긴 태그를 놓침
        'tags = ["<script", "<img", "<iframe"]\n\ndef check(attempt):\n    for tag in tags:\n'
        '        if tag in attempt.lower():\n            return False\n    return True\n',
        # 기본 G12 정답 그대로(< > ' 글자가 있으면 막기) — 하트 <3을 막아 버림
        "def check(attempt):\n    for ch in attempt:\n        if ch in \"<>'\":\n            return False\n    return True\n",
        # 풀고 나서 < 글자가 있으면 다 막기 — 하트와 비교 기호까지 막아 버림
        'import json\n\ndef check(attempt):\n    post = json.loads(attempt)\n'
        '    return "<" not in post["title"] and "<" not in post["body"]\n',
        # 본문만 보기 — 제목에 넣은 태그를 놓침
        'import json\n\ntags = ["<script", "<img", "<iframe"]\n\ndef check(attempt):\n    post = json.loads(attempt)\n'
        '    for tag in tags:\n        if tag in post["body"].lower():\n            return False\n    return True\n',
        # <script만 보기 — <img, <iframe을 놓침
        'import json\n\ndef check(attempt):\n    post = json.loads(attempt)\n    for text in [post["title"], post["body"]]:\n'
        '        if "<script" in text.lower():\n            return False\n    return True\n',
        # json.loads 없이 글자 조각으로 맞히기 — <\u0073cript>로 쓴 태그를 놓침
        'def check(attempt):\n    t = attempt.lower()\n    return "script>" not in t and "src=" not in t\n',
        'def check(attempt):\n    t = attempt.lower()\n    return "<s" not in t and "<i" not in t and "u003c" not in t\n',
        # json.loads 없이 \\u가 보이면 다 막기 — \\uXXXX로 적은 평범한 글을 막아 버림
        'tags = ["<script", "<img", "<iframe"]\n\ndef check(attempt):\n    t = attempt.lower()\n    if "\\\\u" in t:\n'
        '        return False\n    for tag in tags:\n        if tag in t:\n            return False\n    return True\n',
    ],
    "G58": [
        # 막은 로그인까지 기억하기 — 공격자 위치가 기준이 되어 진짜 주인을 막음
        'home = {"seoul": "kr", "busan": "kr", "jeju": "kr", "lisbon": "pt", "lima": "pe"}\n\nclass Account:\n'
        '    def __init__(self):\n        self.city = ""\n        self.hour = 0\n\n    def login(self, city, hour):\n'
        '        ok = not (self.city != "" and home[city] != home[self.city] and hour - self.hour < 6)\n'
        '        self.city = city\n        self.hour = hour\n        return ok\n\nacct = Account()\nwhile has_try():\n'
        '    city, hour = next_try().split(",")\n    if acct.login(city, int(hour)):\n        allow()\n    else:\n        block()\n',
        # 나라가 아니라 도시가 바뀌면 막기
        'class Account:\n    def __init__(self):\n        self.city = ""\n        self.hour = 0\n\n    def login(self, city, hour):\n'
        '        if self.city != "" and city != self.city and hour - self.hour < 6:\n            return False\n'
        '        self.city = city\n        self.hour = hour\n        return True\n\nacct = Account()\nwhile has_try():\n'
        '    city, hour = next_try().split(",")\n    if acct.login(city, int(hour)):\n        allow()\n    else:\n        block()\n',
        # 시간을 보지 않고 나라가 바뀌면 막기
        'home = {"seoul": "kr", "busan": "kr", "jeju": "kr", "lisbon": "pt", "lima": "pe"}\n\nclass Account:\n'
        '    def __init__(self):\n        self.city = ""\n\n    def login(self, city):\n'
        '        if self.city != "" and home[city] != home[self.city]:\n            return False\n'
        '        self.city = city\n        return True\n\nacct = Account()\nwhile has_try():\n'
        '    city, hour = next_try().split(",")\n    if acct.login(city):\n        allow()\n    else:\n        block()\n',
        # 첫 로그인만 기억하기(그 뒤로 기억을 바꾸지 않음)
        'home = {"seoul": "kr", "busan": "kr", "jeju": "kr", "lisbon": "pt", "lima": "pe"}\n\nclass Account:\n'
        '    def __init__(self):\n        self.city = ""\n        self.hour = 0\n\n    def login(self, city, hour):\n'
        '        if self.city == "":\n            self.city = city\n            self.hour = hour\n            return True\n'
        '        return not (home[city] != home[self.city] and hour - self.hour < 6)\n\nacct = Account()\nwhile has_try():\n'
        '    city, hour = next_try().split(",")\n    if acct.login(city, int(hour)):\n        allow()\n    else:\n        block()\n',
        # 기본 G38 모양(한 번 이상하면 계정을 잠가 그 뒤로 다 막기) — 막은 뒤 진짜 주인도 막음
        'home = {"seoul": "kr", "busan": "kr", "jeju": "kr", "lisbon": "pt", "lima": "pe"}\n\nclass Account:\n'
        '    def __init__(self):\n        self.city = ""\n        self.hour = 0\n        self.locked = False\n\n'
        '    def login(self, city, hour):\n        if self.locked:\n            return False\n'
        '        if self.city != "" and home[city] != home[self.city] and hour - self.hour < 6:\n'
        '            self.locked = True\n            return False\n        self.city = city\n        self.hour = hour\n'
        '        return True\n\nacct = Account()\nwhile has_try():\n'
        '    city, hour = next_try().split(",")\n    if acct.login(city, int(hour)):\n        allow()\n    else:\n        block()\n',
    ],
    "G59": [
        # 글자 어딘가에 password가 있으면 막기 — password_hash 표를 막고 pw를 놓침
        'def check(attempt):\n    return "password" not in attempt.lower()\n',
        # 칸 이름에 pw나 pass가 들어 있으면 막기 — 해시 칸과 bus_pass를 막아 버림
        'def check(attempt):\n    cols = attempt.split("(")[1].split(")")[0]\n    for col in cols.split(","):\n'
        '        name = col.strip().split(" ")[0].lower()\n        if "pw" in name or "pass" in name:\n            return False\n'
        '    return True\n',
        # hash라는 글자가 있으면 다 괜찮다고 보기 — pw_hash 옆의 pw를 놓침
        'plain = ["password", "pw", "passwd"]\n\ndef check(attempt):\n    if "hash" in attempt.lower():\n        return True\n'
        '    cols = attempt.split("(")[1].split(")")[0]\n    for col in cols.split(","):\n'
        '        if col.strip().split(" ")[0].lower() in plain:\n            return False\n    return True\n',
        # 정규표현식으로 「이름 TEXT」만 찾기 — 칸 종류를 뺀 password 칸을 놓침
        'import re\n\ndef check(attempt):\n    return re.search(r"(password|pw|passwd) text", attempt.lower()) is None\n',
        # 기본 G41 모양(대문자로 바꾼 쿼리에 PASSWORD·PW 글자가 있으면 막기) — 해시 칸을 막아 버림
        'def check(attempt):\n    q = attempt.upper()\n    if "PASSWORD" in q or "PW" in q:\n        return False\n    return True\n',
        # 칸을 나누지 않고 앞뒤 띄어쓰기·괄호를 붙인 낱말로 찾기 — 쉼표 바로 뒤의 password 칸을 놓침
        'def check(attempt):\n    t = attempt.lower()\n    for w in ["password", "pw", "passwd"]:\n'
        '        if " " + w + " " in t or "(" + w + " " in t or " " + w + ")" in t:\n            return False\n    return True\n',
    ],
    "G60": [
        # 기본 G17 모양(출처마다 요청 횟수를 세기) — 같은 포트를 여러 번 오는 보통 손님을 막음
        'counts = {}\nwhile has_try():\n    src, port = next_try().split(",")\n    counts[src] = counts.get(src, 0) + 1\n'
        '    if counts[src] >= 4:\n        block()\n    else:\n        allow()\n',
        # 출처를 가리지 않고 모든 포트를 한데 세기
        'seen = set()\nwhile has_try():\n    src, port = next_try().split(",")\n    seen.add(port)\n'
        '    if len(seen) >= 4:\n        block()\n    else:\n        allow()\n',
        # 기본 G21 모양(이미 본 것은 들이고 새것만 따지기): 새 포트일 때만 막기 — 이미 두드린 포트로 다시 오면 들여 버림
        'ports = {}\nwhile has_try():\n    src, port = next_try().split(",")\n    if src not in ports:\n        ports[src] = set()\n'
        '    new = port not in ports[src]\n    ports[src].add(port)\n    if new and len(ports[src]) >= 4:\n        block()\n'
        '    else:\n        allow()\n',
        # 기본 G45 정답 그대로(가장 시끄러운 출처)
        "counts = {}\ntotal = 0\nwhile has_try():\n    src = next_try()\n    total = total + 1\n    counts[src] = counts.get(src, 0) + 1\n"
        "    if counts[src] >= 5 and counts[src] * 2 > total:\n        block()\n    else:\n        allow()\n",
    ],
    "G6": [
        'def check(attempt):\n    if len(attempt) <= 8:\n        return False\n    if "pie" in attempt.lower():\n        return False\n'
        '    for ch in attempt:\n        if ch in "0123456789":\n            return True\n    return False\n',
    ],
    "G7": [
        'if attempt.startswith("owner") or attempt == "ria":\n    allow()\nelse:\n    block()\n',
        'if attempt in "owner" or attempt == "ria":\n    allow()\nelse:\n    block()\n',
        'if "owner" in attempt or attempt == "ria":\n    allow()\nelse:\n    block()\n',
    ],
    "G13": [
        'common = ["123456", "password", "qwerty", "letmein", "iloveyou"]\n\ndef check(attempt):\n'
        "    if attempt.lower() in common or len(attempt) < 8:\n        return False\n    return True\n",
        'common = ["123456", "password", "qwerty", "letmein", "iloveyou"]\n\ndef check(attempt):\n'
        "    if attempt.lower() in common:\n        return False\n    return len(attempt) > 6\n",
        'common = ["123456", "password", "qwerty", "letmein", "iloveyou"]\n\ndef check(attempt):\n'
        "    if any(c.startswith(attempt.lower()) for c in common):\n        return False\n    return True\n",
    ],
    "G16": [
        'perms = {\n    "guest": ["read"],\n    "farmer": ["read", "write"],\n    "owner": ["read", "write", "delete"],\n}\n\n'
        'def check(attempt):\n    parts = attempt.split(":")\n    role = parts[0]\n    action = parts[1]\n'
        "    return action in perms.get(role, [])\n",
        'perms = {\n    "guest": ["read"],\n    "farmer": ["read", "write"],\n    "owner": ["read", "write", "delete"],\n}\n\n'
        'def check(attempt):\n    parts = attempt.split(":")\n    role = parts[0]\n    action = parts[-1]\n'
        "    return action in perms.get(role, [])\n",
    ],
    "G22": [
        "def check(attempt):\n    return attempt.isdigit() and 1 <= int(attempt) <= 50\n",
        "def check(attempt):\n    if not attempt.strip().isdigit():\n        return False\n    return 1 <= int(attempt) <= 50\n",
    ],
    "G28": [
        'import re\ndef check(attempt):\n    return re.match(r"^\\d{6}$", attempt) is not None\n',
        'import re\ndef check(attempt):\n    return re.fullmatch(r"\\d{6}", attempt) is not None\n',
        'import re\ndef check(attempt):\n    return re.search(r"^\\d{6}$", attempt) is not None\n',
    ],
    "G31": [
        'from urllib.parse import urlparse\n\ndef check(attempt):\n    url = urlparse(attempt)\n'
        '    return url.scheme == "https" and url.hostname.endswith("farm.pi.example")\n',
        'from urllib.parse import urlparse\n\ndef check(attempt):\n    url = urlparse(attempt)\n'
        '    return url.scheme == "https" and url.hostname == "farm.pi.example"\n',
    ],
    "G33": [
        'import re\nfrom urllib.parse import urlparse\n\ndef check(attempt):\n    links = re.findall(r\'href="([^"]*)"\', attempt)\n'
        '    for link in links:\n        parts = urlparse(link)\n        if parts.hostname == "farm.pi.example":\n            continue\n'
        '        if parts.scheme != "" or parts.netloc != "":\n            return False\n'
        '        if not link.startswith("/") or link.startswith("//") or "\\\\" in link:\n            return False\n    return True\n',
        'import re\nfrom urllib.parse import urlparse\n\ndef check(attempt):\n    links = re.findall(r\'(?:href|src)=["\\\']([^"\\\']*)["\\\']\', attempt)\n'
        '    for link in links:\n        parts = urlparse(link)\n        if parts.hostname == "farm.pi.example":\n            continue\n'
        '        if parts.scheme != "" or parts.netloc != "":\n            return False\n'
        '        if not link.startswith("/") or link.startswith("//") or "\\\\" in link:\n            return False\n    return True\n',
        'import re\nfrom urllib.parse import urlparse\n\ndef check(attempt):\n    links = re.findall(r\'(?:href|src)=["\\\']([^"\\\']*)["\\\']\', attempt)\n'
        '    for link in links:\n        parts = urlparse(link)\n        if parts.scheme in ("http", "https") and parts.hostname == "farm.pi.example":\n            continue\n'
        '        if parts.scheme != "" or parts.netloc != "":\n            return False\n'
        '        if not link.startswith("/") or link.startswith("//") or "\\\\" in link:\n            return False\n    return True\n',
        'import re\nfrom urllib.parse import urlparse\n\ndef check(attempt):\n    links = re.findall(r\'\'\'(?:href|src)\\s*=\\s*["\']([^"\']*)["\']\'\'\', attempt, re.I)\n'
        '    for link in links:\n        parts = urlparse(link)\n        if parts.scheme in ("http", "https") and parts.hostname == "farm.pi.example":\n            continue\n'
        '        if parts.scheme != "" or parts.netloc != "":\n            return False\n'
        '        if not link.startswith("/") or link.startswith("//") or "\\\\" in link or "&" in link:\n            return False\n    return True\n',
    ],
    "G40": [
        'def check(attempt):\n    q = attempt.strip().upper()\n    return "SELECT" in q and ";" not in q\n',
    ],
    "G41": [
        'def check(attempt):\n    q = attempt.upper()\n    if "PHONE" in q or "ADDRESS" in q:\n        return False\n'
        '    return "COUNT(" in q or "AVG(" in q\n',
        'def check(attempt):\n    q = attempt.upper()\n    if ";" in q or "PHONE" in q or "ADDRESS" in q:\n        return False\n'
        '    return "COUNT(" in q or "AVG(" in q\n',
        'def check(attempt):\n    q = attempt.upper()\n    if "PHONE" in q or "ADDRESS" in q or " FROM " not in q:\n        return False\n'
        '    for col in q.replace("SELECT", "").split(" FROM ")[0].split(","):\n'
        '        if not (col.strip().startswith("COUNT(") or col.strip().startswith("AVG(")):\n            return False\n    return True\n',
        'def check(attempt):\n    q = attempt.upper()\n    if ";" in q or " FROM " not in q:\n        return False\n'
        '    if "PHONE" in q or "ADDRESS" in q:\n        return False\n'
        '    for col in q.replace("SELECT", "").split(" FROM ")[0].split(","):\n        col = col.strip()\n'
        '        if not (col.startswith("COUNT(") or col.startswith("AVG(")):\n            return False\n    return True\n',
    ],
    "G43": [
        "seen = []\nwhile has_try():\n    n = next_try()\n    if len(seen) < 3:\n        seen.append(n)\n        allow()\n    else:\n"
        "        avg = sum(seen) // len(seen)\n        if n > avg * 2:\n            block()\n        else:\n            seen.append(n)\n            allow()\n",
        "seen = []\nwhile has_try():\n    n = next_try()\n    if len(seen) < 3:\n        seen.append(n)\n        allow()\n    else:\n"
        "        avg = sum(seen[-3:]) / 3\n        if n > avg * 2:\n            block()\n        else:\n            seen.append(n)\n            allow()\n",
    ],
    "G44": [
        "def check(attempt):\n    try:\n        parts = attempt.split(\",\")\n        ok = int(parts[0])\n        fail = int(parts[1])\n"
        "    except (ValueError, IndexError):\n        return False\n    total = ok + fail\n    if total == 0:\n        return True\n"
        "    return round(fail / total, 2) <= 0.5\n",
        "def check(attempt):\n    try:\n        parts = attempt.split(\",\")\n        ok = int(parts[0])\n        fail = int(parts[1])\n"
        "    except (ValueError, IndexError):\n        return False\n    total = ok + fail\n    if total == 0:\n        return True\n"
        "    return fail / total <= 0.5\n",
    ],
}


EN_DATA = os.path.join(ROOT, "i18n", "en", "data.json")
FILE_TEXT_KEYS = ("attack", "alias", "real", "todo")


def en_table():
    with open(EN_DATA, encoding="utf-8") as f:
        return json.load(f)


def _text(v):
    return isinstance(v, str) and v.strip() != ""


def check_file(inc, en=None):
    """응용 사건 카드(file)와 tier 검사(설계 §4-1). 문제 목록을 돌려준다(빈 목록이면 통과).
    tier는 없거나 "field". tier가 "field"면 file.attack·alias·real·todo가 비지 않은 글, search가 1~3개의 비지 않은 글,
    영어 열쇠 guard.<id>.file.attack|real|todo와 search.<n>(같은 개수)가 있다. tier가 없으면 file도 없다."""
    en = en_table() if en is None else en
    gid, tier, card = inc.get("id"), inc.get("tier"), inc.get("file")
    bad = []
    if tier not in (None, "field"):
        bad.append("tier가 %r(없거나 \"field\"만)" % (tier,))
    if tier != "field":
        if card is not None:
            bad.append("기본 사건에 file이 있음")
        return bad
    if not isinstance(card, dict):
        return bad + ["응용 사건에 file이 없음"]
    for k in FILE_TEXT_KEYS:
        if not _text(card.get(k)):
            bad.append("file.%s가 비었음" % k)
    search = card.get("search")
    if not (isinstance(search, list) and 1 <= len(search) <= 3 and all(_text(x) for x in search)):
        bad.append("file.search가 1~3개의 글이 아님")
        search = []
    for k in ("attack", "real", "todo"):
        if not _text(en.get("guard.%s.file.%s" % (gid, k))):
            bad.append("영어 guard.%s.file.%s 없음" % (gid, k))
    for n in range(len(search)):
        if not _text(en.get("guard.%s.file.search.%d" % (gid, n))):
            bad.append("영어 guard.%s.file.search.%d 없음" % (gid, n))
    if ("guard.%s.file.search.%d" % (gid, len(search))) in en:
        bad.append("영어 search 열쇠가 한국어 search보다 많음")
    return bad


def chapter_problems(incs):
    """장마다 기본 정확히 3개 + 응용 정확히 1개, 응용은 그 장의 마지막."""
    bad = []
    by_ch = {}
    for i in incs:
        by_ch.setdefault(i["need"], []).append(i)
    if sorted(by_ch) != list(range(3, 18)):
        bad.append("장 %s(3~17장이어야 함)" % sorted(by_ch))
    for ch, lst in sorted(by_ch.items()):
        basic = [i for i in lst if i.get("tier") != "field"]
        field = [i for i in lst if i.get("tier") == "field"]
        if len(basic) != 3:
            bad.append("%d장 기본 %d개" % (ch, len(basic)))
        if len(field) != 1:
            bad.append("%d장 응용 %d개" % (ch, len(field)))
        if field and lst[-1] is not field[0]:
            bad.append("%d장 응용 %s가 장의 마지막이 아님" % (ch, field[0]["id"]))
    return bad


def allowed(need):
    nodes = set(COMMON) | OPS_CTX
    calls = set(ENGINE_CMDS)
    methods = set(METHODS)
    for ch in range(3, need + 1):
        nodes |= NODES_BY_CH.get(ch, set())
        calls |= CALLS_BY_CH.get(ch, set())
        methods |= METHODS_BY_CH.get(ch, set())
    modules, from_names = set(), set()
    for ch in range(3, need + 1):
        modules |= IMPORTS_BY_CH.get(ch, set())
        from_names |= FROM_NAMES_BY_CH.get(ch, set())
    return nodes, calls, methods, modules, from_names


def grammar_problems(code, need):
    nodes, calls, methods, modules, from_names = allowed(need)
    tree = ast.parse(code)
    # 정답이 스스로 정의한 함수·클래스·메서드 이름은 부를 수 있다(4장부터 함수, 15장부터 클래스)
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    bad = []
    for n in ast.walk(tree):
        name = type(n).__name__
        if name not in nodes:
            bad.append("마디 " + name)
        if isinstance(n, ast.Import):
            bad += ["모듈 " + a.name for a in n.names if a.name not in modules]
        if isinstance(n, ast.ImportFrom):
            if n.module != "urllib.parse" or n.module not in modules:
                bad.append("모듈 " + str(n.module))
            bad += ["가져오는 이름 " + a.name for a in n.names if a.name not in from_names]
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                if f.id not in calls and f.id not in defined:
                    bad.append("부르는 이름 " + f.id)
            elif isinstance(f, ast.Attribute):
                if f.attr not in methods and f.attr not in defined:
                    bad.append("메서드 " + f.attr)
            else:
                bad.append("부르는 대상 " + name)
    return bad


GATE = """class Gate:
    def __init__(self, names):
        self.names = names
    def allows(self, x):
        return x in self.names
gate = Gate(["ria"])
ok = gate.allows(attempt)
"""
SUB = """class Base:
    def __init__(self, n):
        self.n = n
class Kid(Base):
    def __init__(self, n):
        super().__init__(n)
k = Kid(1)
"""


def self_test():
    """허용 문법 검사기 자체 시험(사건 시험 전에 돈다)."""
    cases = [
        (13, 'from urllib.parse import urlparse\nok = urlparse(attempt).hostname == "x"\n', True),
        (14, 'from urllib.parse import parse_qs\nq = parse_qs(attempt)\n', True),
        (14, 'import json\nd = json.loads(attempt)\n', True),
        (15, GATE, True),
        (15, SUB, True),
        (14, GATE, False),
        (12, "import os\n", False),
        (14, "import os\n", False),
        (12, "import csv\nimport re\nre.search(\"a\", attempt)\n", True),
        (12, "import json\n", False),
        (7, "class A:\n    pass\n", False),
        (6, "x = [1, 2]\n", False),
        (9, "s = set()\ns.add(attempt)\n", True),
        (8, "s = set()\n", False),
        (9, "ok = type(attempt) == int\n", True),
        (14, "ok = type(attempt) == int\n", True),
        (8, "ok = type(attempt) == int\n", False),
        (13, "from os import path\n", False),
        (13, "from urllib.parse import parse_qs\n", False),
    ]
    bad = 0
    for ch, code, want in cases:
        got = not grammar_problems(code, ch)
        if got != want:
            bad += 1
            print("FAIL 자체 시험 %d장 %r → %s (기대 %s)" % (ch, code[:40], got, want))
    print("%s 허용 문법 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases)))
    # 카드·장 규칙 검사기 자체 시험
    en = {"guard.X.file.attack": "a", "guard.X.file.real": "r", "guard.X.file.todo": "t", "guard.X.file.search.0": "s"}
    card = {"attack": "가", "alias": "a", "real": "나", "todo": "다", "search": ["라"]}
    file_cases = [
        ({"id": "X"}, True),
        ({"id": "X", "tier": "field", "file": card}, True),
        ({"id": "X", "tier": "field"}, False),
        ({"id": "X", "file": card}, False),
        ({"id": "X", "tier": "hard", "file": card}, False),
        ({"id": "X", "tier": "field", "file": dict(card, alias=" ")}, False),
        ({"id": "X", "tier": "field", "file": dict(card, search=[])}, False),
        ({"id": "X", "tier": "field", "file": dict(card, search=["a", "b"])}, False),   # 영어 search.1 없음
        ({"id": "Y", "tier": "field", "file": card}, False),                              # 영어 열쇠 없음
    ]
    for inc, want in file_cases:
        if (not check_file(inc, en)) != want:
            bad += 1
            print("FAIL 자체 시험 check_file %r → %s" % (inc, check_file(inc, en)))

    def chs(spec):
        out = []
        for ch in range(3, 18):
            for k in spec.get(ch, "bbbf"):
                out.append({"id": "%d%s%d" % (ch, k, len(out)), "need": ch, **({"tier": "field"} if k == "f" else {})})
        return out
    ch_cases = [({}, True), ({3: "bbbf", 17: "bbbf"}, True), ({3: "bbfb"}, False), ({4: "bbbff"}, False),
                ({5: "bbf"}, False), ({6: "bbbb"}, False), ({7: "bbb"}, False), ({17: "bbb"}, False)]
    for spec, want in ch_cases:
        if (not chapter_problems(chs(spec))) != want:
            bad += 1
            print("FAIL 자체 시험 chapter_problems %r" % spec)
    if not chapter_problems([i for i in chs({}) if i["need"] != 9]):
        bad += 1
        print("FAIL 자체 시험 chapter_problems 9장 빠짐을 못 잡음")
    print("%s 카드·장 규칙 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(file_cases) + len(ch_cases) + 1))
    return bad


def node_data():
    p = subprocess.run(["node", HELPER], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60)
    if p.returncode != 0:
        print(p.stderr)
        raise SystemExit("도우미 실패")
    return json.loads(p.stdout)


def all_code(inc, verdict):
    if inc["mode"] == "script":
        return verdict + "()\n"
    if inc["mode"] == "loop":
        return "while has_try():\n    next_try()\n    %s()\n" % verdict
    return "def check(attempt):\n    return %s\n" % ("False" if verdict == "block" else "True")


def solved(inc, code, lang):
    tries = [{"value": t.get("value_en", t["value"]) if lang == "en" else t["value"], "expect": t["expect"]}
             for t in inc["tries"]]
    guard = {"mode": inc["mode"], "tries": tries}
    if inc.get("password") is not None:
        guard["password"] = inc["password"]
    if inc.get("files"):
        r = runner.run(code, lang=lang, guard=guard, files=inc["files"])
    else:
        r = runner.run(code, lang=lang, guard=guard)
    g = r.get("guard") or {}
    return bool(g.get("solved")), r.get("error"), g


def main():
    data = node_data()
    incs, filled = data["incidents"], data["filled"]
    fails = self_test()

    def check(ok, label, extra=""):
        nonlocal fails
        if not ok:
            fails += 1
        print("%s %s%s" % ("ok  " if ok else "FAIL", label, (" — " + extra) if extra else ""))

    check([i["id"] for i in incs] == WANT_IDS and [i["need"] for i in incs] == WANT_CHAPTERS, "⑦ 사건 id 순서·장 번호")
    bad = chapter_problems(incs)
    check(not bad, "⑧ 3~17장 모두 있고 장마다 기본 정확히 3개 + 응용 정확히 1개(응용은 장의 마지막)", ", ".join(bad))
    ids = [i["id"] for i in incs]
    basic_ids = [i["id"] for i in incs if i.get("tier") != "field"]
    field_ids = [i["id"] for i in incs if i.get("tier") == "field"]
    check(sorted(basic_ids, key=lambda x: int(x[1:])) == BASIC_IDS and len(set(ids)) == len(ids),
          "⑨ 기본 id가 G1~G45 모두 한 번씩, id 겹침 없음")
    check(field_ids == FIELD_IDS, "⑨ 응용 id = FIELD_IDS", str(field_ids))
    en = en_table()
    for inc in incs:
        bad = check_file(inc, en)
        check(not bad, "⑪ %s tier·사건 파일 카드" % inc["id"], ", ".join(bad))
        if inc.get("tier") == "field":
            check(len(WRONG_SOLUTIONS.get(inc["id"], [])) >= 1, "⑩ %s 응용 사건에 어설픈 풀이 1개 이상" % inc["id"])
    check(data["xp"] == 5, "GUARD_XP = 5")
    for inc in incs:
        n = len(inc["tries"])
        exp = {t["expect"] for t in inc["tries"]}
        check(1 <= n <= 20 and exp == {"block", "allow"}, "⑥ %s 시도 %d개, block·allow 모두 있음" % (inc["id"], n))
        bad = grammar_problems(inc["solution"], inc["need"])
        check(not bad, "⑤ %s 정답이 %d장 문법 안" % (inc["id"], inc["need"]), ", ".join(bad))
        for key in ("title", "brief", "ria", "concept", "crowIntro", "crowLose"):
            check(bool(inc.get(key)), "   %s.%s 글 있음" % (inc["id"], key)) if not inc.get(key) else None
        check(all(t.get("why") for t in inc["tries"]), "   %s 시도마다 why" % inc["id"])
        if inc["id"] in ("G5", "G12"):
            check(all(t.get("value_en") and t["value_en"] != t["value"] for t in inc["tries"]), "   %s value_en" % inc["id"])

    for lang in ("ko", "en"):
        print("== %s" % ("한국어" if lang == "ko" else "English (value_en ?? value, runner lang=en)"))
        for inc in incs:
            f = filled[inc["id"]]
            ok, err, _ = solved(inc, inc["solution"], lang)
            check(ok, "① %s solution → 해결" % inc["id"], str(err) if err else "")
            check(f["answer"]["code"] == inc["solution"], "② %s 정답 채우기 = solution 코드" % inc["id"])
            ok, err, _ = solved(inc, f["answer"]["code"], lang)
            check(ok, "② %s 빈칸 정답으로 채움 → 해결" % inc["id"], str(err) if err else "")
            for w in f["wrong"]:
                ok, err, _ = solved(inc, w["code"], lang)
                check(not ok, "③ %s 칸%d 오답 %r → 실패" % (inc["id"], w["blank"], w["option"]),
                      "해결됨(보기 바꿔야 함)" if ok else "")
            for k, code in enumerate(WRONG_SOLUTIONS.get(inc["id"], [])):
                ok, _, _ = solved(inc, code, lang)
                check(not ok, "⑩ %s 틀린 풀이 %d → 해결 못 함" % (inc["id"], k + 1), "해결됨(시도 보강 필요)" if ok else "")
            for verdict, name in (("block", "전부 막기"), ("allow", "전부 들이기")):
                ok, _, _ = solved(inc, all_code(inc, verdict), lang)
                check(not ok, "④ %s %s → 실패" % (inc["id"], name))
        by_id = {i["id"]: i for i in incs}
        for a, b in OVERLAP_PAIRS:
            fa, bb = by_id.get(a), by_id.get(b)
            if not fa or not bb or fa["mode"] != bb["mode"]:
                check(False, "⑫ 겹침 %s↔%s 두 사건이 있고 방식이 같음" % (a, b))
                continue
            ok, err, _ = solved(bb, fa["solution"], lang)
            check(not ok and err is None, "⑫ 겹침 %s 정답을 %s 시도로 → 오류 없이 판정이 틀려 해결 못 함(다른 판정 규칙)" % (a, b),
                  "같은 규칙" if ok else ("오류로 멈춤: %s" % err if err else ""))
    print("실패 %d" % fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
