"""프로젝트 공방 데이터 검사 (v0.21.0, 설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-1·§4-2·§5·§7).

프로젝트마다(한국어 data/projects.js·영어 data/projects.en.js 각각):
  ① id·열리는 장이 WANT와 같은 순서, 한·영 같은 id·장·단계 수(3~5), 단계마다 같은 시험 수·rand 길이·require
  ② 칸 모양: 글 칸은 비지 않은 글, icon은 앱 아이콘 묶음(src/ui/dom.js) 안, play.prompt, starter는 첫 단계만,
     tool은 { title, body, code }, 시험은 { stdin, expect, public, rand?, files? }이고 public이 하나 이상
  ③ 각 단계 solution이 그 단계 시험을 모두 통과(src/py/runner.py run(rand=…)을 CPython에서 바로 부름)
  ④ solution[i]이 step[i+1]의 시작이 됨: 다음 단계 공개 시험 하나를 오류 없이 돎
  ⑤ 그 장까지 배운 문법만(경비실 tests/guard_incidents.py의 표) + 레슨 1~2장 기본(print·input·int·float·str, f-문자열)
     + 「새 도구」 예외: import random, random.randint, random.choice (프로젝트에서만)
     + 레슨에서 배웠지만 경비실 표에 없는 것: list(7-4), f.write(11-3), json.load(14-A2)
  ⑥ 무작위를 쓰는 단계는 시험마다 rand가 있고, randint를 쓰는 단계의 rand 값은 모두 정수(bool 아님)
  ⑦ random을 처음 쓰는 단계에 새 도구 카드(tool)가 있음
     + 심화 레슨에서만 배운 json.load(14-A2)를 처음 쓰는 단계에도 새 도구 카드(작업 5)
  ⑧ WRONG(흔한 오답)이 단계마다 한·영 1개 이상, 각각 그 단계 시험에서 하나 이상 실패
  ⑨ 영어 파일에 한글 없음, 한국어 단계 글에는 한글이 있음
  ⑪ 정답·시작 코드·도구 카드 코드의 한 줄이 휴대폰 편집기 폭(CODE_COLS칸, 한글 2칸) 안
  ⑩ 보상 상수 PROJECT_STEP_XP = 5, PROJECT_DONE_XP = 20

실행: python3 tests/projects.py   (하나라도 실패하면 종료 코드 1)
"""

import ast
import json
import os
import re
import subprocess
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tests"))
sys.path.insert(0, os.path.join(ROOT, "src", "py"))

import guard_incidents as gi  # noqa: E402  (장별 문법 표를 함께 씀)
import runner  # noqa: E402

HELPER = os.path.join(ROOT, "tests", "projects_helper.mjs")
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")

# 프로젝트 id와 열리는 장(원본 순서). 작업 4·5가 늘린다.
WANT = [("P1", 3), ("P2", 5), ("P3", 8), ("P4", 11), ("P5", 14)]

# 레슨 1~2장에서 배워 3장 이후 어디서나 쓸 수 있는 것(경비실 표에는 없는 입출력)
BASE_CALLS = {"print", "input", "int", "float", "str"}
BASE_NODES = {"JoinedStr", "FormattedValue"}
# 레슨에서 가르치지만 경비실 표에 없는 부르는 이름(장 → 이름). list(a)는 7-4 「정렬과 복사」에서 배움
# (P3의 random.choice(list(words)) — 작업 4). 경비실 표는 그대로.
LESSON_CALLS_BY_CH = {7: {"list"}}
# 레슨에서 가르치지만 경비실 표에 없는 메서드(장 → 이름, 작업 5).
#  - write: 11-3 「파일에 쓰기」(본 레슨, f.write) — P4가 todo.txt에 씀
#  - load: 14-A2 「JSON 만들어 저장」(심화 레슨, json.load(f)) — P5가 weather.json을 읽음. 심화는 건너뛸 수 있으니
#    json.load를 처음 쓰는 단계에 새 도구 카드(tool)를 둔다(⑦, 아래 TOOL_INTRO_METHODS)
LESSON_METHODS_BY_CH = {11: {"write"}, 14: {"load"}}
# 심화 레슨에서만 배워 「새 도구 카드」로 다시 소개해야 하는 메서드(⑦)
TOOL_INTRO_METHODS = {"load"}
# 새 도구 카드로 소개하는 것(프로젝트 검사에서만, 경비실 표는 그대로)
TOOL_MODULES = {"random"}
TOOL_FUNCS = {"randint", "choice"}

# 한 줄 폭(한글 등 넓은 글자 2칸). 레슨 카드(읽기 전용)는 38칸(tests/content.py)이지만, 프로젝트 코드는 줄을 접는
# 편집기(src/ui/editor.js lineWrapping)에 보이고 영어 손 이름("scissors")이 길어 44칸까지 둔다.
CODE_COLS = 44
# 완성작 한 판의 입력 상한(src/projects/console.js maxInputs)
PLAY_MAX_INPUTS = 50

TEXT_KEYS = ("title", "blurb", "intro", "finale")
STEP_TEXT_KEYS = ("goal", "task")

# P1 오답을 만들 때 쓰는 앞부분(2단계 정답까지 = HEAD, 3단계의 비김·이김 갈래까지 = JUDGE)
P1_KO_HEAD = ('import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
              'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n')
P1_KO_JUDGE = (P1_KO_HEAD + 'if me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\n'
               'elif me == "바위" and com == "가위":\n    result = "이겼어요"\nelif me == "보" and com == "바위":\n    result = "이겼어요"\n')
P1_EN_HEAD = ('import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
              'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n')
P1_EN_JUDGE = (P1_EN_HEAD + 'if me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\n'
               'elif me == "paper" and com == "rock":\n    result = "You win"\nelif me == "scissors" and com == "paper":\n    result = "You win"\n')

# ⑧ 흔한 오답: (프로젝트, 단계 번호) → { "ko": [코드…], "en": [코드…] }
WRONG = {
    ("P1", 0): {
        "ko": ['me = input()\nprint(me)\n',
               'me = input()\nprint("나:" + me)\n'],
        "en": ['me = input()\nprint(me)\n',
               'me = input()\nprint("Me:" + me)\n'],
    },
    ("P1", 1): {
        # 무작위를 두 번 부름(한 번만이어야 함), 숫자와 손이 어긋남, 범위를 1~2로 씀(보가 안 나옴, 검토 I1),
        # num은 부르기만 하고 내 손을 이기는 손을 고름(검토 M1)
        "ko": ['import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 2)\n'
               'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if me == "가위":\n    com = "바위"\nelif me == "바위":\n    com = "보"\nelse:\n    com = "가위"\nprint("컴퓨터:", com)\n',
               'import random\n\nme = input()\nprint("나:", me)\n'
               'if random.randint(1, 3) == 1:\n    com = "가위"\nelif random.randint(1, 3) == 2:\n    com = "바위"\n'
               'else:\n    com = "보"\nprint("컴퓨터:", com)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "바위"\nelif num == 2:\n    com = "가위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'],
        "en": ['import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 2)\n'
               'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if me == "rock":\n    com = "paper"\nelif me == "paper":\n    com = "scissors"\nelse:\n    com = "rock"\nprint("Computer:", com)\n',
               'import random\n\nme = input()\nprint("Me:", me)\n'
               'if random.randint(1, 3) == 1:\n    com = "rock"\nelif random.randint(1, 3) == 2:\n    com = "paper"\n'
               'else:\n    com = "scissors"\nprint("Computer:", com)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "paper"\nelif num == 2:\n    com = "rock"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'],
    },
    ("P1", 2): {
        # 이기는 경우를 하나만 봄, 비김을 빠뜨림, 비김을 바위끼리만 봄(검토 M2)
        "ko": [P1_KO_HEAD + 'if me == "바위" and com == "바위":\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n'
               '    result = "이겼어요"\nelif me == "바위" and com == "가위":\n    result = "이겼어요"\n'
               'elif me == "보" and com == "바위":\n    result = "이겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'
               'if me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\n'
               'else:\n    result = "졌어요"\nprint("결과:", result)\n',
               'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n'
               'if me == "가위" and com == "보" or me == "바위" and com == "가위" or me == "보" and com == "바위":\n'
               '    result = "이겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n'],
        "en": [P1_EN_HEAD + 'if me == "paper" and com == "paper":\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n'
               '    result = "You win"\nelif me == "paper" and com == "rock":\n    result = "You win"\n'
               'elif me == "scissors" and com == "paper":\n    result = "You win"\nelse:\n    result = "You lose"\nprint("Result:", result)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'
               'if me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\n'
               'else:\n    result = "You lose"\nprint("Result:", result)\n',
               'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\n'
               'if num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n'
               'if me == "rock" and com == "scissors" or me == "paper" and com == "rock" or me == "scissors" and com == "paper":\n'
               '    result = "You win"\nelse:\n    result = "You lose"\nprint("Result:", result)\n'],
    },
    ("P1", 3): {
        # 앞 단계 그대로(else가 「졌어요」), 지는 짝을 잘못 적음(가위-보는 이미 이긴 경우라 가위-바위가 빠짐),
        # 「아니면」을 != 와 or로 묶어 늘 참
        "ko": [P1_KO_JUDGE + 'else:\n    result = "졌어요"\nprint("결과:", result)\n',
               P1_KO_JUDGE + 'elif me == "가위" and com == "보":\n    result = "졌어요"\nelif me == "바위" and com == "보":\n'
               '    result = "졌어요"\nelif me == "보" and com == "가위":\n    result = "졌어요"\n'
               'else:\n    result = "가위·바위·보만 돼요"\nprint("결과:", result)\n',
               P1_KO_HEAD + 'if me != "가위" or me != "바위" or me != "보":\n    result = "가위·바위·보만 돼요"\n'
               'elif me == com:\n    result = "비겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n'],
        "en": [P1_EN_JUDGE + 'else:\n    result = "You lose"\nprint("Result:", result)\n',
               P1_EN_JUDGE + 'elif me == "rock" and com == "scissors":\n    result = "You lose"\nelif me == "paper" and com == "scissors":\n'
               '    result = "You lose"\nelif me == "scissors" and com == "rock":\n    result = "You lose"\n'
               'else:\n    result = "Only rock, paper or scissors"\nprint("Result:", result)\n',
               P1_EN_HEAD + 'if me != "rock" or me != "paper" or me != "scissors":\n    result = "Only rock, paper or scissors"\n'
               'elif me == com:\n    result = "It\'s a tie"\nelse:\n    result = "You lose"\nprint("Result:", result)\n'],
    },
}

# P2·P3 오답을 만들 때 쓰는 조각(작업 4)
P2_KO_PICK = 'import random\n\nanswer = random.randint(1, 50)\nprint("1부터 50 사이 수를 하나 정했어요")\n'
P2_EN_PICK = 'import random\n\nanswer = random.randint(1, 50)\nprint("I picked a number from 1 to 50")\n'
P2_KO_JUDGE = ('    if guess == answer:\n        print("정답이에요!")\n        break\n'
               '    elif guess > answer:\n        print("너무 커요")\n    else:\n        print("너무 작아요")\n')
P2_EN_JUDGE = ('    if guess == answer:\n        print("Correct!")\n        break\n'
               '    elif guess > answer:\n        print("Too high")\n    else:\n        print("Too low")\n')
P3_KO_HEAD = ('import random\n\nwords = {\n    "apple": "사과",\n    "cat": "고양이",\n    "book": "책",\n}\n'
              'print(f"단어 {len(words)}개로 퀴즈를 내요")\n')
P3_EN_HEAD = ('import random\n\nwords = {\n    "manzana": "apple",\n    "gato": "cat",\n    "libro": "book",\n}\n'
              'print(f"{len(words)} words in this quiz")\n')
P3_KO_ASK = ('    word = random.choice(pool)\n    print(f"{word} 뜻은?")\n    answer = input()\n'
             '    meaning = words[word]\n')
P3_EN_ASK = ('    word = random.choice(pool)\n    print(f"What does {word} mean?")\n    answer = input()\n'
             '    meaning = words[word]\n')
# 4단계부터: 고른 단어를 pool에서 뺌(검토 I2 — 한 판에 같은 단어가 두 번 안 나옴)
P3_KO_ASK_R = P3_KO_ASK.replace("(pool)\n", "(pool)\n    pool.remove(word)\n", 1)
P3_EN_ASK_R = P3_EN_ASK.replace("(pool)\n", "(pool)\n    pool.remove(word)\n", 1)
P3_KO_CHECK = '    if answer == meaning:\n        print("맞았어요!")\n'
P3_EN_CHECK = '    if answer == meaning:\n        print("Correct!")\n'
P3_KO_ELSE = '    else:\n        print(f"틀렸어요. 정답은 {meaning}")\n'
P3_EN_ELSE = '    else:\n        print(f"Wrong. It means {meaning}")\n'
P3_POOL = 'pool = list(words)\n'
P3_LOOP = 'while len(pool) > 0:\n'
P3_KO_SCORE = 'print(f"점수: {score}/{len(words)}")\n'
P3_EN_SCORE = 'print(f"Score: {score}/{len(words)}")\n'

def _dedent(code):
    return "\n".join(line[4:] if line.startswith("    ") else line for line in code.split("\n"))


WRONG_P23 = {
    # P2 1단계: 범위를 잘못 씀(좁게 1~10·0~49, 넓게 1~100·0~50 — 검토 I1), randint 없이 답을 정해 둠
    ("P2", 0): {
        "ko": [P2_KO_PICK.replace("(1, 50)", "(1, 10)"), P2_KO_PICK.replace("(1, 50)", "(0, 49)"),
               P2_KO_PICK.replace("(1, 50)", "(1, 100)"), P2_KO_PICK.replace("(1, 50)", "(0, 50)"),
               'import random\n\nanswer = 25\nprint("1부터 50 사이 수를 하나 정했어요")\n'],
        "en": [P2_EN_PICK.replace("(1, 50)", "(1, 10)"), P2_EN_PICK.replace("(1, 50)", "(0, 49)"),
               P2_EN_PICK.replace("(1, 50)", "(1, 100)"), P2_EN_PICK.replace("(1, 50)", "(0, 50)"),
               'import random\n\nanswer = 25\nprint("I picked a number from 1 to 50")\n'],
    },
    # P2 2단계: int 없이 글자와 수를 비교(늘 「아니에요」), 답 대신 고정된 수와 비교, 비교 없이 늘 정답
    ("P2", 1): {
        "ko": [P2_KO_PICK + 'guess = input()\nif guess == answer:\n    print("정답이에요!")\nelse:\n    print("아니에요")\n',
               P2_KO_PICK + 'guess = int(input())\nif guess == 37:\n    print("정답이에요!")\nelse:\n    print("아니에요")\n',
               P2_KO_PICK + 'guess = int(input())\nprint("정답이에요!")\n'],
        "en": [P2_EN_PICK + 'guess = input()\nif guess == answer:\n    print("Correct!")\nelse:\n    print("Nope")\n',
               P2_EN_PICK + 'guess = int(input())\nif guess == 37:\n    print("Correct!")\nelse:\n    print("Nope")\n',
               P2_EN_PICK + 'guess = int(input())\nprint("Correct!")\n'],
    },
    # P2 3단계: 크다·작다를 거꾸로, 정답 갈래를 빠뜨림(같으면 「너무 작아요」)
    ("P2", 2): {
        "ko": [P2_KO_PICK + 'guess = int(input())\nif guess == answer:\n    print("정답이에요!")\n'
               'elif guess > answer:\n    print("너무 작아요")\nelse:\n    print("너무 커요")\n',
               P2_KO_PICK + 'guess = int(input())\nif guess > answer:\n    print("너무 커요")\nelse:\n    print("너무 작아요")\n'],
        "en": [P2_EN_PICK + 'guess = int(input())\nif guess == answer:\n    print("Correct!")\n'
               'elif guess > answer:\n    print("Too low")\nelse:\n    print("Too high")\n',
               P2_EN_PICK + 'guess = int(input())\nif guess > answer:\n    print("Too high")\nelse:\n    print("Too low")\n'],
    },
    # P2 4단계: break가 없어 정답 뒤에도 계속 물음(입력이 모자람), input이 반복 밖이라 같은 수만 봄(끝없이 출력),
    # 정답 때 break만 하고 「정답이에요!」를 안 씀
    ("P2", 3): {
        "ko": [P2_KO_PICK + 'while True:\n    guess = int(input())\n' + P2_KO_JUDGE.replace("        break\n", ""),
               P2_KO_PICK + 'guess = int(input())\nwhile True:\n' + P2_KO_JUDGE,
               P2_KO_PICK + 'while True:\n    guess = int(input())\n'
               + P2_KO_JUDGE.replace('        print("정답이에요!")\n', "")],
        "en": [P2_EN_PICK + 'while True:\n    guess = int(input())\n' + P2_EN_JUDGE.replace("        break\n", ""),
               P2_EN_PICK + 'guess = int(input())\nwhile True:\n' + P2_EN_JUDGE,
               P2_EN_PICK + 'while True:\n    guess = int(input())\n'
               + P2_EN_JUDGE.replace('        print("Correct!")\n', "")],
    },
    # P2 5단계: 틀린 때만 셈, 반복 안에서 0으로 되돌림(늘 1번), 1부터 셈
    ("P2", 4): {
        "ko": [P2_KO_PICK + 'tries = 0\nwhile True:\n    guess = int(input())\n    if guess == answer:\n'
               '        print("정답이에요!")\n        print(f"{tries}번 만에 맞혔어요")\n        break\n'
               '    tries += 1\n    if guess > answer:\n        print("너무 커요")\n    else:\n        print("너무 작아요")\n',
               P2_KO_PICK + 'while True:\n    tries = 0\n    guess = int(input())\n    tries += 1\n'
               + P2_KO_JUDGE.replace("        break\n", '        print(f"{tries}번 만에 맞혔어요")\n        break\n'),
               P2_KO_PICK + 'tries = 1\nwhile True:\n    guess = int(input())\n    tries += 1\n'
               + P2_KO_JUDGE.replace("        break\n", '        print(f"{tries}번 만에 맞혔어요")\n        break\n')],
        "en": [P2_EN_PICK + 'tries = 0\nwhile True:\n    guess = int(input())\n    if guess == answer:\n'
               '        print("Correct!")\n        print(f"Guesses: {tries}")\n        break\n'
               '    tries += 1\n    if guess > answer:\n        print("Too high")\n    else:\n        print("Too low")\n',
               P2_EN_PICK + 'while True:\n    tries = 0\n    guess = int(input())\n    tries += 1\n'
               + P2_EN_JUDGE.replace("        break\n", '        print(f"Guesses: {tries}")\n        break\n'),
               P2_EN_PICK + 'tries = 1\nwhile True:\n    guess = int(input())\n    tries += 1\n'
               + P2_EN_JUDGE.replace("        break\n", '        print(f"Guesses: {tries}")\n        break\n')],
    },
    # P3 1단계: 두 쌍을 안 더함, 개수를 len 없이 적음(require), 사전 대신 개수만 출력
    ("P3", 0): {
        "ko": ['words = {\n    "apple": "사과",\n}\nprint(f"단어 {len(words)}개로 퀴즈를 내요")\n',
               'words = {\n    "apple": "사과",\n    "cat": "고양이",\n    "book": "책",\n}\nprint("단어 3개로 퀴즈를 내요")\n',
               'words = {\n    "apple": "사과",\n    "cat": "고양이",\n    "book": "책",\n}\nprint(len(words))\n'],
        "en": ['words = {\n    "manzana": "apple",\n}\nprint(f"{len(words)} words in this quiz")\n',
               'words = {\n    "manzana": "apple",\n    "gato": "cat",\n    "libro": "book",\n}\nprint("3 words in this quiz")\n',
               'words = {\n    "manzana": "apple",\n    "gato": "cat",\n    "libro": "book",\n}\nprint(len(words))\n'],
    },
    # P3 2단계: 사전을 그대로 choice에(진짜 실행에선 KeyError), 뜻 목록에서 고름, keys()를 그대로(TypeError)
    ("P3", 1): {
        "ko": [P3_KO_HEAD + P3_POOL + 'word = random.choice(words)\nprint(f"{word} 뜻은?")\n',
               P3_KO_HEAD + 'pool = list(words.values())\nword = random.choice(pool)\nprint(f"{word} 뜻은?")\n',
               P3_KO_HEAD + 'pool = words.keys()\nword = random.choice(pool)\nprint(f"{word} 뜻은?")\n'],
        "en": [P3_EN_HEAD + P3_POOL + 'word = random.choice(words)\nprint(f"What does {word} mean?")\n',
               P3_EN_HEAD + 'pool = list(words.values())\nword = random.choice(pool)\nprint(f"What does {word} mean?")\n',
               P3_EN_HEAD + 'pool = words.keys()\nword = random.choice(pool)\nprint(f"What does {word} mean?")\n'],
    },
    # P3 3단계: 답을 단어(키)와 비교, 답이 사전에 있는지만 봄, 틀릴 때 정답을 안 알려 줌
    ("P3", 2): {
        "ko": [P3_KO_HEAD + P3_POOL + _dedent(P3_KO_ASK + '    if answer == word:\n        print("맞았어요!")\n' + P3_KO_ELSE),
               P3_KO_HEAD + P3_POOL + _dedent(P3_KO_ASK + '    if answer in words:\n        print("맞았어요!")\n' + P3_KO_ELSE),
               P3_KO_HEAD + P3_POOL + _dedent(P3_KO_ASK + P3_KO_CHECK + '    else:\n        print("틀렸어요")\n')],
        "en": [P3_EN_HEAD + P3_POOL + _dedent(P3_EN_ASK + '    if answer == word:\n        print("Correct!")\n' + P3_EN_ELSE),
               P3_EN_HEAD + P3_POOL + _dedent(P3_EN_ASK + '    if answer in words:\n        print("Correct!")\n' + P3_EN_ELSE),
               P3_EN_HEAD + P3_POOL + _dedent(P3_EN_ASK + P3_EN_CHECK + '    else:\n        print("Wrong")\n')],
    },
    # P3 4단계(검토 I2): remove를 빠뜨림(끝나지 않고 같은 단어도 또 나옴), pool을 반복 안에서 다시 만듦(늘 3개라
    # 끝나지 않음), 하나 남기고 멈춤(> 1), 답을 반복 밖에서 한 번만 받음, 앞 단계처럼 for range(3)에 remove 없음
    ("P3", 3): {
        "ko": [P3_KO_HEAD + P3_POOL + P3_LOOP + P3_KO_ASK + P3_KO_CHECK + P3_KO_ELSE,
               P3_KO_HEAD + P3_LOOP.replace("len(pool)", "len(words)") + '    pool = list(words)\n' + P3_KO_ASK_R
               + P3_KO_CHECK + P3_KO_ELSE,
               P3_KO_HEAD + P3_POOL + P3_LOOP.replace("> 0", "> 1") + P3_KO_ASK_R + P3_KO_CHECK + P3_KO_ELSE,
               P3_KO_HEAD + P3_POOL + 'answer = input()\n' + P3_LOOP + P3_KO_ASK_R.replace("    answer = input()\n", "")
               + P3_KO_CHECK + P3_KO_ELSE,
               P3_KO_HEAD + P3_POOL + 'for i in range(3):\n' + P3_KO_ASK + P3_KO_CHECK + P3_KO_ELSE],
        "en": [P3_EN_HEAD + P3_POOL + P3_LOOP + P3_EN_ASK + P3_EN_CHECK + P3_EN_ELSE,
               P3_EN_HEAD + P3_LOOP.replace("len(pool)", "len(words)") + '    pool = list(words)\n' + P3_EN_ASK_R
               + P3_EN_CHECK + P3_EN_ELSE,
               P3_EN_HEAD + P3_POOL + P3_LOOP.replace("> 0", "> 1") + P3_EN_ASK_R + P3_EN_CHECK + P3_EN_ELSE,
               P3_EN_HEAD + P3_POOL + 'answer = input()\n' + P3_LOOP + P3_EN_ASK_R.replace("    answer = input()\n", "")
               + P3_EN_CHECK + P3_EN_ELSE,
               P3_EN_HEAD + P3_POOL + 'for i in range(3):\n' + P3_EN_ASK + P3_EN_CHECK + P3_EN_ELSE],
    },
    # P3 5단계: 맞든 틀리든 셈, 반복 안에서 0으로 되돌림, 점수를 문제마다 출력
    ("P3", 4): {
        "ko": [P3_KO_HEAD + P3_POOL + 'score = 0\n' + P3_LOOP + P3_KO_ASK_R + '    score += 1\n' + P3_KO_CHECK
               + P3_KO_ELSE + P3_KO_SCORE,
               P3_KO_HEAD + P3_POOL + P3_LOOP + '    score = 0\n' + P3_KO_ASK_R + P3_KO_CHECK + '        score += 1\n'
               + P3_KO_ELSE + P3_KO_SCORE,
               P3_KO_HEAD + P3_POOL + 'score = 0\n' + P3_LOOP + P3_KO_ASK_R + P3_KO_CHECK + '        score += 1\n'
               + P3_KO_ELSE + '    ' + P3_KO_SCORE],
        "en": [P3_EN_HEAD + P3_POOL + 'score = 0\n' + P3_LOOP + P3_EN_ASK_R + '    score += 1\n' + P3_EN_CHECK
               + P3_EN_ELSE + P3_EN_SCORE,
               P3_EN_HEAD + P3_POOL + P3_LOOP + '    score = 0\n' + P3_EN_ASK_R + P3_EN_CHECK + '        score += 1\n'
               + P3_EN_ELSE + P3_EN_SCORE,
               P3_EN_HEAD + P3_POOL + 'score = 0\n' + P3_LOOP + P3_EN_ASK_R + P3_EN_CHECK + '        score += 1\n'
               + P3_EN_ELSE + '    ' + P3_EN_SCORE],
    },
}
WRONG.update(WRONG_P23)

# 범위를 넓게 쓴 오답(검토 I1): 단계 정답의 randint(1, 50)을 바꾼 것. 마지막 단계와 P1 2단계에 직접 둔다.
def _widen(code, old, new):
    assert old in code
    return code.replace(old, new)


P2_KO_LAST = (P2_KO_PICK + 'tries = 0\nwhile True:\n    guess = int(input())\n    tries += 1\n'
              + P2_KO_JUDGE.replace("        break\n", '        print(f"{tries}번 만에 맞혔어요")\n        break\n'))
P2_EN_LAST = (P2_EN_PICK + 'tries = 0\nwhile True:\n    guess = int(input())\n    tries += 1\n'
              + P2_EN_JUDGE.replace("        break\n", '        print(f"Guesses: {tries}")\n        break\n'))
for _lang, _code in (("ko", P2_KO_LAST), ("en", P2_EN_LAST)):
    WRONG[("P2", 4)][_lang] += [_widen(_code, "(1, 50)", "(1, 100)"), _widen(_code, "(1, 50)", "(0, 50)")]
WRONG[("P1", 1)]["ko"].append(_widen(P1_KO_HEAD, "(1, 3)", "(1, 4)"))
WRONG[("P1", 1)]["en"].append(_widen(P1_EN_HEAD, "(1, 3)", "(1, 4)"))


# ---------------------------------------------------------------- P4·P5 오답(작업 5)
# 각 단계 정답을 조각으로 다시 만들고(데이터의 정답과 같은 코드), 오답은 그 정답을 한 군데 바꿔 만든다.
P4_TXT = {
    "ko": {"menu": "1 추가 · 2 보기 · 3 끝", "bye": "안녕히 가세요", "added": "추가했어요: ",
           "none": "아직 할 일이 없어요", "loaded": "할 일 {n}개를 불러왔어요", "new": "새 목록을 시작해요"},
    "en": {"menu": "1 Add · 2 View · 3 Quit", "bye": "Bye!", "added": "Added: ",
           "none": "No tasks yet", "loaded": "Tasks loaded: {n}", "new": "Starting a new list"},
}


def p4(lang, step):
    """P4 k단계(0부터) 정답"""
    t = P4_TXT[lang]
    quit_ = '    if menu == "3":\n        print("%s")\n        break\n' % t["bye"]
    add = ('    elif menu == "1":\n        item = input()\n        with open("todo.txt", "a") as f:\n'
           '            f.write(item + "\\n")\n        print(f"%s{item}")\n' % t["added"])
    view = ('    elif menu == "2":\n        with open("todo.txt") as f:\n            for line in f:\n'
            '                print("-", line.strip())\n')
    view_try = ('    elif menu == "2":\n        try:\n            with open("todo.txt") as f:\n'
                '                for line in f:\n                    print("-", line.strip())\n'
                '        except FileNotFoundError:\n            print("%s")\n' % t["none"])
    load = ('n = 0\ntry:\n    with open("todo.txt") as f:\n        for line in f:\n            n += 1\n'
            '    print(f"%s")\nexcept FileNotFoundError:\n    print("%s")\n' % (t["loaded"], t["new"]))
    loop = 'while True:\n    print("%s")\n    menu = input()\n' % t["menu"]
    if step == 0:
        return loop + quit_
    if step == 1:
        return loop + quit_ + add
    if step == 2:
        return loop + quit_ + add + view
    if step == 3:
        return loop + quit_ + add + view_try
    return load + loop + quit_ + add + view_try


def _swap(code, old, new):
    assert old in code, (old, code)
    return code.replace(old, new, 1)


def p4_wrong(lang):
    t = P4_TXT[lang]
    s = [p4(lang, k) for k in range(5)]
    return {
        # 1단계: break 없음(끝나지 않아 입력이 모자람), input이 반복 밖(끝없이 메뉴 출력), 글자 "3" 대신 수 3과 비교,
        #        메뉴를 반복 밖에서 한 번만 출력, 고른 것과 상관없이 바로 break
        ("P4", 0): [_swap(s[0], "        break\n", ""),
                    _swap(_swap(s[0], "    menu = input()\n", ""), "while True:\n", "menu = input()\nwhile True:\n"),
                    _swap(s[0], 'menu == "3"', "menu == 3"),
                    _swap(_swap(s[0], '    print("%s")\n' % t["menu"], ""), "while True:\n",
                          'print("%s")\nwhile True:\n' % t["menu"]),
                    _swap(s[0], '    if menu == "3":\n        print("%s")\n        break\n' % t["bye"],
                          '    print("%s")\n    break\n' % t["bye"])],
        # 2단계: 확인 글에 item 대신 menu, 할 일을 메뉴와 함께 반복 맨 위에서 받음, write를 빠뜨림(require)
        ("P4", 1): [_swap(s[1], '{item}")', '{menu}")'),
                    _swap(_swap(s[1], "        item = input()\n", ""), "    menu = input()\n",
                          "    menu = input()\n    item = input()\n"),
                    _swap(s[1], '            f.write(item + "\\n")\n', '            print(item)\n')],
        # 3단계: 추가를 "w"로 열어 앞 할 일이 지워짐, strip 없이 출력(빈 줄), 줄바꿈 없이 써서 할 일이 붙음,
        #        read()를 그대로 출력(「- 」 없음), 파일 대신 방금 받은 item만 보여 줌
        ("P4", 2): [_swap(s[2], '"todo.txt", "a"', '"todo.txt", "w"'),
                    _swap(s[2], 'print("-", line.strip())', 'print("-", line)'),
                    _swap(s[2], 'f.write(item + "\\n")', "f.write(item)"),
                    _swap(s[2], '            for line in f:\n                print("-", line.strip())\n',
                          '            print(f.read())\n'),
                    _swap(s[2], '        with open("todo.txt") as f:\n            for line in f:\n'
                          '                print("-", line.strip())\n', '        print("-", item)\n')],
        # 4단계: try가 반복 전체를 감쌈(안내 뒤 프로그램이 끝남), 다른 오류를 잡음, try가 open을 안 감쌈
        ("P4", 3): [p4_try_outside(lang),
                    _swap(s[3], "except FileNotFoundError", "except ValueError"),
                    _swap(s[3], '        try:\n            with open("todo.txt") as f:\n'
                          '                for line in f:\n                    print("-", line.strip())\n'
                          '        except FileNotFoundError:\n            print("%s")\n' % t["none"],
                          '        with open("todo.txt") as f:\n            try:\n'
                          '                for line in f:\n                    print("-", line.strip())\n'
                          '            except FileNotFoundError:\n                print("%s")\n' % t["none"])],
        # 5단계: try 없이 엶(파일이 없으면 오류), n = 0을 반복 안에 둠(늘 1개), 글자 수를 셈,
        #        개수 출력을 try 밖에 둠(파일이 없을 때 두 줄), 줄마다 개수를 출력
        ("P4", 4): [s[4].replace('try:\n    with open("todo.txt") as f:\n        for line in f:\n            n += 1\n'
                                 '    print(f"%s")\nexcept FileNotFoundError:\n    print("%s")\n'
                                 % (t["loaded"], t["new"]),
                                 'with open("todo.txt") as f:\n    for line in f:\n        n += 1\n'
                                 'print(f"%s")\n' % t["loaded"], 1),
                    _swap(s[4], "        for line in f:\n            n += 1\n",
                          "        for line in f:\n            n = 0\n            n += 1\n"),
                    _swap(s[4], "        for line in f:\n            n += 1\n", "        n = len(f.read())\n"),
                    _swap(_swap(s[4], '    print(f"%s")\n' % t["loaded"], ""), 'except FileNotFoundError:\n    print("%s")\n'
                          % t["new"], 'except FileNotFoundError:\n    print("%s")\nprint(f"%s")\n' % (t["new"], t["loaded"])),
                    _swap(_swap(s[4], '    print(f"%s")\n' % t["loaded"], ""), "            n += 1\n",
                          '            n += 1\n            print(f"%s")\n' % t["loaded"])],
    }


def p4_try_outside(lang):
    """try가 while 전체를 감싼 4단계 오답(파일이 없으면 안내 한 줄 뒤 프로그램이 끝남)"""
    t = P4_TXT[lang]
    inner = p4(lang, 2)
    ind = "".join("    " + line + "\n" if line else "\n" for line in inner.rstrip("\n").split("\n"))
    return "try:\n" + ind + 'except FileNotFoundError:\n    print("%s")\n' % t["none"]


P5_TXT = {
    "ko": {"count": "도시 {len(data)}곳의 날씨가 있어요", "ask": "어느 도시를 볼까요?",
           "sky": "하늘 ", "temp": "기온 ", "rain": "강수 ", "deg": "도", "none": "그 도시는 날씨 정보가 없어요",
           "city": "서울"},
    "en": {"count": "Cities in the file: {len(data)}", "ask": "Which city?",
           "sky": "Sky  ", "temp": "Temp ", "rain": "Rain ", "deg": "°C", "none": "No weather for that city",
           "city": "Seoul"},
}


def p5(lang, step):
    """P5 k단계(0부터) 정답"""
    t = P5_TXT[lang]
    head = ('import json\n\nwith open("weather.json") as f:\n    data = json.load(f)\nprint(f"%s")\n' % t["count"])
    lst = 'for city in data:\n    print("-", city)\n'
    ask = 'print("%s")\ncity = input()\n' % t["ask"]
    plain = ('info = data[city]\nprint(f"%s{info[\'sky\']}")\nprint(f"%s{info[\'temp\']}%s")\n'
             % (t["sky"].strip() + ": ", t["temp"].strip() + ": ", t["deg"]))
    card = ('print(f"{city:=^14}")\nprint(f"%s{info[\'sky\']:>6}")\nprint(f"%s{info[\'temp\']:>6}%s")\n'
            'print(f"%s{info[\'rain\']:>6}%%")\nprint("=" * 14)\n' % (t["sky"], t["temp"], t["deg"], t["rain"]))
    if step == 0:
        return head
    if step == 1:
        return head + lst
    if step == 2:
        return head + lst + ask + plain
    if step == 3:
        return head + lst + ask + "info = data[city]\n" + card
    ind = "".join("    " + line + "\n" for line in card.rstrip("\n").split("\n"))
    return (head + lst + ask + "if city in data:\n    info = data[city]\n" + ind
            + 'else:\n    print("%s")\n' % t["none"])


def p5_wrong(lang):
    t = P5_TXT[lang]
    s = [p5(lang, k) for k in range(5)]
    n = t["count"].replace("{len(data)}", "3")
    return {
        # 1단계: loads에 파일을 줌(TypeError), load에 파일 이름을 줌, 글자 수를 셈, 개수를 3으로 적음(require)
        ("P5", 0): [_swap(s[0], "json.load(f)", "json.loads(f)"),
                    _swap(s[0], "json.load(f)", 'json.load("weather.json")'),
                    _swap(s[0], "json.load(f)", "f.read()"),
                    'import json\n\nprint(f"%s")\n' % n],
        # 2단계: 사전을 통째로 출력, 값(날씨)을 돎, 이름 대신 사전을 출력
        ("P5", 1): [_swap(s[1], 'for city in data:\n    print("-", city)\n', "print(data)\n"),
                    _swap(s[1], "for city in data:", "for city in data.values():"),
                    _swap(s[1], 'print("-", city)', 'print("-", data)')],
        # 3단계: 도시를 정해 둠, 사전에서 바로 sky를 찾음(KeyError), 기온 단위를 빠뜨림
        ("P5", 2): [_swap(s[2], "info = data[city]", 'info = data["%s"]' % t["city"]),
                    _swap(s[2], "info = data[city]", "info = data"),
                    _swap(s[2], "{info['temp']}%s\")" % t["deg"], "{info['temp']}\")")],
        # 4단계: 왼쪽 정렬, 제목에 = 채움 없음, 칸 수가 다름, 아래 줄 없음
        ("P5", 3): [s[3].replace(":>6}", ":<6}"),
                    _swap(s[3], "{city:=^14}", "{city:^14}"),
                    s[3].replace(":>6}", ":>5}"),
                    _swap(s[3], 'print("=" * 14)\n', "")],
        # 5단계: if 없이 바로 찾음(없는 도시면 KeyError), 값에서 찾음(늘 「없어요」), 한 도시만 확인
        ("P5", 4): [s[3],
                    _swap(s[4], "if city in data:", "if city in data.values():"),
                    _swap(s[4], "if city in data:", 'if city == "%s":' % t["city"])],
    }


for _lang in ("ko", "en"):
    for _key, _codes in list(p4_wrong(_lang).items()) + list(p5_wrong(_lang).items()):
        WRONG.setdefault(_key, {})[_lang] = _codes


def node_data():
    p = subprocess.run(["node", HELPER], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60)
    if p.returncode != 0:
        raise SystemExit("projects_helper.mjs failed:\n" + p.stderr)
    return json.loads(p.stdout)


def icon_names():
    with open(os.path.join(ROOT, "src", "ui", "dom.js"), encoding="utf-8") as f:
        src = f.read()
    block = src[src.index("const P = {"):]
    block = block[:block.index("\n};")]
    return set(re.findall(r"^\s*(\w+):", block, re.M))


# ---------------------------------------------------------------- 문법
def _is_tool_attr(n):
    return isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id in TOOL_MODULES \
        and n.attr in TOOL_FUNCS


def width(line):
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in line)


def grammar_problems(code, need):
    """경비실 표(gi.allowed) + 기본 입출력 + 새 도구 예외로 code를 검사. 문제 목록(빈 목록이면 통과)."""
    nodes, calls, methods, modules, from_names = gi.allowed(need)
    nodes = nodes | BASE_NODES
    calls = (calls - gi.ENGINE_CMDS) | BASE_CALLS   # 경비실 명령(block·allow…)은 프로젝트에 없음
    for ch, names in LESSON_CALLS_BY_CH.items():
        if need >= ch:
            calls = calls | names
    for ch, names in LESSON_METHODS_BY_CH.items():
        if need >= ch:
            methods = methods | names
    tree = ast.parse(code)
    defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.ClassDef))}
    tool_imports = {id(n) for n in ast.walk(tree)
                    if isinstance(n, ast.Import) and all(a.name in TOOL_MODULES and a.asname is None for a in n.names)}
    tool_aliases = {id(a) for n in ast.walk(tree) if id(n) in tool_imports for a in n.names}
    bad = []
    for n in ast.walk(tree):
        name = type(n).__name__
        if id(n) in tool_imports or id(n) in tool_aliases or _is_tool_attr(n):
            continue
        if name not in nodes:
            bad.append("마디 " + name)
        if isinstance(n, ast.Import):
            bad += ["모듈 " + a.name for a in n.names if a.name not in modules]
        if isinstance(n, ast.ImportFrom):
            bad.append("모듈 " + str(n.module))
        if isinstance(n, ast.Call):
            f = n.func
            if isinstance(f, ast.Name):
                if f.id not in calls and f.id not in defined:
                    bad.append("부르는 이름 " + f.id)
            elif _is_tool_attr(f):
                pass
            elif isinstance(f, ast.Attribute):
                if f.attr not in methods and f.attr not in defined:
                    bad.append("메서드 " + f.attr)
            else:
                bad.append("부르는 대상 " + name)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "print" and n.keywords:
            if "keyword" not in nodes:
                bad.append("print의 이름 붙은 인자")
    return bad


def randint_ranges(code):
    """randint(a, b)의 (a, b) 목록. 인자가 정수 상수가 아닌 호출이 하나라도 있으면 None(범위 검사 건너뜀)"""
    out = []
    for n in ast.walk(ast.parse(code)):
        if isinstance(n, ast.Call) and _is_tool_attr(n.func) and n.func.attr == "randint":
            args = n.args
            if len(args) != 2 or n.keywords or not all(isinstance(a, ast.Constant) and type(a.value) is int for a in args):
                return None
            out.append((args[0].value, args[1].value))
    return out


def widened(code):
    """정답의 randint(a, b)마다 범위를 바꾼 코드(넓게: b*2·a-1, 좁게: b-1·a+1)."""
    out = []
    for m in re.finditer(r"random\.randint\((-?\d+), (-?\d+)\)", code):
        a, b = int(m.group(1)), int(m.group(2))
        for na, nb in ((a, b * 2), (a - 1, b), (a, b - 1), (a + 1, b)):
            out.append(code[:m.start()] + "random.randint(%d, %d)" % (na, nb) + code[m.end():])
    return out


def uses_intro_methods(code):
    """새 도구 카드로 다시 소개할 메서드(TOOL_INTRO_METHODS)를 부르는 이름 집합(json.load 등)"""
    return {n.func.attr for n in ast.walk(ast.parse(code)) if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute) and n.func.attr in TOOL_INTRO_METHODS}


def intro_problems(p):
    """⑦ 심화 레슨에서만 배운 메서드(json.load)를 처음 쓰는 단계에 새 도구 카드(tool)가 있음"""
    bad, seen = [], set()
    for k, s in enumerate(p["steps"]):
        new = uses_intro_methods(s["solution"]) - seen
        if new and "tool" not in s:
            bad.append("%d단계: %s를 처음 쓰는데 새 도구 카드(tool)가 없음" % (k + 1, sorted(new)))
        seen |= new
    return bad


def uses_random(code):
    """random.randint·random.choice를 부르는 이름 집합"""
    return {n.func.attr for n in ast.walk(ast.parse(code)) if isinstance(n, ast.Call) and _is_tool_attr(n.func)}


def self_test():
    cases = [
        (3, 'me = input()\nprint("나:", me)\n', True),
        (3, 'import random\nn = random.randint(1, 3)\nif n == 1 and n != 2:\n    print(f"{n}")\n', True),
        (3, 'import random\nprint(random.choice("ab"))\n', True),
        (3, 'import random as r\nprint(r.randint(1, 3))\n', False),
        (3, 'import random\nprint(random.random())\n', False),
        (3, 'import os\n', False),
        (3, 'from random import randint\n', False),
        (3, 'x = "a".upper()\n', False),
        (3, 'for i in range(3):\n    print(i)\n', False),
        (5, 'n = 0\nwhile n < 3:\n    n += 1\n', True),
        (3, 'print(len("ab"))\n', False),
        (3, 'block()\n', False),
        (3, 'if ___ == 1:\n    x = "___"\n', True),
        (3, 'print("a", end="")\n', False),
        (8, 'import random\nd = {"a": 1}\nprint(random.choice(list(d)))\n', True),    # list()는 7-4에서 배움
        (6, 'print(list("ab"))\n', False),
        (5, 'n = 0\nwhile True:\n    n += 1\n    if n > 2:\n        break\n', True),
        (5, 'd = {"a": 1}\n', False),
        # 작업 5: write는 11-3, json.load는 14-A2(새 도구 카드로 다시 소개)
        (11, 'with open("t.txt", "a") as f:\n    f.write("a\\n")\n', True),
        (10, 'with open("t.txt", "a") as f:\n    f.write("a\\n")\n', False),
        (11, 'try:\n    f = open("t.txt")\nexcept FileNotFoundError:\n    print("x")\n', True),
        (14, 'import json\nwith open("w.json") as f:\n    d = json.load(f)\nprint(f"{d:>5}")\n', True),
        (13, 'import json\nwith open("w.json") as f:\n    d = json.load(f)\n', False),
        (14, 'import json\nwith open("w.json", "w") as f:\n    json.dump({}, f)\n', False),
        (11, 'with open("t.txt") as f:\n    n = len(f.readlines())\n', True),
    ]
    bad = 0
    for ch, code, want in cases:
        got = not grammar_problems(code, ch)
        if got != want:
            bad += 1
            print("FAIL 문법 검사기 자체 시험 %d장 %r → %s (기대 %s): %s" % (ch, code, got, want, grammar_problems(code, ch)))
    print("%s 문법 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases)))
    return bad


# ---------------------------------------------------------------- 실행
def normalize(text):
    """src/grade.js normalize와 같음: \r\n → \n, 줄 끝 공백·끝 줄바꿈 제거"""
    s = "" if text is None else str(text)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\n+$", "", "\n".join(line.rstrip() for line in s.split("\n")))


def run_test(code, step, t, lang):
    files = t.get("files") or step.get("files")
    kw = {"lang": lang}
    if files:
        kw["files"] = files
    if t.get("rand") is not None:
        kw["rand"] = t["rand"]
    return runner.run(code, t.get("stdin"), step.get("require") or [], **kw)


def test_fails(code, step, t, lang):
    """시험 하나를 돌려 실패 이유(통과면 None)"""
    r = run_test(code, step, t, lang)
    if r.get("error"):
        return "오류 %s" % (r["error"].get("type") if isinstance(r["error"], dict) else r["error"])
    if normalize(r.get("stdout")) != normalize(t.get("expect")):
        return "출력 %r ≠ 기대 %r" % (normalize(r.get("stdout")), normalize(t.get("expect")))
    if r.get("missing"):
        return "빠진 문법 %s" % r["missing"]
    return None


def _text(v):
    return isinstance(v, str) and v.strip() != ""


PROJECT_KEYS = {"id", "need", "icon", "title", "blurb", "intro", "finale", "play", "steps"}
STEP_KEYS = {"goal", "task", "starter", "tool", "tests", "require", "hints", "solution", "explain", "files"}


def code_hints(step):
    """여러 줄인 힌트 = 코드 뼈대(___ 빈칸은 이름으로 읽힘). elif·else로 시작하는 조각은 앞에 if를 붙여 읽는다"""
    out = []
    for h in step.get("hints") or []:
        if isinstance(h, str) and "\n" in h:
            out.append(("if ___:\n    ___ = 0\n" + h) if re.match(r"(elif\b|else\s*:)", h) else h)
    return out


def shape_problems(p, icons):
    bad = []
    if set(p) - PROJECT_KEYS:
        bad.append("모르는 칸 %s" % sorted(set(p) - PROJECT_KEYS))
    for k in TEXT_KEYS:
        if not _text(p.get(k)):
            bad.append("%s 칸이 빈 글" % k)
    if p.get("icon") not in icons:
        bad.append("icon %r은 아이콘 묶음에 없음" % p.get("icon"))
    play = p.get("play")
    if not (isinstance(play, dict) and _text(play.get("prompt"))):
        bad.append("play.prompt가 없음")
    elif set(play) - {"prompt", "files"}:
        bad.append("play에 모르는 칸 %s" % sorted(set(play) - {"prompt", "files"}))
    steps = p.get("steps")
    if not (isinstance(steps, list) and 3 <= len(steps) <= 5):
        bad.append("단계는 3~5개")
        return bad
    for k, s in enumerate(steps):
        where = "%d단계 " % (k + 1)
        if set(s) - STEP_KEYS:
            bad.append(where + "모르는 칸 %s" % sorted(set(s) - STEP_KEYS))
        if "explain" in s and not _text(s["explain"]):
            bad.append(where + "explain이 빈 글")
        for key in STEP_TEXT_KEYS:
            if not _text(s.get(key)):
                bad.append(where + key + " 칸이 빈 글")
        if not _text(s.get("solution")):
            bad.append(where + "solution 없음")
        if "starter" in s and k > 0:
            bad.append(where + "starter는 첫 단계만(이후 단계는 앞 단계 코드에서 시작)")
        if "starter" in s and not isinstance(s["starter"], str):
            bad.append(where + "starter가 글이 아님")
        if "tool" in s:
            tool = s["tool"]
            if not (isinstance(tool, dict) and set(tool) == {"title", "body", "code"} and all(_text(tool[x]) for x in tool)):
                bad.append(where + "tool은 { title, body, code } 모두 글")
        if not (isinstance(s.get("hints"), list) and s["hints"] and all(_text(h) for h in s["hints"])):
            bad.append(where + "hints는 비지 않은 글 목록")
        if not (isinstance(s.get("require"), list) and all(isinstance(x, str) for x in s["require"])):
            bad.append(where + "require는 글 목록")
        tests = s.get("tests")
        if not (isinstance(tests, list) and tests):
            bad.append(where + "시험이 없음")
            continue
        if not any(t.get("public") is True for t in tests):
            bad.append(where + "공개 시험(public)이 없음")
        for i, t in enumerate(tests):
            extra = set(t) - {"stdin", "expect", "public", "rand", "files"}
            if extra:
                bad.append(where + "시험 %d에 모르는 칸 %s" % (i, sorted(extra)))
            if not isinstance(t.get("expect"), str) or not isinstance(t.get("stdin", ""), str) \
                    or not isinstance(t.get("public"), bool):
                bad.append(where + "시험 %d 모양(stdin 글, expect 글, public 참/거짓)" % i)
            if "rand" in t and not (isinstance(t["rand"], list) and t["rand"]):
                bad.append(where + "시험 %d rand는 비지 않은 목록" % i)
    return bad


def _exact(v):
    """[값, a, b]: 「randint(a, b)를 불러 값」. 값만 주면 범위를 넓게 쓴 코드(randint(1, 100))를 못 거른다(작업 4 검토 I1)."""
    return isinstance(v, list) and len(v) == 3 and all(type(x) is int for x in v)


def rand_problems(p):
    """⑥ 무작위를 쓰는 단계는 시험마다 rand, randint를 쓰면 rand 값은 모두 [값, a, b](정답의 randint(a, b)와 같은 부름). ⑦ 처음 쓰는 단계에 tool."""
    bad = []
    first = True
    for k, s in enumerate(p["steps"]):
        used = uses_random(s["solution"])
        if not used:
            continue
        if first and "tool" not in s:
            bad.append("%d단계: random을 처음 쓰는 단계에 새 도구 카드(tool)가 없음" % (k + 1))
        first = False
        for i, t in enumerate(s["tests"]):
            if "rand" not in t:
                bad.append("%d단계 시험 %d: 무작위를 쓰는데 rand가 없음(채점이 매번 달라짐)" % (k + 1, i))
            elif "randint" in used and not all(_exact(v) for v in t["rand"]):
                bad.append("%d단계 시험 %d: randint의 rand 값은 [값, a, b](정수 셋, 작업 4 검토 I1)가 아님 %r"
                           % (k + 1, i, t["rand"]))
            elif "randint" in used and "choice" not in used:
                ranges = randint_ranges(s["solution"])
                out = [v for v in t["rand"] if ranges is not None
                       and not ((v[1], v[2]) in ranges and v[1] <= v[0] <= v[2])]
                if out:
                    bad.append("%d단계 시험 %d: rand 값 %r이 정답의 randint 부름 %r과 다름" % (k + 1, i, out, ranges))
    return bad


def rand_self_test():
    R = "import random\nn = random.randint(1, 3)\n"
    good = {"steps": [{"solution": "print(1)", "tests": [{}]},
                      {"solution": R, "tool": {}, "tests": [{"rand": [[1, 1, 3]]}]}]}
    cases = [
        (good, True),
        ({"steps": [{"solution": R, "tests": [{"rand": [[1, 1, 3]]}]}]}, False),        # 도구 카드 없음
        ({"steps": [{"solution": R, "tool": {}, "tests": [{}]}]}, False),                # rand 없음
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": ["1"]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [True]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [1.0]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [1]}]}]}, False),     # 값만(넓은 범위를 못 거름)
        ({"steps": [{"solution": 'import random\nn = random.choice("ab")\n', "tool": {}, "tests": [{"rand": ["a"]}]}]}, True),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [[7, 1, 3]]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [[0, 1, 3]]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [[2, 1, 4]]}]}]}, False),   # 정답과 다른 부름
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [[True, 1, 3]]}]}]}, False),
        ({"steps": [{"solution": R, "tool": {}, "tests": [{"rand": [[3, 1, 3], [1, 1, 3]]}]}]}, True),
    ]
    bad = 0
    for p, want in cases:
        if (not rand_problems(p)) != want:
            bad += 1
            print("FAIL rand 검사기 자체 시험 %r: %s" % (p, rand_problems(p)))
    # ⑦ json.load(심화 14-A2)를 처음 쓰는 단계에 새 도구 카드(작업 5)
    L = 'import json\nwith open("w.json") as f:\n    d = json.load(f)\n'
    icases = [
        ({"steps": [{"solution": L, "tool": {}}, {"solution": L}]}, True),
        ({"steps": [{"solution": "print(1)"}, {"solution": L}]}, False),
        ({"steps": [{"solution": 'import json\nd = json.loads("{}")\n'}]}, True),
    ]
    for p, want in icases:
        if (not intro_problems(p)) != want:
            bad += 1
            print("FAIL 새 도구 카드(json.load) 자체 시험 %r: %s" % (p, intro_problems(p)))
    print("%s rand 검사기 자체 시험 %d개" % ("ok  " if not bad else "FAIL", len(cases) + len(icases)))
    return bad


def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, dict):
        for x in v.values():
            yield from strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)


def main():
    data = node_data()
    fails = self_test() + rand_self_test()

    def check(ok, label, extra=""):
        nonlocal fails
        if ok:
            print("ok   " + label)
        else:
            fails += 1
            print("FAIL " + label + ((" — " + extra) if extra else ""))

    check(data["stepXp"] == 5 and data["doneXp"] == 20, "⑩ PROJECT_STEP_XP = 5, PROJECT_DONE_XP = 20")
    ko, en = data["ko"], data["en"]
    check([(p["id"], p["need"]) for p in ko] == WANT, "① 한국어 id·장 = WANT", str([(p.get("id"), p.get("need")) for p in ko]))
    check([(p["id"], p["need"]) for p in en] == WANT, "① 영어 id·장 = WANT", str([(p.get("id"), p.get("need")) for p in en]))
    icons = icon_names()
    en_by_id = {p["id"]: p for p in en}
    for p in ko:
        e = en_by_id.get(p["id"])
        if e is None:
            continue
        pid = p["id"]
        for lang, q in (("ko", p), ("en", e)):
            bad = shape_problems(q, icons)
            check(not bad, "② %s %s 칸 모양" % (pid, lang), "; ".join(bad))
        if not (isinstance(p.get("steps"), list) and isinstance(e.get("steps"), list)):
            continue
        same = len(p["steps"]) == len(e["steps"])
        detail = []
        if same:
            for k, (a, b) in enumerate(zip(p["steps"], e["steps"])):
                if len(a["tests"]) != len(b["tests"]):
                    detail.append("%d단계 시험 수" % (k + 1))
                    continue
                for i, (ta, tb) in enumerate(zip(a["tests"], b["tests"])):
                    if len(ta.get("rand") or []) != len(tb.get("rand") or []) or ta.get("public") != tb.get("public"):
                        detail.append("%d단계 시험 %d rand 길이·public" % (k + 1, i))
                if a.get("require") != b.get("require"):
                    detail.append("%d단계 require" % (k + 1))
                if ("tool" in a) != ("tool" in b):
                    detail.append("%d단계 tool" % (k + 1))
        check(same and not detail, "① %s 한·영 단계 수·시험 수·rand 길이·require·tool 같음" % pid, ", ".join(detail))
        hangul_en = [s for s in strings(e) if HANGUL.search(s)]
        check(not hangul_en, "⑨ %s 영어 파일에 한글 없음" % pid, repr(hangul_en[:3]))
        no_ko = [k + 1 for k, s in enumerate(p["steps"]) if not (HANGUL.search(s.get("task", "")) and HANGUL.search(s.get("goal", "")))]
        check(not no_ko, "⑨ %s 한국어 단계 글에 한글" % pid, str(no_ko))

        for lang, q in (("ko", p), ("en", e)):
            steps = q["steps"]
            bad = rand_problems(q) + intro_problems(q)
            check(not bad, "⑥⑦ %s %s 무작위 시험 값·새 도구 카드" % (pid, lang), "; ".join(bad))
            for k, s in enumerate(steps):
                tag = "%s %s %d단계" % (pid, lang, k + 1)
                # ⑤ 문법
                codes = [("solution", s["solution"])]
                if "starter" in s:
                    codes.append(("starter", s["starter"]))
                if "tool" in s:
                    codes.append(("tool.code", s["tool"]["code"]))
                codes += [("hint %d" % (h + 1), c) for h, c in enumerate(code_hints(s))]
                gbad = []
                for what, code in codes:
                    try:
                        gbad += ["%s: %s" % (what, x) for x in grammar_problems(code, q["need"])]
                    except SyntaxError as ex:
                        gbad.append("%s: 문법 오류 %s" % (what, ex))
                check(not gbad, "⑤ %s %d장까지 문법(+새 도구)" % (tag, q["need"]), "; ".join(gbad))
                wide = ["%s: %r(%d칸)" % (what, line, width(line)) for what, code in codes for line in code.split("\n")
                        if width(line) > CODE_COLS]
                check(not wide, "⑪ %s 코드 줄 폭 %d칸 이하" % (tag, CODE_COLS), "; ".join(wide))
                # ③ 정답이 시험 통과
                why = [(i, test_fails(s["solution"], s, t, lang)) for i, t in enumerate(s["tests"])]
                why = [(i, w) for i, w in why if w]
                check(not why, "③ %s solution이 시험 %d개 통과" % (tag, len(s["tests"])), "; ".join("시험 %d %s" % x for x in why))
                # ④ 다음 단계의 시작
                if k + 1 < len(steps):
                    nxt = steps[k + 1]
                    t = next((t for t in nxt["tests"] if t.get("public")), nxt["tests"][0])
                    r = run_test(s["solution"], nxt, t, lang)
                    check(not r.get("error"), "④ %s solution이 %d단계 공개 시험에서 오류 없이 돎" % (tag, k + 2),
                          str(r.get("error")))
                # ⑫ 한 판 입력 상한(50번) 안: 시험마다 입력 줄 수 ≤ PLAY_MAX_INPUTS
                many = [i for i, t in enumerate(s["tests"]) if len(runner._split_stdin(t.get("stdin"))) > PLAY_MAX_INPUTS]
                check(not many, "⑫ %s 시험 입력 %d줄 이하" % (tag, PLAY_MAX_INPUTS), str(many))
                # ⑧ 오답
                wrong = WRONG.get((pid, k), {}).get(lang, [])
                check(len(wrong) >= 1, "⑧ %s 오답 1개 이상" % tag, "WRONG[(%r, %d)][%r] 없음" % (pid, k, lang))
                for j, code in enumerate(wrong):
                    failed = any(test_fails(code, s, t, lang) for t in s["tests"])
                    check(failed, "⑧ %s 오답 %d은 시험에서 실패" % (tag, j + 1))
                # ⑧ randint 범위를 넓히거나 좁힌 정답은 모두 실패(검토 I1: 값만 주는 rand는 넓은 범위를 못 거름)
                for code in widened(s["solution"]):
                    failed = any(test_fails(code, s, t, lang) for t in s["tests"])
                    check(failed, "⑧ %s randint 범위를 바꾼 정답은 실패: %s" % (tag, re.findall(r"randint\([^)]*\)", code)))
        # ⑫ 완성작(마지막 단계 정답)을 입력 없이 주고받기로 돌리면, 끝나거나 입력을 기다린다(끝없이 돌지 않음)
        for lang, q in (("ko", p), ("en", e)):
            last = q["steps"][-1]["solution"]
            r = runner.run(last, [], [], lang=lang, interactive=True, seed=7, files=(q.get("play") or {}).get("files"))
            check(not r.get("error"), "⑫ %s %s 완성작이 입력 없이 끝나거나 입력을 기다림" % (pid, lang), str(r.get("error")))
    print("실패 %d" % fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
