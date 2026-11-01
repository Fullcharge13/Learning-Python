# 레슨 작성 가이드 (리아와 파이썬!)

레슨을 쓰는 일꾼은 **이 문서 + 커리큘럼 설계서의 해당 장 표 + 예시 레슨 1개**만 읽는다. 원 설계서, 실행 기록, 다른 장은 읽지 않는다. 판정 번호(C9 등)는 근거 표시일 뿐이다.

## 1. 파일과 형식

`data/lessons/chN.js`
```js
export const CHAPTER = { id: N, title: "장 제목" };
export const LESSONS = [ /* N-1 … N-5, N-5는 isExam: true */ ];
export const TEMPLATES = [ /* 매일 도전 틀 N-T1 …, 7절 (v0.9) */ ];
```
레슨 하나:
```js
{ id: "N-k", chapter: N, title, goal, summary: ["…","…","…"], isExam?: true, updated?: "v0.7.1",
  cards: [ { say, code, out, stdin? } ],          // 1~2장 (보강 레슨 1~3장)
  items: [ 터치 문제 4~6개(평가 4~8개, 보강 레슨 4~7개) → write 1개 → check 1개 ] }
```
| type | 필수 칸 | 선택 칸 |
|---|---|---|
| choice / check | concept, q, options(3~4), answer, explain | code, stdin, files, server |
| blank | concept, q, code(`___` 정확히 1개), chips(3~4), answer, explain | stdin, files, server |
| order | concept, q, lines(3~6, **정답 순서대로**), expect, explain | stdin, files, server |
| write | concept, task, starter, tests, require, hints(4), solution, explain | files, server |

카드도 `files`·`server`를 둘 수 있다. `files`·`server`는 3-1절.

- **`updated`(v0.7.1~)**: 이미 나간 레슨에 카드·문제를 보강했으면 `updated: "v0.7.1"`처럼 **그 판 이름 글자**(`v숫자.숫자` 또는 `v숫자.숫자.숫자`)를 적는다. 그 레슨을 이미 끝낸 학습자의 학습 길 노드에 「새 내용」 점이 뜨고, 다시 하기로 끝까지 마치면 사라진다. 다음 판에 또 보강하면 값을 새 판으로 바꾼다(점이 다시 뜬다). 새로 만드는 레슨에는 두지 않는다. 보강은 **더하기**다: 기존 카드·문제는 그대로 두고 새 카드 1장 + 문제 1~2개를 더한다. 그래서 `updated`가 있는 레슨은 카드 1~3장·터치 문제 4~7개까지 된다(판정 C48, 평가 레슨은 그대로 4~8개).

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

## 3-0. 본 과정 1~6장에서 쓸 수 있는 문법 (누적, v0.7.1)

점검기 `CHAPTER_RULES`가 정한다. 뒤 장은 앞 장 것을 모두 쓸 수 있다. 서식 지정자(`f"{x:.2f}"`)·여러 줄 문자열·기본값 매개변수·재귀·`for…else`·`match`·`divmod` 풀기, 리스트 컴프리헨션·lambda·맨 `raise`·`csv.writer`·이름 붙인 묶음 `(?P<…>)`·묶음 참조 `\1`·`\g<…>`(v0.8), `json.dump`·`json.load`·`__str__`·`__eq__`·`chart.legend`·한 그림에 꺾은선 여럿(v0.9)은 **본 과정에서는 언제나 오류**(심화 전용, 3-3절).

| 장 | 새로 쓸 수 있는 것 |
|---|---|
| 1장 | `print`만(변수·조건 없음). **f-문자열 `f"{3 * 4}개"`**(v0.7.1, `{}` 안에 값·계산만, 서식 지정자 없음) |
| 2장 | 변수·비교·`and`/`or`, `input`·`int`·`float`·`str`·`bool`·`type`, **`round(x)`·`round(x, n)`** |
| 3장 | `if`/`elif`/`else`, `a if c else b`, `len`·`abs`·`max`·`min`. 조건을 변수에 담기(`ok = a >= 60 and b >= 60`) |
| 4장 | `def`·`return`, **내 함수에 이름 붙여 넘기기 `price(won=5000)`**, 함수 안에서 다른 함수 부르기 |
| 5장 | `for … in range(…)`·`while`·`break`·`continue`, 반복 안의 반복, **`print(…, end=" ")`**(v0.7.1부터 5장 전에는 오류), **`n += 1`·`n -= 1`**(v0.9, 5-1 보강에서 배움 — 2~4장에서는 오류, `n = n + 1`로). `print`의 다른 이름 붙은 인자(`sep=` 등)는 쓰지 않는다 |
| 6장 | 인덱스·슬라이싱, 문자열 메서드(`upper`·`strip`·`split`… **`zfill`·`center`·`ljust`·`rjust`**), 문자열·`split()` 결과를 `for`로 돌기 |

## 3-1. 파일·연습 서버·import (11~14장)

- **files** (11장~): `{"memo.txt": "우유\n빵\n"}` 이름 → 내용(문자열). 실행마다 빈 폴더에 이 파일들을 만들고 그 폴더에서 돈다. 이름은 폴더 없는 파일 이름(`/` `\` 없음, `.`으로 시작 안 함, 40자 이하), 1~5개. 쓰기도 그 폴더 안에서만 되고 실행이 끝나면 지워진다(다음 실행에 남지 않음).
- write의 시험마다 `files`를 따로 둘 수 있다(`{ stdin, expect, public, files }`, 없으면 문제의 `files`). 시험별 `files`가 있으면 input이 없어도 시험 2~4개 — 파일 내용을 바꾼 숨은 시험으로 하드코딩을 막는다.
- **server** (13장~): `{"https://ria.example/menu": {"status": 200, "body": "…", "type": "text/html"}}` 주소 → 응답. status는 100~599 정수, body는 문자열, type은 선택. 실행 동안 `urllib.request.urlopen`이 이 표로 답한다. 표에 없는 주소는 `URLError`, status 400 이상은 `HTTPError`. 실제 인터넷은 쓰지 않는다.
- **주소 규칙**: 연습 서버 주소는 언제나 `https://ria.example/…`(실존 사이트 주소 금지). 경로는 짧게(`/menu`, `/bus?stop=101`).
- **import**: 장마다 정해진 모듈만(누적). 11장 `csv` · 12장 `re` · 13장 `urllib.request`·`urllib.parse`·`urllib.error` · 14장 `json`. 그 밖의 모듈(`os`, `sys`, `requests` …)은 오류. 본 과정 11장의 `csv`는 `reader`만(`csv.writer`는 11장 심화 전용, v0.8). 모듈에서 쓸 수 있는 이름과 `open()`의 모드(`"r"`·`"w"`·`"a"`만, `encoding=`·`newline=` 허용)는 `tests/content.py`의 `MODULE_MEMBERS`·`CALL_KWARGS`가 정한다.
- **38칸**: `urllib.request.urlopen("https://ria.example/x")`는 한 줄에 안 들어간다. `from urllib.request import urlopen`과 `url = "…"` 변수로 나눈다.
- **JSON 출력(14장)**: 딕셔너리를 통째로 `print`하거나 `json.dumps`를 그냥 출력하지 말고 **특정 값을 꺼내 출력**한다. 꼭 dumps 결과를 보여야 하면 `sort_keys=True`, `indent=2`, `ensure_ascii=False`를 명시해 키 순서·공백이 하나로 정해지게 하고, 과제 문장에도 그 인자를 적는다.
- **정규표현식(12장)**: 패턴 글자를 채점하지 말고 **출력**을 채점한다. 맞는 패턴이 여러 개(`\d+`·`[0-9]+`)일 수 있으므로 시험 데이터는 어느 맞는 패턴에도 같은 출력이 나오게 고르고, blank 오답 칩은 실제로 다른 출력이나 오류를 내야 한다. 패턴은 `r"…"`로 쓴다.

## 3-2. 객체지향·SQL·차트 (15~17장)

- **import(누적)**: 15장 새 모듈 없음 · 16장 `sqlite3`(이름은 `connect`만) · 17장 `chart`(앱이 주는 모듈, `bar`·`line`·`title`·`xlabel`·`ylabel`·`show`만, 이름 붙은 인자 없음. `legend`는 17장 심화 전용).
- **15장 class**: `class Dog(Pet):`처럼 **이 코드에서 만든 클래스 하나만** 물려받는다(`object`·`Exception`·여러 클래스·`metaclass=` 금지). 데코레이터(`@…`) 금지. 특수 메서드는 본 과정에서 `__init__`만(v0.9: `__str__`·`__eq__`는 15장 심화 전용 — 본 과정에 쓰면 「심화 전용」 오류. 다른 `__이름__`은 심화에서도 정의·`obj.__dict__`처럼 점 뒤에 쓰기 모두 금지). `super().__init__(…)`, `isinstance(x, Pet)`, 클래스 변수(`kind = "동물"`)는 된다. 컴프리헨션·lambda는 여전히 금지.
- **self 빠뜨림 설명**: `def bark():`로 쓰고 `d.bark()`를 부르면 `TypeError: Dog.bark() takes 0 positional arguments but 1 was given`이 난다. 해설은 쉬운 말로: 「`d.bark()`라고 부르면 Python이 `d`를 첫 번째 값으로 몰래 넘겨요. 받을 자리(`self`)가 없어서 『0개 받는데 1개가 왔다』는 단서가 나와요. 메서드의 첫 매개변수는 언제나 `self`예요.」 이런 틀린 예는 점검기가 막지 않으므로 choice 문제의 code로 쓸 수 있다(정답 보기에 「오류」).
- **클래스와 객체 혼동**: `Dog`(설계도)와 `d = Dog("초코")`(만든 물건)를 말로 구분한다. 「클래스 = 붕어빵 틀, 객체 = 붕어빵」처럼 한 번 비유하고 용어를 바꾸지 않는다.
- **16장 sqlite3**: 언제나 `sqlite3.connect(":memory:")` — 인자는 이 글자 하나만(변수·파일 이름·이름 붙은 인자는 점검기 오류). 실행마다 새 빈 DB이므로 코드 안에서 `CREATE TABLE` → `INSERT` → `SELECT` 순서로 다 한다. 연결·커서에는 `cursor`·`execute`·`executemany`·`fetchall`·`fetchone`·`commit`·`close`만 쓴다(`executescript` 등 금지). SQL 글 자체는 점검기가 보지 않으니 직접 실행해 확인한다.
- **ORDER BY**: 여러 줄이 나오는 `SELECT`의 출력을 채점하거나 보기로 비교하면 **반드시 `ORDER BY`**를 붙인다(없으면 순서가 우연에 기댐). `GROUP BY` 집계도 `ORDER BY`를 함께 쓴다.
- **`?` 자리 표시**: 값은 SQL 글에 f-문자열·`+`로 끼워 넣지 않고 `cur.execute("… WHERE y > ?", (2020,))`처럼 `?`와 튜플로 넘긴다(값 하나도 `(값,)` 쉼표). 16-4에서 「글을 이어 붙이면 위험해요(SQL 주입)」를 한 줄로 말한다.
- **17장 차트**: `chart.bar(이름들, 값들)`/`chart.line(…)` → `chart.title`·`xlabel`·`ylabel` → `chart.show()`. `show()`가 없으면 그림이 없다. **본 과정은 한 그림에 막대·꺾은선 하나만**(꺾은선을 `show` 없이 두 번 부르면 실행은 되지만 점검기가 「본 과정 레슨에서는 한 그림에 꺾은선 하나만」 오류), 한 실행에 그림 3개까지, 한 그림 점 24개까지. 이름과 값의 개수가 다르면 `ValueError`.
- **여러 선(17장 심화, v0.9)**: 같은 이름들로 `chart.line`을 **최대 3번** 부르고 `chart.legend(["철수", "영희"])`(선 그린 차례대로, line 앞뒤 어디서 불러도 됨) → `show()` 한 번. 이름들(가로축)이 첫 선과 다르면 `ValueError("선마다 이름(가로축)이 같아야 해요")`, 4번째 선·막대 두 번·막대와 꺾은선 섞기·legend 개수가 선 수와 다름·막대에 legend는 모두 한국어 `ValueError`. 그림 모양은 선이 둘 이상이거나 legend가 있으면 `values` 대신 `series`:
  ```js
  chart: { kind: "line", labels: ["월", "화", "수"], title: "공부 시간",
           series: [{ name: "철수", values: [3, 5, 4] }, { name: "영희", values: [1, 2, 6] }] }
  ```
  채점은 선 수·차례·값, `name`을 적으면 이름까지(안 적으면 이름은 보지 않음). 화면은 선마다 색 + 점선 모양 + 점 모양(원·네모·세모)이 다르고 제목 아래 이름표 한 줄, 값 글자는 생략(글 설명에 모두 있음). legend가 없으면 이름표는 「선 1·선 2」. matplotlib 대응은 `plt.plot` 두 번 + `plt.legend(["…", "…"])`(show_only 카드).
- **차트 채점(`chart` 칸)**: write의 시험과 터치 문제에 선택 칸 `chart: {"kind": "bar"|"line", "labels": [...], "values": [...], "title"?, "xlabel"?, "ylabel"?}`을 둔다. 적힌 칸만 비교하고, 값은 숫자로 비교한다(`3`과 `3.0`은 같음). 출력(`expect`)과 차트를 둘 다 맞혀야 통과한다. 하드코딩을 막으려면 `require`에 `Method:bar`처럼 쓰고, 값은 리스트·딕셔너리에서 계산해 넣게 한다.
- **matplotlib 비교 카드(17-5, 판정 C38)**: 카드에 `show_only: true`를 두면 코드를 **실행하지 않고 보여 주기만** 한다(화면에 「실제 컴퓨터용 코드(여기서는 실행 안 함)」 표시, 출력 칸 없음). 그래서 주석이 아닌 진짜 코드로 쓴다. 점검기는 너비(38칸)만 보고, `out`은 없거나 `""`, stdin·files·server·chart는 같이 쓸 수 없다. 카드에만 쓸 수 있다. 예:
  ```python
  import matplotlib.pyplot as plt
  plt.plot(days, mins)
  plt.title("나의 공부 기록")
  plt.show()
  ```
  말풍선: 「`chart`를 `plt`로 바꾸면 돼요. 꺾은선만 이름이 `line` → `plot`으로 달라요. 컴퓨터에 matplotlib을 설치하면 진짜 그림 창이 떠요.」

## 3-3. 심화 레슨(v0.7~)

- **자리**: 같은 장 파일 `data/lessons/chN.js`에 목록을 하나 더 둔다. 본 과정 `LESSONS`는 건드리지 않는다.
  ```js
  export const ADVANCED = [ /* N-A1, N-A2, N-A3 */ ];
  ```
  레슨 하나는 본 과정과 같은 모양(카드 1~2 + 터치 4~6 → write 1 → check 1)에 `id: "N-A1"`·`isAdvanced: true`를 더한다. **`isExam`은 두지 않는다**(심화에는 평가가 없다). 정확히 3개, id는 파일 안 순서대로 `N-A1`~`N-A3`.
- **A3은 응용 과제**: A1·A2에서 배운 것을 묶은 작은 프로그램(영수증, 요금표, 구구단 표 …). 주제는 심화 설계서의 장별 표를 따른다. 개념(`concept`)은 `data/concepts.js`의 심화 개념(`advanced: true`)이나 그 장까지의 본 과정 개념을 쓰고, A3은 A1·A2 개념을 다시 쓴다. 심화 개념은 본 과정 레슨에 쓰면 점검기 오류다.
- **쓸 수 있는 문법** = N장 본 과정 규칙 + 심화 1~N장이 연 문법(누적). 심화 문법은 본 과정 레슨에서는 언제나 오류다.

  | 심화 | 새로 여는 것(점검기 이름) | 이미 본 과정에서 되는 것 |
  |---|---|---|
  | 1장 | f-string 서식 지정자 `f"{3.14159:.2f}"`·`f"{'커피':>6}"`·`f"{4500:,}"`(FormatSpec, 지정자 안 `{…}` 금지), 여러 줄 문자열 `"""…"""`(TripleQuote). 변수는 아직 없으니 값을 직접 넣는다 | f-문자열 `f"{3 * 4}개"`(v0.7.1, 1-2) |
  | 2장 | `divmod(a, b)`, 그 결과 풀기 `h, m = divmod(t, 60)`만(튜플 일반은 9장) | `round(x, 2)`(2-2), `//`·`%` |
  | 3장 | `match`/`case`: 글자·숫자·`None`/`True`/`False` 값, `"a" \| "b"`, `case _:`. 이름 잡기(`case x:`)·`case … if …`·목록/사전/클래스 패턴은 금지 | `and`·`or`·`not`, `3 < x < 7`, `a if c else b` |
  | 4장 | 기본값 매개변수(DefaultArg, 숫자·문자열·True/False/None 상수만), 재귀(Recursion) | 내 함수에 이름 붙여 넘기기 `f(b=1)` |
  | 5장 | `for … else`·`while … else`(LoopElse) | 중첩 반복, `break`·`continue`, `print(…, end=" ")` |
  | 6장 | 새 문법 없음 | `center`·`ljust`·`rjust`·`zfill`·`count`·`title`·`capitalize`·`startswith`·`endswith`·`"-".join("abc")`, 채우기 서식 `f"{s:*^9}"`(1장 심화) |
  | 7장 (v0.8) | 리스트 컴프리헨션 `[n * 2 for n in a if n > 2]`(ListComp): **for 하나, if 0~1개**(조건 여럿은 `and`), 컴프리헨션 안에 컴프리헨션 금지. 2차원은 `[[0] * 3 for r in range(2)]`처럼 | 리스트 안 리스트 `a[1][0]`(7-1), `for i in range(len(a))`(7-2), for + if + append(7-3) |
  | 8장 | 새 문법 없음 | `d.get(k, 0) + 1`(8-4), `d[k] = []`·`d[k].append(x)`(8-2), `for k, v in d.items()` |
  | 9장 | `lambda`(Lambda): **함수에 넘기는 자리에서만** `sorted(ps, key=lambda p: p[1])`·`a.sort(key=lambda s: len(s))`. `f = lambda …`·`return lambda …` 금지(이름에 담을 함수는 `def`) | `sorted(…, key=함수 이름)`·`reverse=True`(9-3), `^`·`<=`·`discard`(본 과정 문법이지만 9-A2가 가르침), `add`·`in`(9-4) |
  | 10장 | 맨 `raise`(Reraise): **except 안에서만** 잡은 오류를 다시 던짐. `raise … from …`은 어디서나 금지 | `raise ValueError(f"…")`, `except … as e`, `try/except/else/finally`(10-3·10-4), `while True` 안 try(10-2) |
  | 11장 | `csv.writer(f)`(CsvWriter) → `writerow([…])`·`writerows([[…]])`, 쓸 때도 `newline=""` | `csv.reader`, `open(name)` 변수 이름으로 열기(11-3), `"w"`·`"a"` |
  | 12장 | 이름 붙인 묶음 `(?P<h>\d+)`·`m.group("h")`·`m.groupdict()`(RegexNamedGroup), 묶음 참조 `\1`·`\g<h>`·`(?P=h)`(RegexBackref) | `( )`·`group(1)`(12-3), `findall` + `( )` → 튜플(12-3), `re.sub`(12-4) |
  | 13장 (v0.9) | 새 문법 없음 | 쿼리 붙이기 `base + "?page=" + str(n)`, `parse_qs`(13-1), `e.code`·`r.status`(13-2), `while True` 안 try·`break`, `urlencode`(점검기는 허용, 가르침은 14-4) |
  | 14장 | `json.dump(d, f)`·`json.load(f)`(JsonFile, `dump`는 `ensure_ascii`·`indent`·`sort_keys`만, `load`는 이름 붙은 인자 없음) | `json.dumps`·`loads`, `f.write(json.dumps(…))`·`json.loads(f.read())` |
  | 15장 | `__str__`·`__eq__`(DunderStr·DunderEq) — 정의와 점 뒤 쓰기. `__repr__`·`__lt__`·`__hash__` 등은 계속 금지 | 클래스 속성 `Book.count = Book.count + 1`, `self.items = []`, 객체 리스트 for(15-2·15-3 보강) |
  | 16장 | 새 문법 없음(SQL 글은 점검기가 안 봄) | `JOIN … ON`·`GROUP BY … HAVING`은 SQL 글이라 그대로 씀, `executescript`는 계속 금지 |
  | 17장 | `chart.legend([...])`(ChartMulti) + 한 그림에 꺾은선 최대 3개(3-2절) | `chart.line`·`title`·`xlabel`·`ylabel`·`show`, 한 그림 점 24개·한 실행 그림 3개 |

  사전·집합 컴프리헨션(`{k: v for …}`·`{x for …}`)과 제너레이터 식(`sum(x for …)`)은 심화에서도 늘 금지(가르치지 않음). 12장 심화 문법은 **re를 들여온 코드의 모든 글자 상수**를 보므로 패턴을 변수에 담아도 잡힌다. 메서드(`writerow`·`discard`)는 점검기가 막지 못하니 본 과정 레슨에 쓰지 않는다.
- **심화 채점 조건(require, v0.9)**: `Def:__str__`·`Def:__eq__`(그 이름의 def가 있음) — `__str__`은 `print`가 몰래 불러 `Method:`로 셀 수 없고 `print(b.title)`로 풀어도 같은 출력이 나오므로 15-A1 write에 꼭 넣는다. `SQL:JOIN`·`SQL:HAVING`(코드의 글자 상수 안에 그 낱말, 대소문자 무시·낱말 단위, 주석은 아님. require에는 대문자로 적음) — 두 번 SELECT해 파이썬에서 합쳐도 같은 출력이 나오므로 16-A1·A2 write에 넣는다. 화면 말: 「…__str__ 메서드를 만들어서 풀어야 해요」, 「…SQL에 JOIN을 써서 풀어야 해요」. `json.dump`는 `Method:dump`, 여러 선은 시험의 `chart` 칸(series 2개)으로 충분.
- **심화 채점 조건(require, v0.8)**: `ListComp`·`Lambda`는 ast 마디 이름 그대로 쓴다. 12장 이름 붙인 묶음은 `NamedGroup`(글자 상수 안에 `(?P<`가 있음) — `group(1)`로 풀어도 같은 출력이 나오므로 A1 write에는 꼭 넣는다. 10장 맨 `raise`는 `Reraise`(except 블록 안에 `raise` 한 단어가 있음) — `raise ValueError(e)`·`raise e`로 새로 던져도 같은 출력이 나오므로 10-A2 write에 넣고 과제 문장에 「raise 한 단어로 다시 던지고」라고 쓴다.
- **「안다고 가정하지 않음」(7~12장 심화, 디딤돌 조사 4절)**: 학습자는 1~6장 심화를 건너뛰었을 수 있다. 서식 지정자 `:>5`·`:.1f`(→ `round`·`zfill`·`center`), `"""…"""`, `divmod`, **`a if c else b`**, `match`, 기본값 매개변수·재귀, `for…else`, **`join`·`ljust`·`rjust`·`title`**은 **그 심화 레슨이 직접 가르치지 않으면 쓰지 않는다**(점검기는 허용하지만 본 과정에서 안 가르침). `+=`·`-=`는 **5-1 보강(v0.9)에서 배움** — 5장부터 써도 된다(2~4장은 점검기 오류, `total = total + x`로).
  - **7장**: `enumerate`·`zip`·`list(range(…))` 없음(점검기 오류). A1은 7-3의 긴 모양 바로 옆에 한 줄 모양을 둔다. 2차원은 7-1 맛보기 `a[1][0]`에서 잇는다.
  - **8장**: `sorted(d.items(), key=…)`는 9장이라 쓰지 않음(출력은 넣은 순서). `max(d, key=…)` 대신 반복 + `if`. 컴프리헨션(7-A1)도 가정 안 함.
  - **9장**: lambda는 9-3의 `def get_count(pair): return pair[1]`을 한 줄로 바꾸며 시작. `max`/`min`의 `key=`·`.sort(key=)`는 쓰면 카드로 보여 준다. 집합은 `add`·`in`까지만 가정.
  - **10장**: `isdigit()`·**`except (A, B):`** 가정 안 함(쓰려면 그 카드에서 가르침). 맨 `raise`·겹친 try·try 안 `return`과 `finally`의 순서는 A2가 정확히 설명.
  - **11장**: 가상 파일 최대 5개. `FileNotFoundError`를 try로 잡는 것은 처음이라 쓰면 카드로. `",".join`·`readlines` 없음. 빈 줄 건너뛰기는 A3 카드에서.
  - **13~17장(v0.9)**: 1~12장 심화를 건너뛴 학습자 기준 — 서식 지정자·`"""`·컴프리헨션·lambda(→ `def` 함수 이름)·`join`·`extend`·`isinstance`·`is None`(→ `if 값:`)은 쓰지 않는다.
    - **13장 연습 서버**: 주소 글자가 **정확히 같을 때만** 답한다(쿼리 순서까지). 상태가 없어 같은 주소는 늘 같은 답(「503이면 다시 시도」는 성공하지 않음 → 다른 주소로). 한 문제 서버 표 **최대 8개**, 시험마다 따로 둘 수 없으니 숨은 시험은 stdin으로 다른 주소·값을 고르게. 쿼리 값은 영문·숫자만. A3은 `?page=` 늘리기 + 404에서 멈추기(3~4쪽).
    - **14장**: 멈출 때를 데이터(`"next": null`·`"pages"`)로 안다. 파일은 실행이 끝나면 사라지니 같은 실행에서 쓰고 읽는다. JSON을 보여 줄 때는 `sort_keys=True`·`indent=2`·`ensure_ascii=False`를 모두 적는다. 평균은 `round(…, 1)`.
    - **15장**: `print(객체)`의 기본 출력 `<__main__.Book object at 0x…>`는 **주소가 실행마다 달라** 카드 `out`·보기·기대 출력에 쓰지 않는다(말로만). `print([b1, b2])`도 `__repr__`이라 주소가 나옴 → for로 하나씩. `__eq__`를 정의한 객체는 집합·딕셔너리 열쇠로 쓰지 않는다. `__eq__` 안에 `isinstance` 없이 같은 클래스끼리만 비교.
    - **16장**: 여러 줄 결과는 `ORDER BY` 필수(JOIN·GROUP BY 포함, 같은 값이면 둘째 기준까지). INNER JOIN만. `AVG`는 파이썬 `round`. `AS`·`ROUND()`·하위 질의는 쓰지 않거나 카드로. 표 내용은 시험마다 다른 CSV(`files`) + `require`의 `SQL:JOIN`/`SQL:HAVING`.
    - **17장**: 한 그림 점 **24개까지**(`CHART_POINTS_MAX`), 한 실행 그림 **3개까지**, 선 **3개까지**. 한 달 31일은 그대로 못 그리니 주별(`(day - 1) // 7`)·종류별로 묶는다. 앞 몇 개는 7-4 보강의 리스트 슬라이싱 `a[:3]`.
  - **12장**: 바꿀 글에도 `r"…"`. `\s`·`\b`·`^`·`$`·`[^…]`·`re.split`·`re.compile`은 본 과정에 없음 → 쓰면 카드로. 다른 바른 패턴(`[0-9]+`)도 같은 출력이 나오게 시험을 고른다.
- **직접 작성 시간**: 심화 정답은 시험마다 **1초 안에** 끝나야 하고, 재귀는 **100단계 안에서** 끝나야 한다(휴대폰 3초 제한·스택 여유, 점검기가 잰다). 재귀 예시는 `fact(5)`, 자릿수 합처럼 작은 수로.
- **말투**: 리아가 첫 카드에서 「한 걸음 더」 가 보는 선택 레슨이라고 알린다(예: 「여기는 한 걸음 더 가 보는 곳이에요. 몰라도 다음 장은 열려 있어요.」). 본 과정 내용을 다시 설명하지 않고 바로 새 것으로 간다. 나머지 글자 수·문제 규칙·하드코딩 막기는 본 과정과 같다.

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

## 7. 매일 도전 틀 `TEMPLATES` (v0.9, 판정 C54)

「오늘의 도전」의 터치 문제 2개는 장 파일의 **틀**에 값을 바꿔 끼워 매일 새로 만든다(직접 작성 1개는 끝낸 레슨의 write 문제를 그대로 씀, C53 — 틀로 만들지 않는다). 틀을 쓰는 일꾼은 이 절과 3-0절(장별 문법)만 보면 된다. 엔진: `src/template.js`, 점검: `python3 tests/content.py`(틀이 있으면 늘 검사, `--templates N`이면 1~N장에 장마다 4개 이상 필요).

```js
export const TEMPLATES = [
  { id: "1-T1", concept: "arith", type: "choice",
    q: "화면에 무엇이 출력될까요?",
    code: "print({A} + {B} * {C})",
    wrong: ["print(({A} + {B}) * {C})", "print({A} + {B} + {C})"],   // 오답 「코드」 2~3개
    vars: { A: { min: 2, max: 9 }, B: { min: 3, max: 9 }, C: { min: 2, max: 5 } },
    explain: "곱셈이 먼저예요. {B} * {C} 먼저, 그다음 {A} 더하기 → {OUT}" },
  { id: "1-T2", concept: "arith", type: "blank",
    q: "{FOOD} {N}개를 {K}명이 똑같이 나누고 남는 개수가 나오게 빈칸을 채워 보세요.",
    code: "print({N} ___ {K})", chips: ["%", "//", "/"], answer: 0,
    vars: { FOOD: ["사탕", "귤", "쿠키"], N: { min: 13, max: 29 }, K: { min: 3, max: 6 } },
    explain: "남는 개수는 나머지 % 로 구해요." },
];
```

| 칸 | 뜻 |
|---|---|
| `id` | `N-T1`, `N-T2` … (장 번호 + T + 번호). 한 번 정하면 바꾸지 않는다(학습자 저장에 남음) |
| `concept` | 본 과정 개념 id(그 장까지). 심화 개념은 안 됨. 복습 가중에 쓰임 |
| `type` | `choice` 또는 `blank` (order·write 틀은 없음) |
| `q` · `explain` | 문제 80자 · 해설 160자(값을 끼운 뒤 길이). `{OUT}`(정답 출력) 쓸 수 있음 |
| `code` | 보여 줄 코드. choice는 정답 코드, blank는 `___` 정확히 하나 |
| `wrong` (choice) | 오답 코드 2~3개. **보기는 코드들을 실제로 돌린 출력**(오류면 「오류가 나요」). 정답 보기는 언제나 `code`의 출력 |
| `chips` · `answer` (blank) | 칩 3~4개와 정답 칩 번호. 오답 칩을 넣은 코드는 오류이거나 정답과 다른 출력이어야 함 |
| `vars` | `{ 이름: [값, …] }`(2~40개, 글자 또는 정수) 또는 `{ 이름: { min, max } }`(정수, min < max). 1~6개 |
| `stdin` (선택) | `input()` 입력. `"{A}\n{B}"`처럼 자리 표시 가능(2장부터) |

**자리 표시 규칙**
- `{대문자}`만 바뀐다(`{A}`, `{NAME}`, `{N_2}`). 코드의 변수는 소문자로 쓰므로 헷갈리지 않는다. f-문자열의 `{x}`·`{3 * 2}`는 그대로 둔다.
- f-문자열 안에서 값을 계산하려면 바깥 중괄호를 그대로 쓴다: `f"{FRUIT} {{N} * {P}}원"` → `f"사과 {3 * 1200}원"`.
- 글자 값은 코드에 따옴표와 함께 넣는다: `name = "{NAME}"`. 값 자체에는 따옴표·역슬래시·중괄호·줄바꿈을 넣지 않는다.
- `OUT`은 예약 이름(값 이름으로 못 씀). `q`·`explain`에서만.
- 선언한 값은 어딘가에 꼭 쓴다(안 쓰면 오류). 문제 문장에만 쓰는 값(예: `FOOD`)도 된다.
- **숫자 뒤 조사 금지**: `{N}을`/`{N}를`은 숫자 읽기에 따라 틀린다. `{N}개를`, `{N}명이`처럼 단위를 붙이거나 조사 없는 문장으로 쓴다.

**점검기가 보는 것** (씨앗 0~99 각각, 앱도 이 100가지만 냄)
1. 값을 끼운 코드를 실제로 돌린다(한 번에 1초 안). 정답 코드가 오류면 틀 오류.
2. choice 보기는 한 줄 출력, 비어 있지 않음, 30칸(한글 2칸) 이하, 서로 모두 다름. blank는 정답 칩만 그 출력.
3. 보기가 우연히 겹치면(예: `15 % 4`와 `15 // 4`가 둘 다 3) 같은 씨앗의 다음 「시도」로 값을 다시 뽑는다. 5번 안에 안 겹치는 값이 나와야 한다(늘 겹치면 오류). 다시 만든 수는 점검 결과 줄에 나온다 — 많으면 값 범위를 고친다.
4. 코드 한 줄 38칸, 그 **장의 본 과정 문법**(3-0절 표). 서식 지정자·컴프리헨션 같은 심화 문법은 쓰지 않는다.
5. 값을 끼운 `q`·`explain`의 길이와 한국어.

**잘 만든 틀**: 오답 코드는 그 개념에서 실제로 하는 실수(괄호 없이 계산 순서, f 빠뜨림, 글자와 숫자 혼동, 변수 이름에 따옴표). 값 범위는 오답이 정답과 거의 겹치지 않게(예: `A + B * C`와 `A + B + C`는 B·C가 2이면 같아지므로 B를 3부터).
