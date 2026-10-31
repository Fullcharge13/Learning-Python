# 레슨 작성 가이드 (리아와 파이썬!)

레슨을 쓰는 일꾼은 **이 문서 + 커리큘럼 설계서의 해당 장 표 + 예시 레슨 1개**만 읽는다. 원 설계서, 실행 기록, 다른 장은 읽지 않는다. 판정 번호(C9 등)는 근거 표시일 뿐이다.

## 1. 파일과 형식

`data/lessons/chN.js`
```js
export const CHAPTER = { id: N, title: "장 제목" };
export const LESSONS = [ /* N-1 … N-5, N-5는 isExam: true */ ];
```
레슨 하나:
```js
{ id: "N-k", chapter: N, title, goal, summary: ["…","…","…"], isExam?: true,
  cards: [ { say, code, out, stdin? } ],          // 1~2장
  items: [ 터치 문제 4~6개(평가 4~8개) → write 1개 → check 1개 ] }
```
| type | 필수 칸 | 선택 칸 |
|---|---|---|
| choice / check | concept, q, options(3~4), answer, explain | code, stdin, files, server |
| blank | concept, q, code(`___` 정확히 1개), chips(3~4), answer, explain | stdin, files, server |
| order | concept, q, lines(3~6, **정답 순서대로**), expect, explain | stdin, files, server |
| write | concept, task, starter, tests, require, hints(4), solution, explain | files, server |

카드도 `files`·`server`를 둘 수 있다. `files`·`server`는 3-1절.

모르는 칸 이름은 오류다(오타 방지). `concept`는 `data/concepts.js`에 있는 id이고, 그 개념의 장이 레슨의 장보다 뒤면 안 된다.

## 2. 글자 수 (아이폰 화면 기준)

제목 16 · 목표 40(한 줄) · 요약 3줄 각 32 · 카드 말풍선 140 · 문제 80 · 해설 160 · 과제 200 · 힌트 120 · 코드 한 줄 38칸(한글은 2칸) · 코드에 탭 금지.

## 3. 문제별 규칙

- **stdin**: `"12\n30"`처럼 `\n`으로 나눈 문자열(C18). 카드·터치 문제도 `input()`을 쓰면 stdin을 준다(C23).
- **input의 질문 글자**: `input("이름? ")`의 질문은 출력에 찍힌다(C9). 채점하는 코드에서는 `input()`을 괄호 비워 쓰고, 과제 문장에 「input() 괄호는 비워 두세요」라고 적는다.
- **choice/check 출력 질문**: `q`에 「출력」이 있고 code가 있으면 점검기가 실제로 실행한다. 정답 보기와만 출력이 같아야 한다. 코드가 오류면 정답 보기에 「오류」가 들어가야 한다.
- **code가 있는 choice/check 전부**: 점검기는 `q`에 「출력」이 없어도 code를 실행하고, 실제 화면 출력과 똑같은 보기가 정답이 아니면 오류로 본다. 「x에 든 값은?」 같은 질문의 오답 보기가 화면 출력과 같아지지 않게 쓴다(예: 「화면에 찍힌 10」).
- **여러 줄 출력**: `out`·`expect`에서 줄은 `\n`으로 잇는다.
- **제목**: 한글이 들어가야 한다(「return」 단독 불가 → 「결과 돌려주기」).
- **blank**: 정답 칩만 맞고 다른 칩은 오류이거나 다른 출력이어야 한다.
- **order**: 줄을 정답 순서대로 저장한다(화면이 섞는다). 그 순서로만 `expect`가 나와야 한다. 어느 자리에 놓아도 출력이 같은 줄(주석 한 줄 등)은 정답 순서를 여러 개로 만들므로 금지(C23). 마지막 `print("끝")`처럼 자리를 옮기면 출력이 바뀌는 줄은 괜찮다.
- **write**:
  - `input()`이 있으면 시험 2~4개(그중 공개 1개), 없으면 공개 시험 1개(C20). 형식은 `{ stdin, expect, public }`.
  - `starter`는 시험에 떨어져야 하고 `solution`은 모두 통과해야 한다.
  - **하드코딩 막기**: 정답 숫자를 그대로 `print`해도 통과하면 안 된다. `require`에 문법 마디 이름(`If`, `For`, `FunctionDef`, `Return`, `Mult` …) 또는 `Call:함수이름`, `Name:변수이름`(그 변수를 읽음)을 넣는다(C26). 점이 붙은 호출(`json.loads`, `re.search`, `csv.reader`)은 `Method:loads`처럼 `Method:`로 쓴다. `Call:`은 `urlopen(...)`처럼 이름만으로 부를 때만 맞는다.
  - 숨은 시험에는 **경계값**(딱 기준값, 최솟값, n=1, 0회 반복)을 넣는다.
  - 과제 문장에 **예시 입출력**을 한 줄 넣는다(「3을 입력하면 「…」」).
  - 과제 문장에 없는 조건을 `require`로 요구하지 않는다(예: and를 요구하면 문장에 「and로 묶어」라고 쓴다).
  - **힌트 4단계**: ① 문제 다시 읽기 → ② 배운 개념 떠올리기 → ③ 방향(답 코드를 쓰지 않음) → ④ 뼈대 코드(`___` 포함).

## 3-1. 파일·연습 서버·import (11~14장)

- **files** (11장~): `{"memo.txt": "우유\n빵\n"}` 이름 → 내용(문자열). 실행마다 빈 폴더에 이 파일들을 만들고 그 폴더에서 돈다. 이름은 폴더 없는 파일 이름(`/` `\` 없음, `.`으로 시작 안 함, 40자 이하), 1~5개. 쓰기도 그 폴더 안에서만 되고 실행이 끝나면 지워진다(다음 실행에 남지 않음).
- write의 시험마다 `files`를 따로 둘 수 있다(`{ stdin, expect, public, files }`, 없으면 문제의 `files`). 시험별 `files`가 있으면 input이 없어도 시험 2~4개 — 파일 내용을 바꾼 숨은 시험으로 하드코딩을 막는다.
- **server** (13장~): `{"https://ria.example/menu": {"status": 200, "body": "…", "type": "text/html"}}` 주소 → 응답. status는 100~599 정수, body는 문자열, type은 선택. 실행 동안 `urllib.request.urlopen`이 이 표로 답한다. 표에 없는 주소는 `URLError`, status 400 이상은 `HTTPError`. 실제 인터넷은 쓰지 않는다.
- **주소 규칙**: 연습 서버 주소는 언제나 `https://ria.example/…`(실존 사이트 주소 금지). 경로는 짧게(`/menu`, `/bus?stop=101`).
- **import**: 장마다 정해진 모듈만(누적). 11장 `csv` · 12장 `re` · 13장 `urllib.request`·`urllib.parse`·`urllib.error` · 14장 `json`. 그 밖의 모듈(`os`, `sys`, `requests` …)은 오류. 모듈에서 쓸 수 있는 이름과 `open()`의 모드(`"r"`·`"w"`·`"a"`만, `encoding=`·`newline=` 허용)는 `tests/content.py`의 `MODULE_MEMBERS`·`CALL_KWARGS`가 정한다.
- **38칸**: `urllib.request.urlopen("https://ria.example/x")`는 한 줄에 안 들어간다. `from urllib.request import urlopen`과 `url = "…"` 변수로 나눈다.
- **JSON 출력(14장)**: 딕셔너리를 통째로 `print`하거나 `json.dumps`를 그냥 출력하지 말고 **특정 값을 꺼내 출력**한다. 꼭 dumps 결과를 보여야 하면 `sort_keys=True`, `indent=2`, `ensure_ascii=False`를 명시해 키 순서·공백이 하나로 정해지게 하고, 과제 문장에도 그 인자를 적는다.
- **정규표현식(12장)**: 패턴 글자를 채점하지 말고 **출력**을 채점한다. 맞는 패턴이 여러 개(`\d+`·`[0-9]+`)일 수 있으므로 시험 데이터는 어느 맞는 패턴에도 같은 출력이 나오게 고르고, blank 오답 칩은 실제로 다른 출력이나 오류를 내야 한다. 패턴은 `r"…"`로 쓴다.

## 3-2. 객체지향·SQL·차트 (15~17장)

- **import(누적)**: 15장 새 모듈 없음 · 16장 `sqlite3`(이름은 `connect`만) · 17장 `chart`(앱이 주는 모듈, `bar`·`line`·`title`·`xlabel`·`ylabel`·`show`만, 이름 붙은 인자 없음).
- **15장 class**: `class Dog(Pet):`처럼 **이 코드에서 만든 클래스 하나만** 물려받는다(`object`·`Exception`·여러 클래스·`metaclass=` 금지). 데코레이터(`@…`) 금지. 특수 메서드는 `__init__`·`__str__`만(다른 `__이름__`은 정의도, `obj.__dict__`처럼 점 뒤에 쓰는 것도 금지). `super().__init__(…)`, `isinstance(x, Pet)`, 클래스 변수(`kind = "동물"`)는 된다. 컴프리헨션·lambda는 여전히 금지.
- **self 빠뜨림 설명**: `def bark():`로 쓰고 `d.bark()`를 부르면 `TypeError: Dog.bark() takes 0 positional arguments but 1 was given`이 난다. 해설은 쉬운 말로: 「`d.bark()`라고 부르면 Python이 `d`를 첫 번째 값으로 몰래 넘겨요. 받을 자리(`self`)가 없어서 『0개 받는데 1개가 왔다』는 단서가 나와요. 메서드의 첫 매개변수는 언제나 `self`예요.」 이런 틀린 예는 점검기가 막지 않으므로 choice 문제의 code로 쓸 수 있다(정답 보기에 「오류」).
- **클래스와 객체 혼동**: `Dog`(설계도)와 `d = Dog("초코")`(만든 물건)를 말로 구분한다. 「클래스 = 붕어빵 틀, 객체 = 붕어빵」처럼 한 번 비유하고 용어를 바꾸지 않는다.
- **16장 sqlite3**: 언제나 `sqlite3.connect(":memory:")` — 인자는 이 글자 하나만(변수·파일 이름·이름 붙은 인자는 점검기 오류). 실행마다 새 빈 DB이므로 코드 안에서 `CREATE TABLE` → `INSERT` → `SELECT` 순서로 다 한다. 연결·커서에는 `cursor`·`execute`·`executemany`·`fetchall`·`fetchone`·`commit`·`close`만 쓴다(`executescript` 등 금지). SQL 글 자체는 점검기가 보지 않으니 직접 실행해 확인한다.
- **ORDER BY**: 여러 줄이 나오는 `SELECT`의 출력을 채점하거나 보기로 비교하면 **반드시 `ORDER BY`**를 붙인다(없으면 순서가 우연에 기댐). `GROUP BY` 집계도 `ORDER BY`를 함께 쓴다.
- **`?` 자리 표시**: 값은 SQL 글에 f-문자열·`+`로 끼워 넣지 않고 `cur.execute("… WHERE y > ?", (2020,))`처럼 `?`와 튜플로 넘긴다(값 하나도 `(값,)` 쉼표). 16-4에서 「글을 이어 붙이면 위험해요(SQL 주입)」를 한 줄로 말한다.
- **17장 차트**: `chart.bar(이름들, 값들)`/`chart.line(…)` → `chart.title`·`xlabel`·`ylabel` → `chart.show()`. `show()`가 없으면 그림이 없다. 한 그림에 막대·꺾은선 하나만, 한 실행에 그림 3개까지. 이름과 값의 개수가 다르면 `ValueError`.
- **차트 채점(`chart` 칸)**: write의 시험과 터치 문제에 선택 칸 `chart: {"kind": "bar"|"line", "labels": [...], "values": [...], "title"?, "xlabel"?, "ylabel"?}`을 둔다. 적힌 칸만 비교하고, 값은 숫자로 비교한다(`3`과 `3.0`은 같음). 출력(`expect`)과 차트를 둘 다 맞혀야 통과한다. 하드코딩을 막으려면 `require`에 `Method:bar`처럼 쓰고, 값은 리스트·딕셔너리에서 계산해 넣게 한다.
- **matplotlib 비교 카드(17-5, 판정 C38)**: 카드에 `show_only: true`를 두면 코드를 **실행하지 않고 보여 주기만** 한다(화면에 「실제 컴퓨터용 코드(여기서는 실행 안 함)」 표시, 출력 칸 없음). 그래서 주석이 아닌 진짜 코드로 쓴다. 점검기는 너비(38칸)만 보고, `out`은 없거나 `""`, stdin·files·server·chart는 같이 쓸 수 없다. 카드에만 쓸 수 있다. 예:
  ```python
  import matplotlib.pyplot as plt
  plt.plot(days, mins)
  plt.title("나의 공부 기록")
  plt.show()
  ```
  말풍선: 「`chart`를 `plt`로 바꾸면 돼요. 꺾은선만 이름이 `line` → `plot`으로 달라요. 컴퓨터에 matplotlib을 설치하면 진짜 그림 창이 떠요.」

## 4. 말투와 용어

- 리아 교수: 존댓말 「~해요」체. 차분하고 가벼운 유머를 쓴다. 칭찬은 구체적으로 한다(「`elif`로 경우를 나눈 게 깔끔해요」). 실수를 부끄럽게 하지 않는다. 연애 느낌·친밀함을 넘는 표현은 금지(「오늘부터 1일」 같은 관용구도 금지).
- 용어집: str = **문자열**(「글자」 아님) · 변수 = 이름표 · 오류 = **단서** · 들여쓰기 · 반환값 · 매개변수 · 반복 · 인덱스 · 슬라이싱 · 메서드.
- 예시 소재: 카페, 편의점, 버스, 날씨, 용돈, 성적 같은 일상. 실존 인물, 실제 개인정보 형식(주민번호 등)은 쓰지 않는다.
- 문장은 새로 쓴다. Python 공식 튜토리얼이나 다른 책 문장을 옮기지 않는다.

## 5. 자주 지적된 것 체크리스트 (1~3장 검토)

- [ ] 하드코딩 답이 통과하지 않는다(일꾼이 `runner.run`으로 직접 확인)
- [ ] 문제·과제에 쓰는 함수와 문법은 모두 앞 장이나 이 레슨 카드에서 보여 준 것이다(기본 인자 동작 포함: 예 `round(x)`는 정수). 1~3장에서 `len`은 가르치지 않았다
- [ ] 「두 번 부르기」처럼 `require`로 셀 수 없는 조건은 과제로 내지 않는다(대신 매개변수와 입력을 바꿔 가며 시험)
- [ ] 숨은 시험에 경계값이 있다
- [ ] 과제 문장 = `require` 조건
- [ ] 과제에 예시 입출력이 있다
- [ ] 힌트 ③이 답을 주지 않는다
- [ ] 같은 개념에 같은 용어를 쓴다
- [ ] 해설의 기술 설명이 정확하다(오류 이름, 원인)
- [ ] 장 평가(x-5)가 그 장의 write 개념을 모두 다룬다(점검기가 확인)
- 정답이 첫 보기에 몰려도 괜찮다(화면이 섞음).

## 6. 작업 순서

1. 레슨 하나를 쓴다.
2. `python3 tests/content.py`를 실행해 그 장의 오류가 0이 될 때까지 고친다.
3. 다음 레슨으로 간다.
4. 다 쓰면 하드코딩 확인 결과와 함께 보고한다.
