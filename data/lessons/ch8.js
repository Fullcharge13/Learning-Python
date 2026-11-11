// 8장 「딕셔너리」 레슨 표 (커리큘럼 초안 2장). 점검: python3 tests/content.py
// 8장 규칙: 딕셔너리 리터럴, d[키], d[키] = 값, in, get·keys·values·items. 튜플은 for k, v in d.items(): 의 풀기만(튜플은 9장).
// += 는 아직 없다(d[w] = d.get(w, 0) + 1 로 쓴다). 컴프리헨션·집합·튜플 리터럴 금지.
export const CHAPTER = { id: 8, title: "딕셔너리" };

export const LESSONS = [
  {
    id: "8-1", chapter: 8, title: "키와 값",
    goal: "딕셔너리를 만들고 키로 값을 꺼낼 수 있다",
    summary: [
      "{키: 값} 으로 찾는 말과 값을 짝지음",
      "꺼낼 때는 menu[키], 없는 키는 KeyError",
      "출력은 {'라떼': 4000} 모양",
    ],
    cards: [
      {
        say: "딕셔너리는 키(찾는 말)와 값을 짝지어 담는 통이에요. 중괄호 안에 키: 값 을 쉼표로 이어 쓰고, 꺼낼 때는 menu[키]라고 해요. 리스트는 번호로, 딕셔너리는 이름으로 찾아요.",
        code: "menu = {\"라떼\": 4000, \"모카\": 4500}\nprint(menu[\"모카\"])",
        out: "4500",
      },
      {
        say: "딕셔너리를 통째로 찍으면 {'라떼': 4000} 처럼 보통 작은따옴표로 나와요. 없는 키를 부르면 KeyError 단서가 나오고, 단서에 찾으려던 키가 적혀 있어요.",
        code: "menu = {\"라떼\": 4000}\nprint(menu)",
        out: "{'라떼': 4000}",
      },
    ],
    items: [
      {
        type: "choice", concept: "dict",
        q: "화면에 무엇이 출력될까요?",
        code: "menu = {\"라떼\": 4000, \"모카\": 4500}\nprint(menu[\"라떼\"])",
        options: ["4000", "4500", "라떼"],
        answer: 0,
        explain: "menu[\"라떼\"]는 라떼 짝의 값을 꺼내요. 값은 4000이라서 4000이 찍혀요.",
      },
      {
        type: "choice", concept: "dict",
        q: "이 코드를 실행하면 어떤 단서(오류)가 나올까요?",
        code: "menu = {\"라떼\": 4000}\nprint(menu[\"모카\"])",
        options: ["KeyError", "IndexError", "NameError"],
        answer: 0,
        explain: "딕셔너리에 없는 키를 부르면 KeyError예요. IndexError는 리스트의 번호가 넘쳤을 때 나와요.",
      },
      {
        type: "blank", concept: "dict",
        q: "모카의 가격 4500이 찍히게 빈칸을 채워 보세요.",
        code: "menu = {\"라떼\": 4000, \"모카\": 4500}\nprint(menu[___])",
        chips: ["\"모카\"", "모카", "4500"],
        answer: 0,
        explain: "키가 문자열이라서 따옴표로 감싸야 해요. 따옴표가 없으면 변수 이름으로 읽어 NameError, 4500은 키가 아니라서 KeyError예요.",
      },
      {
        type: "choice", concept: "dict",
        q: "화면에 무엇이 출력될까요?",
        code: "price = {\"라떼\": 4000}\nprint(price)",
        options: ["{'라떼': 4000}", "{\"라떼\": 4000}", "라떼: 4000"],
        answer: 0,
        explain: "딕셔너리를 통째로 찍으면 작은따옴표와 중괄호가 그대로 나와요. 파이썬은 문자열을 보통 작은따옴표로 보여 줘요.",
      },
      {
        type: "order", concept: "dict",
        q: "라떼 가격 4000이 찍히게 줄을 놓아 보세요.",
        lines: ["menu = {\"라떼\": 4000, \"모카\": 4500}", "p = menu[\"라떼\"]", "print(p)"],
        expect: "4000",
        explain: "딕셔너리를 먼저 만들고, 값을 꺼내 p에 담고, 마지막에 찍어요. 만들기 전에 꺼내면 NameError예요.",
      },
      {
        type: "write", concept: "dict",
        task: "딕셔너리 menu를 만드세요(아메리카노 3000, 라떼 4000, 모카 4500). 메뉴 이름을 input()으로 받아(괄호는 비워 두세요) menu[이름]으로 가격을 출력해요. 예: 라떼를 입력하면 4000",
        starter: "name = input()\n",
        tests: [
          { stdin: "라떼", expect: "4000", public: true },
          { stdin: "아메리카노", expect: "3000", public: false },
          { stdin: "모카", expect: "4500", public: false },
        ],
        require: ["Dict", "Subscript", "Name:menu"],
        hints: [
          "입력한 메뉴 이름에 해당하는 가격 하나를 찍어요. 예시에서 라떼를 입력하면 왜 4000일까요?",
          "딕셔너리는 {키: 값}으로 만들고 menu[키]로 꺼내요. 키 자리에 입력한 변수를 쓸 수 있어요.",
          "메뉴 세 개를 키와 값으로 짝지어 menu에 담고, 입력받은 name을 키로 써서 꺼내 찍어요.",
          "menu = {\"아메리카노\": ___,\n        \"라떼\": 4000, \"모카\": 4500}\nname = input()\nprint(menu[___])",
        ],
        solution: "menu = {\"아메리카노\": 3000,\n        \"라떼\": 4000, \"모카\": 4500}\nname = input()\nprint(menu[name])",
        explain: "키로 값을 바로 꺼내는 게 딕셔너리의 장점이에요. if를 길게 늘어놓지 않고 한 줄로 찾았어요.",
      },
      {
        type: "check", concept: "dict",
        q: "menu에 없는 키 \"쿠키\"로 menu[\"쿠키\"]를 부르면?",
        options: ["KeyError 단서가 나온다", "None이 찍힌다", "0이 찍힌다"],
        answer: 0,
        explain: "[ ]로 꺼낼 때 키가 없으면 KeyError로 멈춰요. 오류 없이 꺼내는 방법은 곧 배우는 get이에요.",
      },
    ],
  },
  {
    id: "8-2", chapter: 8, title: "추가와 수정",
    goal: "값을 넣고 바꾸고 in으로 확인할 수 있다",
    summary: [
      "d[키] = 값: 없으면 추가, 있으면 교체",
      "키는 겹치지 않음, 같은 키는 하나뿐",
      "키 in d 는 키만 확인, 빈 통은 {}",
      "값이 리스트면 d[k].append(값)",
    ],
    updated: "v0.8",
    cards: [
      {
        say: "d[키] = 값 이라고 쓰면 키가 없을 땐 새로 추가하고, 이미 있으면 값을 바꿔요. 키는 하나뿐이라 같은 키로 또 넣으면 앞의 값이 사라져요.",
        code: "stock = {\"사과\": 3}\nstock[\"배\"] = 5\nstock[\"사과\"] = 10\nprint(stock)",
        out: "{'사과': 10, '배': 5}",
      },
      {
        say: "키 in 딕셔너리 는 그 키가 있는지 True나 False로 알려 줘요. 값이 아니라 키만 봐요. 빈 딕셔너리는 {} 로 만들어요. not in은 없는지 물어요.",
        code: "stock = {}\nstock[\"사과\"] = 3\nprint(\"사과\" in stock)\nprint(3 in stock)",
        out: "True\nFalse",
      },
      {
        say: "값이 리스트인 딕셔너리도 있어요. 처음 보는 키면 먼저 빈 리스트를 만들어 두고, 그다음 scores[키].append(값)으로 쌓아요.",
        code: "scores = {}\nif \"민지\" not in scores:\n    scores[\"민지\"] = []\nscores[\"민지\"].append(90)\nprint(scores)",
        out: "{'민지': [90]}",
      },
    ],
    items: [
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "stock = {\"사과\": 3}\nstock[\"배\"] = 5\nprint(stock)",
        options: ["{'사과': 3, '배': 5}", "{'사과': 3}", "{'배': 5}"],
        answer: 0,
        explain: "없는 키에 값을 넣으면 새 짝이 뒤에 붙어요. 원래 있던 사과 짝은 그대로예요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "stock = {\"사과\": 3}\nstock[\"사과\"] = stock[\"사과\"] + 2\nprint(stock[\"사과\"])",
        options: ["5", "3", "2"],
        answer: 0,
        explain: "오른쪽에서 먼저 3 + 2 = 5를 계산하고, 그 값을 같은 키에 다시 넣어요. 그래서 5로 바뀌어요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "stock = {\"사과\": 3}\nprint(3 in stock)",
        options: ["False", "True", "KeyError"],
        answer: 0,
        explain: "in은 값이 아니라 키를 찾아요. 3은 키가 아니라 값이라서 False예요. 오류는 나지 않아요.",
      },
      {
        type: "blank", concept: "dictmod",
        q: "「없음」이 찍히게 빈칸을 채워 보세요.",
        code: "stock = {\"사과\": 3}\nif \"배\" ___ stock:\n    print(\"있음\")\nelse:\n    print(\"없음\")",
        chips: ["in", "not in", "+"],
        answer: 0,
        explain: "배는 키에 없어서 \"배\" in stock은 False고 else로 가요. not in은 반대로 「있음」이 찍혀요.",
      },
      {
        type: "order", concept: "dictmod",
        q: "{'귤': 5}가 찍히게 줄을 놓아 보세요.",
        lines: ["stock = {}", "stock[\"귤\"] = 4", "stock[\"귤\"] = stock[\"귤\"] + 1", "print(stock)"],
        expect: "{'귤': 5}",
        explain: "빈 통을 만들고, 귤을 4로 넣고, 그 값에 1을 더해 다시 넣어요. 넣기 전에 읽으면 KeyError예요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "stock = {}\nstock[\"사과\"] = 1\nstock[\"사과\"] = 2\nprint(stock)",
        options: ["{'사과': 2}", "{'사과': 1}", "{'사과': 1, '사과': 2}"],
        answer: 0,
        explain: "키는 하나뿐이라서 같은 키에 다시 넣으면 값이 교체돼요. 마지막에 넣은 2만 남아요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "d = {}\nfor n in [\"민지\", \"준\", \"민지\"]:\n    if n not in d:\n        d[n] = []\n    d[n].append(1)\nprint(d)",
        options: ["{'민지': [1, 1], '준': [1]}", "{'민지': [1], '준': [1]}", "{'민지': 2, '준': 1}"],
        answer: 0,
        explain: "민지는 두 번 나와서 빈 리스트는 처음에만 만들고 1이 두 번 쌓여요. 준은 한 번이라 [1]이에요.",
      },
      {
        type: "write", concept: "dictmod",
        task: "stock에 사과 3, 배 5가 있어요. 과일 이름을 input()으로 받아(괄호는 비워 두세요) stock[이름] = 10 으로 넣거나 바꾼 뒤 stock을 출력해요. 예: 포도를 입력하면 {'사과': 3, '배': 5, '포도': 10}",
        starter: "stock = {\"사과\": 3, \"배\": 5}\nitem = input()\n",
        tests: [
          { stdin: "포도", expect: "{'사과': 3, '배': 5, '포도': 10}", public: true },
          { stdin: "사과", expect: "{'사과': 10, '배': 5}", public: false },
          { stdin: "배", expect: "{'사과': 3, '배': 10}", public: false },
        ],
        require: ["Subscript", "Name:stock"],
        hints: [
          "입력한 과일의 재고를 10으로 만들고 stock 전체를 찍어요. 이미 있는 과일이면 어떻게 될까요?",
          "d[키] = 값 은 없으면 추가, 있으면 교체예요. 둘 다 같은 한 줄로 처리돼요.",
          "키 자리에 입력받은 item을 쓰고, 값은 10을 넣어요. 그다음 stock을 통째로 찍어요.",
          "stock = {\"사과\": 3, \"배\": 5}\nitem = input()\nstock[___] = ___\nprint(stock)",
        ],
        solution: "stock = {\"사과\": 3, \"배\": 5}\nitem = input()\nstock[item] = 10\nprint(stock)",
        explain: "새 과일은 추가되고 있는 과일은 10으로 바뀌어요. if로 나누지 않아도 한 줄이 두 경우를 모두 처리해서 깔끔해요.",
      },
      {
        type: "check", concept: "dictmod",
        q: "stock[\"배\"] = 7 이 하는 일은?",
        options: ["배가 없으면 추가, 있으면 값을 바꾼다", "배가 이미 있으면 KeyError가 난다", "배가 없으면 아무 일도 안 한다"],
        answer: 0,
        explain: "대입은 키가 없으면 새로 만들고 있으면 덮어써요. KeyError는 꺼낼 때 없는 키에서만 나요.",
      },
    ],
  },
  {
    id: "8-3", chapter: 8, title: "get과 돌아보기",
    goal: "get으로 안전하게 꺼내고 딕셔너리를 돌 수 있다",
    summary: [
      "get(키, 기본값): 없으면 기본값, 오류 없음",
      "for k in d: 는 키가 나옴",
      "items는 키와 값, values는 값만",
    ],
    cards: [
      {
        say: "get(키, 기본값)은 키가 있으면 값을, 없으면 KeyError 대신 기본값을 줘요. 기본값을 안 쓰면 없을 때 None이 나와요.",
        code: "menu = {\"라떼\": 4000}\nprint(menu.get(\"라떼\", \"품절\"))\nprint(menu.get(\"모카\", \"품절\"))\nprint(menu.get(\"모카\"))",
        out: "4000\n품절\nNone",
      },
      {
        say: "for로 딕셔너리를 돌면 값이 아니라 키가 나와요. 키와 값을 함께 받으려면 for k, v in d.items(): 로 써요. values()는 값만 모아 주고 sum도 쓸 수 있어요.",
        code: "menu = {\"라떼\": 4000, \"모카\": 4500}\nfor k in menu:\n    print(k)\nfor k, v in menu.items():\n    print(k, v)\nprint(sum(menu.values()))",
        out: "라떼\n모카\n라떼 4000\n모카 4500\n8500",
      },
    ],
    items: [
      {
        type: "choice", concept: "dictget",
        q: "화면에 무엇이 출력될까요?",
        code: "menu = {\"라떼\": 4000}\nprint(menu.get(\"모카\", \"품절\"))",
        options: ["품절", "KeyError", "None"],
        answer: 0,
        explain: "모카는 키에 없어서 기본값 \"품절\"이 나와요. [ ]로 꺼냈다면 KeyError였을 거예요.",
      },
      {
        type: "choice", concept: "dictget",
        q: "화면에 무엇이 출력될까요?",
        code: "menu = {\"라떼\": 4000}\nprint(menu.get(\"모카\"))",
        options: ["None", "KeyError", "0"],
        answer: 0,
        explain: "기본값을 적지 않으면 없는 키에서 None이 나와요. 오류는 나지 않고 \"값이 없음\"을 뜻하는 None이 찍혀요.",
      },
      {
        type: "choice", concept: "dictget",
        q: "화면에 어떻게 출력될까요?",
        code: "menu = {\"라떼\": 4000, \"모카\": 4500}\nfor k in menu:\n    print(k)",
        options: ["라떼\n모카", "4000\n4500", "라떼 4000\n모카 4500"],
        answer: 0,
        explain: "for로 딕셔너리를 돌면 키만 나와요. 값까지 받고 싶다면 items()를 써요.",
      },
      {
        type: "blank", concept: "dictget",
        q: "키와 값이 함께 찍히게 빈칸을 채워 보세요.",
        code: "menu = {\"아이스티\": 3500}\nfor k, v in menu.___():\n    print(k, v)",
        chips: ["items", "keys", "values"],
        answer: 0,
        explain: "items()는 키와 값을 한 쌍씩 줘요. keys()는 키를 하나씩, values()는 값을 하나씩만 줘서 k, v로 나눌 수 없어요.",
      },
      {
        type: "order", concept: "dictget",
        q: "가격 합계 8500이 찍히게 줄을 놓아 보세요.",
        lines: ["prices = {\"라떼\": 4000, \"모카\": 4500}", "total = sum(prices.values())", "print(total)"],
        expect: "8500",
        explain: "딕셔너리를 만들고, values()로 값만 모아 합하고, 마지막에 찍어요. 순서가 바뀌면 NameError예요.",
      },
      {
        type: "write", concept: "dictget",
        task: "menu에 라떼 4000, 모카 4500을 담아요. 메뉴 이름을 input()으로 받아(괄호는 비워 두세요) get으로 가격을 출력하고, 없는 메뉴면 품절을 출력해요. 예: 쿠키를 입력하면 품절",
        starter: "menu = {\"라떼\": 4000, \"모카\": 4500}\nname = input()\n",
        tests: [
          { stdin: "쿠키", expect: "품절", public: true },
          { stdin: "라떼", expect: "4000", public: false },
          { stdin: "모카", expect: "4500", public: false },
          { stdin: "라", expect: "품절", public: false },
        ],
        require: ["Dict", "Method:get", "Name:menu"],
        hints: [
          "있는 메뉴는 가격을, 없는 메뉴는 「품절」을 찍어요. 예시에서 쿠키는 왜 품절일까요?",
          "get(키, 기본값)은 없을 때 오류 대신 기본값을 줘요. 기본값으로 문자열을 쓸 수 있어요.",
          "입력받은 name을 키로 get을 부르고, 기본값 자리에 품절을 넣어 그 결과를 찍어요.",
          "menu = {\"라떼\": 4000, \"모카\": 4500}\nname = input()\nprint(menu.get(___, ___))",
        ],
        solution: "menu = {\"라떼\": 4000, \"모카\": 4500}\nname = input()\nprint(menu.get(name, \"품절\"))",
        explain: "if와 in으로 나누지 않고 get 한 줄로 두 경우를 처리했어요. 없는 메뉴를 넣어도 KeyError 없이 품절이 나와요.",
      },
      {
        type: "check", concept: "dictget",
        q: "menu = {\"라떼\": 4000}일 때 menu.get(\"모카\", 0) + 1 의 값은?",
        options: ["1", "0", "KeyError"],
        answer: 0,
        explain: "모카가 없어서 get이 기본값 0을 주고, 거기에 1을 더해 1이에요. 이 계산이 다음 시간의 세기 패턴이에요.",
      },
    ],
  },
  {
    id: "8-4", chapter: 8, title: "세기 패턴",
    goal: "딕셔너리로 단어와 글자 수를 셀 수 있다",
    summary: [
      "counts = {} 로 빈 통을 먼저 준비",
      "counts[w] = counts.get(w, 0) + 1",
      "처음 보는 키는 get의 기본값 0에서 시작",
    ],
    cards: [
      {
        say: "세기 패턴이에요. 빈 딕셔너리를 만들고, 한 바퀴마다 counts[w] = counts.get(w, 0) + 1 을 해요. 처음 보는 단어는 get이 0을 줘서 1이 되고, 본 적 있으면 +1씩 쌓여요.",
        code: "words = \"빵 우유 빵\".split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)",
        out: "{'빵': 2, '우유': 1}",
      },
      {
        say: "글자도 똑같이 세요. 문자열을 for로 돌면 글자가 하나씩 나와요. 결과는 for k, v in counts.items(): 로 한 줄씩 보여 줄 수 있어요.",
        code: "counts = {}\nfor ch in \"aba\":\n    counts[ch] = counts.get(ch, 0) + 1\nfor k, v in counts.items():\n    print(k, v)",
        out: "a 2\nb 1",
      },
    ],
    items: [
      {
        type: "choice", concept: "count",
        q: "화면에 무엇이 출력될까요?",
        code: "counts = {}\nfor w in \"차 커피 차\".split():\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)",
        options: ["{'차': 2, '커피': 1}", "{'차': 1, '커피': 1}", "{'차': 2}"],
        answer: 0,
        explain: "차는 두 번 나와서 2, 커피는 한 번이라 1이에요. 키는 처음 나온 순서대로 들어가요.",
      },
      {
        type: "choice", concept: "count",
        q: "이 코드를 실행하면 어떤 단서(오류)가 나올까요?",
        code: "counts = {}\nfor w in \"빵 빵\".split():\n    counts[w] = counts[w] + 1",
        options: ["KeyError", "NameError", "TypeError"],
        answer: 0,
        explain: "처음 보는 빵은 counts에 아직 없어서 counts[w]를 읽을 때 KeyError예요. get(w, 0)으로 읽어야 해요.",
      },
      {
        type: "blank", concept: "count",
        q: "빵이 2번 세어지게 빈칸을 채워 보세요.",
        code: "counts = {}\nfor w in \"빵 빵\".split():\n    counts[w] = counts.get(w, ___) + 1\nprint(counts)",
        chips: ["0", "1", "None"],
        answer: 0,
        explain: "처음 볼 때 0에 1을 더해 1로 시작해야 해요. 1을 쓰면 2로 시작해서 3이 되고, None은 더할 수 없어 TypeError예요.",
      },
      {
        type: "order", concept: "count",
        q: "{'차': 2, '빵': 1}이 찍히게 줄을 놓아 보세요.",
        lines: ["counts = {}", "for w in \"차 차 빵\".split():", "    counts[w] = counts.get(w, 0) + 1", "print(counts)"],
        expect: "{'차': 2, '빵': 1}",
        explain: "빈 통을 먼저 만들고, 반복 안에서 세고, 반복이 끝난 뒤 찍어요. 통을 늦게 만들면 NameError예요.",
      },
      {
        type: "choice", concept: "count",
        q: "화면에 무엇이 출력될까요?",
        code: "counts = {}\nfor ch in \"aab\":\n    counts[ch] = counts.get(ch, 0) + 1\nprint(counts)",
        options: ["{'a': 2, 'b': 1}", "{'a': 1, 'b': 1}", "{'a': 3}"],
        answer: 0,
        explain: "문자열을 돌면 a, a, b가 차례로 나와요. a는 두 번, b는 한 번이라 {'a': 2, 'b': 1}이에요.",
      },
      {
        type: "write", concept: "count",
        task: "한 줄에 공백으로 나눠 적은 투표를 input()으로 받아(괄호는 비워 두세요) split()으로 나누고, 빈 딕셔너리 counts에 get으로 후보별 표를 세요. 처음 나온 순서대로 「후보 표수」를 한 줄씩 출력해요. 예: A B A 를 입력하면 「A 2」 「B 1」 두 줄",
        starter: "votes = input().split()\ncounts = {}\n",
        tests: [
          { stdin: "A B A C A", expect: "A 3\nB 1\nC 1", public: true },
          { stdin: "A", expect: "A 1", public: false },
          { stdin: "라떼 모카 라떼 라떼", expect: "라떼 3\n모카 1", public: false },
          { stdin: "C A C", expect: "C 2\nA 1", public: false },
        ],
        require: ["For", "Dict", "Method:get", "Name:counts"],
        hints: [
          "각 후보가 몇 표인지 센 뒤, 처음 나온 순서대로 한 줄씩 찍어요. A B A 에서 A는 왜 2일까요?",
          "세기 패턴이에요. 한 바퀴마다 counts[후보] = counts.get(후보, 0) + 1 로 쌓아요.",
          "반복이 끝난 뒤, 키와 값을 함께 도는 두 번째 for로 한 줄씩 찍어요. 이름과 표수를 print에 함께 넣어요.",
          "votes = input().split()\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(___, ___) + 1\nfor k, n in counts.___():\n    print(k, n)",
        ],
        solution: "votes = input().split()\ncounts = {}\nfor v in votes:\n    counts[v] = counts.get(v, 0) + 1\nfor k, n in counts.items():\n    print(k, n)",
        explain: "세는 반복과 보여 주는 반복을 나눈 게 깔끔해요. 표가 한 개뿐인 경우와 순서가 뒤섞인 경우도 모두 맞아요.",
      },
      {
        type: "check", concept: "count",
        q: "단어가 처음 나올 때 counts.get(w, 0)이 주는 값은?",
        options: ["0", "1", "KeyError"],
        answer: 0,
        explain: "아직 없는 키라서 기본값 0이 나와요. 거기에 1을 더해 저장하면 처음 센 값 1이 돼요.",
      },
    ],
  },
  {
    id: "8-5", chapter: 8, title: "8장 평가", isExam: true,
    goal: "주문 집계로 딕셔너리를 모두 쓴다",
    summary: [
      "d[키]는 없으면 KeyError, get은 기본값",
      "d[키] = 값 은 추가 또는 교체",
      "세기는 d[w] = d.get(w, 0) + 1",
    ],
    cards: [
      {
        say: "8장 평가예요. 키로 꺼내기, 넣고 바꾸기, get으로 안전하게 읽기, 세기 패턴을 모두 써요. 천천히 하면 충분히 풀 수 있어요.",
        code: "stock = {\"사과\": 3}\nstock[\"배\"] = stock.get(\"배\", 0) + 1\nprint(stock)",
        out: "{'사과': 3, '배': 1}",
      },
    ],
    items: [
      {
        type: "choice", concept: "dict",
        q: "이 코드를 실행하면 어떤 단서(오류)가 나올까요?",
        code: "menu = {\"라떼\": 4000}\nprint(menu[\"쿠키\"])",
        options: ["KeyError", "IndexError", "None"],
        answer: 0,
        explain: "[ ]로 없는 키를 꺼내면 KeyError예요. None은 get을 쓸 때 나오는 값이에요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "cart = {\"빵\": 2}\ncart[\"우유\"] = 1\ncart[\"빵\"] = 5\nprint(cart)",
        options: ["{'빵': 5, '우유': 1}", "{'빵': 2, '우유': 1}", "{'빵': 2, '우유': 1, '빵': 5}"],
        answer: 0,
        explain: "우유는 새로 추가되고, 빵은 같은 키라서 5로 교체돼요. 키는 겹치지 않아요.",
      },
      {
        type: "blank", concept: "dictget",
        q: "「품절」이 찍히게 빈칸을 채워 보세요.",
        code: "menu = {\"라떼\": 4000}\nprint(menu.get(\"쿠키\", ___))",
        chips: ["\"품절\"", "품절", "menu"],
        answer: 0,
        explain: "기본값은 문자열이라 따옴표가 필요해요. 따옴표가 없으면 NameError고, menu를 넣으면 딕셔너리가 통째로 찍혀요.",
      },
      {
        type: "choice", concept: "dictget",
        q: "화면에 어떻게 출력될까요?",
        code: "stock = {\"사과\": 3, \"배\": 5}\nfor x in stock:\n    print(x)",
        options: ["사과\n배", "3\n5", "사과 3\n배 5"],
        answer: 0,
        explain: "딕셔너리를 for로 돌면 키가 나와요. 값을 같이 받으려면 items()를 써요.",
      },
      {
        type: "order", concept: "count",
        q: "{'우유': 2, '빵': 1}이 찍히게 줄을 놓아 보세요.",
        lines: ["counts = {}", "for w in \"우유 빵 우유\".split():", "    counts[w] = counts.get(w, 0) + 1", "print(counts)"],
        expect: "{'우유': 2, '빵': 1}",
        explain: "빈 통 만들기, 반복하며 세기, 반복 뒤 출력 순서예요. 세는 줄은 반드시 for 안쪽에 들여써야 해요.",
      },
      {
        type: "blank", concept: "dictget",
        q: "키와 값이 한 쌍씩 찍히게 빈칸을 채워 보세요.",
        code: "stock = {\"사과주스\": 3}\nfor k, v in stock.___():\n    print(k, v)",
        chips: ["items", "keys", "values"],
        answer: 0,
        explain: "키와 값을 함께 받으려면 items()예요. keys()는 키를 하나씩만 줘서 k, v로 나눌 수 없어요.",
      },
      {
        type: "choice", concept: "dictmod",
        q: "화면에 무엇이 출력될까요?",
        code: "cart = {\"빵\": 2}\nprint(\"우유\" in cart)",
        options: ["False", "True", "KeyError"],
        answer: 0,
        explain: "in은 키가 있는지만 알려 줘요. 우유는 키에 없어서 False고, 오류는 나지 않아요.",
      },
      {
        type: "write", concept: "count",
        task: "menu는 라떼 4000, 모카 4500이에요. 주문을 공백으로 나눠 input()으로 받아(괄호는 비워 두세요) if와 in으로 메뉴에 있는 것만 걸러 get으로 counts에 세요. 처음 나온 순서로 「메뉴 수량」을 한 줄씩, 마지막에 「합계 금액」을 출력해요. 예: 라떼 모카 라떼 → 「라떼 2」 「모카 1」 「합계 12500」",
        starter: "menu = {\"라떼\": 4000, \"모카\": 4500}\norders = input().split()\ncounts = {}\ntotal = 0\n",
        tests: [
          { stdin: "라떼 모카 라떼", expect: "라떼 2\n모카 1\n합계 12500", public: true },
          { stdin: "쿠키 라떼", expect: "라떼 1\n합계 4000", public: false },
          { stdin: "쿠키", expect: "합계 0", public: false },
          { stdin: "모카 모카 라떼 모카", expect: "모카 3\n라떼 1\n합계 17500", public: false },
        ],
        require: ["For", "Dict", "If", "Method:get", "Name:counts", "Name:menu"],
        hints: [
          "메뉴에 있는 주문만 세고, 수량 줄과 합계 줄을 찍어요. 예시에서 12500은 어떻게 나왔을까요?",
          "주문마다 menu에 없으면(not in) continue로 건너뛰고, 있으면 get으로 세면서 total에 가격을 더해요.",
          "세는 반복이 끝난 뒤 counts.items()로 한 줄씩 찍고, 마지막에 합계 줄을 찍어요. 합계는 total을 써요.",
          "for o in orders:\n    if o not in menu:\n        continue\n    counts[o] = counts.get(o, ___) + 1\n    total = total + menu[___]\nfor k, n in counts.items():\n    print(k, n)\nprint(\"합계\", total)",
        ],
        solution: "menu = {\"라떼\": 4000, \"모카\": 4500}\norders = input().split()\ncounts = {}\ntotal = 0\nfor o in orders:\n    if o not in menu:\n        continue\n    counts[o] = counts.get(o, 0) + 1\n    total = total + menu[o]\nfor k, n in counts.items():\n    print(k, n)\nprint(\"합계\", total)",
        explain: "in으로 걸러 내고, get으로 세고, 키로 가격을 꺼내는 흐름이 한 번에 맞았어요. 메뉴에 없는 주문만 있는 경우도 합계 0으로 깔끔해요.",
      },
      {
        type: "check", concept: "count",
        q: "counts[w] = counts.get(w, 0) + 1 에서 get을 쓰는 가장 큰 이유는?",
        options: ["처음 보는 단어에서 KeyError를 피하려고", "단어를 알파벳순으로 정렬하려고", "이미 있는 단어를 지우려고"],
        answer: 0,
        explain: "처음 보는 키는 아직 없어서 [ ]로 읽으면 KeyError예요. get의 기본값 0이 그 틈을 메워 줘요.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 8장 심화 (v0.8). 안 가르친 것: 정렬(sorted)·max(key=)·컴프리헨션·join·서식 지정자·+=·조건 표현식.
// 출력 순서는 딕셔너리에 넣은 순서(처음 나온 순서)로 정해진다.
export const ADVANCED = [
  {
    id: "8-A1", chapter: 8, isAdvanced: true, title: "기준별로 묶어 세기",
    goal: "단어의 특징으로 묶어 세고 합칠 수 있다",
    summary: [
      "키를 w 대신 w[0], len(w)로 바꾸면 기준이 바뀜",
      "if로 이름표를 붙여 그 이름표를 키로 씀",
      "1 대신 값을 더하면 개수가 아닌 합계",
    ],
    cards: [
      {
        say: "여기는 「한 걸음 더」 가 보는 곳이에요. 몰라도 다음 장은 열려 있어요. 8-4에서는 단어 그대로 셌죠? 키를 w[0](첫 글자)로 바꾸면 첫 글자별로 세어져요.",
        code: `words = "사과 바나나 배 바다".split()
counts = {}
for w in words:
    k = w[0]
    counts[k] = counts.get(k, 0) + 1
print(counts)`,
        out: "{'사': 1, '바': 2, '배': 1}",
      },
      {
        say: "1 대신 값을 더하면 합계가 돼요. 기준은 if로 정해도 돼요. 5000원 이상이면 「비쌈」, 아니면 「보통」이라는 이름표를 키로 써서 금액을 합쳐요.",
        code: `sums = {}
for p in [4000, 9000, 5000]:
    if p >= 5000:
        k = "비쌈"
    else:
        k = "보통"
    sums[k] = sums.get(k, 0) + p
print(sums)`,
        out: "{'보통': 4000, '비쌈': 14000}",
      },
    ],
    items: [
      {
        type: "choice", concept: "groupcount",
        q: "화면에 무엇이 출력될까요?",
        code: `words = "사과 바나나 배 바다".split()
counts = {}
for w in words:
    k = w[0]
    counts[k] = counts.get(k, 0) + 1
print(counts)`,
        options: ["{'사': 1, '바': 2, '배': 1}", "{'사과': 1, '바나나': 1, '배': 1, '바다': 1}", "{'사': 1, '바': 1, '배': 1}"],
        answer: 0,
        explain: "키가 첫 글자라서 바나나와 바다가 같은 「바」 칸에 쌓여 2가 돼요. 키는 처음 나온 순서로 들어가요.",
      },
      {
        type: "choice", concept: "groupcount",
        q: "화면에 무엇이 출력될까요?",
        code: `words = "차 커피 빵 우유 라떼".split()
counts = {}
for w in words:
    n = len(w)
    counts[n] = counts.get(n, 0) + 1
print(counts)`,
        options: ["{1: 2, 2: 3}", "{2: 3, 1: 2}", "{1: 1, 2: 1}"],
        answer: 0,
        explain: "글자 수가 키예요. 1글자는 차·빵 둘, 2글자는 커피·우유·라떼 셋이에요. 키가 숫자여도 처음 나온 순서(1 먼저)로 찍혀요.",
      },
      {
        type: "blank", concept: "groupcount",
        q: "첫 글자별로 세어지게 빈칸을 채워 보세요.",
        code: `counts = {}
for w in "배 바다 바나나".split():
    k = ___
    counts[k] = counts.get(k, 0) + 1
print(counts)`,
        chips: ["w[0]", "w", "w[1]"],
        answer: 0,
        explain: "w[0]은 첫 글자예요. w를 그대로 쓰면 단어마다 따로 세고, w[1]은 「배」처럼 한 글자 단어에서 IndexError예요.",
      },
      {
        type: "order", concept: "groupcount",
        q: "{2: 3}이 찍히게 줄을 놓아 보세요.",
        lines: [
          "counts = {}",
          "for w in \"수박 참외 딸기\".split():",
          "    n = len(w)",
          "    counts[n] = counts.get(n, 0) + 1",
          "print(counts)",
        ],
        expect: "{2: 3}",
        explain: "통을 먼저 만들고, 반복 안에서 글자 수를 구해 세고, 반복이 끝난 뒤 찍어요. n을 구하기 전에 쓰면 NameError예요.",
      },
      {
        type: "choice", concept: "groupcount",
        q: "화면에 무엇이 출력될까요?",
        code: `sums = {}
for p in [2000, 6000, 7000]:
    if p >= 5000:
        k = "비쌈"
    else:
        k = "보통"
    sums[k] = sums.get(k, 0) + p
print(sums)`,
        options: ["{'보통': 2000, '비쌈': 13000}", "{'보통': 1, '비쌈': 2}", "{'보통': 2000, '비쌈': 6000}"],
        answer: 0,
        explain: "2000은 보통에, 6000과 7000은 비쌈에 합쳐져요. 6000 + 7000 = 13000이에요. 더하는 값이 1이면 개수가 돼요.",
      },
      {
        type: "write", concept: "groupcount",
        task: "단어들을 공백으로 나눠 input()으로 받아(괄호는 비워 두세요) 글자 수(len)별로 get으로 세어요. counts에 모은 뒤 처음 나온 순서로 「n글자 k개」를 한 줄씩 출력해요. 예: 차 빵 커피 → 「1글자 2개」 「2글자 1개」",
        starter: "words = input().split()\ncounts = {}\n",
        tests: [
          { stdin: "사과 바나나 배 귤 포도", expect: "2글자 2개\n3글자 1개\n1글자 2개", public: true },
          { stdin: "배", expect: "1글자 1개", public: false },
          { stdin: "커피 차 커피 라떼", expect: "2글자 3개\n1글자 1개", public: false },
          { stdin: "수박 참외 수박", expect: "2글자 3개", public: false },
        ],
        require: ["For", "Dict", "Method:get", "Call:len", "Name:counts"],
        hints: [
          "단어가 아니라 글자 수가 같은 것끼리 센 뒤, 처음 나온 글자 수부터 한 줄씩 찍어요. 차 빵 커피에서 1글자가 왜 2개일까요?",
          "8-4의 세기 패턴에서 키만 바꿔요. 단어 w 대신 len(w)를 키로 쓰면 글자 수별로 세어져요.",
          "첫 반복에서 글자 수를 구해 get으로 세고, 반복이 끝난 뒤 키와 값을 함께 도는 두 번째 for로 f-문자열을 찍어요.",
          "for w in words:\n    n = len(___)\n    counts[n] = counts.get(___, 0) + 1\nfor n, k in counts.items():\n    print(f\"{n}글자 {k}개\")",
        ],
        solution: `words = input().split()
counts = {}
for w in words:
    n = len(w)
    counts[n] = counts.get(n, 0) + 1
for n, k in counts.items():
    print(f"{n}글자 {k}개")`,
        explain: "세기 패턴에서 키만 len(w)로 바꿨을 뿐인데 기준이 달라졌어요. 단어가 하나뿐인 경우도, 글자 수가 한 가지뿐인 경우도 맞아요.",
      },
      {
        type: "check", concept: "groupcount",
        q: "sums.get(k, 0) + p 처럼 1 대신 p를 더하면 무엇이 쌓일까요?",
        options: ["기준별 금액의 합계", "기준별 개수", "기준별 최댓값"],
        answer: 0,
        explain: "더하는 값이 1이면 몇 번 나왔는지(개수), 값 p면 p를 모두 합친 합계가 돼요. 뼈대는 똑같고 더하는 값만 달라요.",
      },
    ],
  },
  {
    id: "8-A2", chapter: 8, isAdvanced: true, title: "딕셔너리 안 리스트",
    goal: "기준별로 값을 리스트에 모아 꺼낼 수 있다",
    summary: [
      "처음 보는 키는 d[k] = [] 로 빈 리스트를 먼저 둠",
      "d[k].append(값)으로 기준별로 쌓음",
      "꺼낸 리스트에 [0], len, sum을 바로 씀",
    ],
    cards: [
      {
        say: "「한 걸음 더」예요. 8-2에서 값이 리스트인 딕셔너리를 맛봤죠? 숫자를 세는 대신 단어를 그대로 쌓으면 첫 글자별 묶음이 돼요. 키가 처음일 때만 빈 리스트를 만들어요.",
        code: `words = "사과 바나나 배 바다".split()
groups = {}
for w in words:
    k = w[0]
    if k not in groups:
        groups[k] = []
    groups[k].append(w)
print(groups)`,
        out: "{'사': ['사과'], '바': ['바나나', '바다'], '배': ['배']}",
      },
      {
        say: "꺼낸 값이 리스트라서 바로 번호를 붙이거나 len, sum을 쓸 수 있어요. scores[이름][1]은 그 이름의 두 번째 점수예요.",
        code: `d = {"민지": [90, 80], "준": [70]}
print(d["민지"][1])
d["준"].append(100)
print(d["준"], len(d["준"]))
for k, v in d.items():
    print(k, sum(v))`,
        out: "80\n[70, 100] 2\n민지 170\n준 170",
      },
    ],
    items: [
      {
        type: "choice", concept: "dictlist",
        q: "화면에 무엇이 출력될까요?",
        code: `d = {"민지": [90, 80], "준": [70]}
print(d["민지"][1])`,
        options: ["80", "90", "[90, 80]"],
        answer: 0,
        explain: "d[\"민지\"]가 [90, 80] 리스트이고, 거기에 [1]을 붙이면 두 번째인 80이에요. 번호는 0부터 세요.",
      },
      {
        type: "choice", concept: "dictlist",
        q: "화면에 무엇이 출력될까요?",
        code: `scores = {"준": [70]}
scores["준"].append(100)
print(scores["준"])`,
        options: ["[70, 100]", "[100]", "{'준': [70, 100]}"],
        answer: 0,
        explain: "scores[\"준\"]이 리스트라서 append로 뒤에 100이 붙어요. 찍은 것은 딕셔너리가 아니라 그 리스트 하나예요.",
      },
      {
        type: "blank", concept: "dictlist",
        q: "가가 두 번 쌓이게 빈칸을 채워 보세요.",
        code: `d = {}
for w in "가 나 가".split():
    if w not in d:
        d[w] = ___
    d[w].append(1)
print(d)`,
        chips: ["[]", "0", "{}"],
        answer: 0,
        explain: "append를 쓰려면 값이 리스트여야 해요. 0이나 {}에는 append가 없어서 AttributeError가 나요.",
      },
      {
        type: "order", concept: "dictlist",
        q: "1이 찍히게 줄을 놓아 보세요.",
        lines: [
          "scores = {}",
          "scores[\"민지\"] = []",
          "scores[\"민지\"].append(95)",
          "print(len(scores[\"민지\"]))",
        ],
        expect: "1",
        explain: "빈 딕셔너리, 빈 리스트 만들기, 점수 쌓기, 개수 세기 순서예요. 리스트를 만들기 전에 append하면 KeyError예요.",
      },
      {
        type: "choice", concept: "dictlist",
        q: "화면에 무엇이 출력될까요?",
        code: `scores = {"민지": [90, 80]}
print(sum(scores["민지"]))`,
        options: ["170", "90", "[90, 80]"],
        answer: 0,
        explain: "scores[\"민지\"]를 꺼내면 리스트라서 sum으로 합할 수 있어요. 90 + 80 = 170이에요.",
      },
      {
        type: "write", concept: "dictlist",
        task: "첫 줄에 이름들, 둘째 줄에 점수들(같은 순서)을 input()으로 받아(괄호는 비워 두세요) groups에 이름별 점수 리스트로 append해요. 점수는 int()로 바꿔요. 처음 나온 순서로 「이름 [점수들]」을 출력해요. 예: 「민지 준 민지」 「90 70 80」 → 「민지 [90, 80]」 「준 [70]」",
        starter: "names = input().split()\nscores = input().split()\ngroups = {}\n",
        tests: [
          { stdin: "민지 준 민지\n90 70 80", expect: "민지 [90, 80]\n준 [70]", public: true },
          { stdin: "준\n100", expect: "준 [100]", public: false },
          { stdin: "가 나 가 가\n1 2 3 4", expect: "가 [1, 3, 4]\n나 [2]", public: false },
          { stdin: "나 가\n5 6", expect: "나 [5]\n가 [6]", public: false },
        ],
        require: ["For", "Dict", "Method:append", "Call:int", "Name:groups"],
        hints: [
          "이름이 같은 점수끼리 한 리스트에 모아요. 민지가 두 번 나오면 민지 리스트에는 점수가 몇 개 들어갈까요?",
          "이름과 점수는 같은 번호끼리 짝이에요(7-2의 range(len(a))). 키가 처음이면 빈 리스트를 먼저 만들고 append해요.",
          "번호 i로 돌며 names[i]를 키로 쓰고 int(scores[i])를 append해요. 반복이 끝난 뒤 키와 값을 함께 돌며 찍어요.",
          "for i in range(len(names)):\n    n = names[i]\n    if n ___ groups:\n        groups[n] = []\n    groups[n].append(int(scores[___]))\nfor k, v in groups.items():\n    print(k, v)",
        ],
        solution: `names = input().split()
scores = input().split()
groups = {}
for i in range(len(names)):
    n = names[i]
    if n not in groups:
        groups[n] = []
    groups[n].append(int(scores[i]))
for k, v in groups.items():
    print(k, v)`,
        explain: "처음 보는 이름에만 빈 리스트를 만들고 점수를 쌓은 흐름이 깔끔해요. 사람이 한 명뿐이거나 이름 순서가 뒤섞여도 맞아요.",
      },
      {
        type: "check", concept: "dictlist",
        q: "d[k].append(x) 전에 처음 보는 키라면 d[k] = [] 를 먼저 하는 이유는?",
        options: ["없는 키를 d[k]로 읽으면 KeyError라서", "리스트를 정렬해 두려고", "이미 있는 값을 지우려고"],
        answer: 0,
        explain: "d[k].append(x)는 먼저 d[k]를 읽는데, 없는 키면 KeyError예요. 빈 리스트를 넣어 두면 그 읽기가 성공해요.",
      },
    ],
  },
  {
    id: "8-A3", chapter: 8, isAdvanced: true, title: "성적표 요약",
    goal: "이름별 점수로 평균과 1등을 구할 수 있다",
    summary: [
      "평균은 round(sum(v) / len(v), 1)",
      "가장 높은 값은 > 로 비교해 갈아 끼움",
      "묶어 담기, 세기, 비교를 한 프로그램에 모음",
    ],
    cards: [
      {
        say: "「한 걸음 더」 마지막 시간이에요. 이름별 점수 리스트에서 평균을 구해 볼게요. 합을 개수로 나누고 round로 소수 첫째 자리까지만 남겨요.",
        code: `data = {"민지": [90, 75], "준": [88]}
for k, v in data.items():
    avg = round(sum(v) / len(v), 1)
    print(k, avg)`,
        out: "민지 82.5\n준 88.0",
      },
      {
        say: "1등은 반복 안에서 if로 찾아요. 지금까지의 최고 평균보다 크면 갈아 끼워요. > 라서 같을 땐 먼저 나온 사람이 남아요.",
        code: `data = {"민지": [90, 75], "준": [88]}
best_name = ""
best_avg = -1
for k, v in data.items():
    avg = round(sum(v) / len(v), 1)
    if avg > best_avg:
        best_avg = avg
        best_name = k
print("1등", best_name)`,
        out: "1등 준",
      },
    ],
    items: [
      {
        type: "choice", concept: "dictlist",
        q: "화면에 무엇이 출력될까요?",
        code: `v = [70, 85]
print(round(sum(v) / len(v), 1))`,
        options: ["77.5", "155", "78"],
        answer: 0,
        explain: "합 155를 개수 2로 나누면 77.5예요. round(…, 1)은 소수 첫째 자리까지 남기는데 이미 한 자리라 그대로예요.",
      },
      {
        type: "choice", concept: "groupcount",
        q: "화면에 무엇이 출력될까요?",
        code: `counts = {}
for s in [55, 70, 90, 40]:
    if s >= 60:
        k = "합격"
    else:
        k = "불합격"
    counts[k] = counts.get(k, 0) + 1
print(counts)`,
        options: ["{'불합격': 2, '합격': 2}", "{'합격': 2, '불합격': 2}", "{'합격': 3, '불합격': 1}"],
        answer: 0,
        explain: "첫 점수 55가 불합격이라 불합격 키가 먼저 들어가요. 70과 90은 합격, 40은 불합격이라 둘씩이에요.",
      },
      {
        type: "blank", concept: "dictlist",
        q: "가장 높은 평균 88.0이 찍히게 빈칸을 채워 보세요.",
        code: `best = -1
for a in [82.5, 88.0, 79.0]:
    if a ___ best:
        best = a
print(best)`,
        chips: [">", "<", "=="],
        answer: 0,
        explain: "지금까지의 최고보다 클 때만 갈아 끼워요. <나 ==를 쓰면 한 번도 갈아 끼우지 못해 -1이 그대로 찍혀요. 0점도 이기도록 -1에서 시작해요.",
      },
      {
        type: "order", concept: "dictlist",
        q: "80.0이 찍히게 줄을 놓아 보세요.",
        lines: ["v = [90, 80, 70]", "avg = sum(v) / len(v)", "print(round(avg, 1))"],
        expect: "80.0",
        explain: "점수 리스트를 만들고, 평균을 구하고, round로 소수 첫째 자리까지 다듬어 찍어요. 평균을 구하기 전에 쓰면 NameError예요.",
      },
      {
        type: "choice", concept: "dictlist",
        q: "화면에 무엇이 출력될까요?",
        code: `avgs = {"가": 70.0, "나": 70.0}
best = ""
top = -1
for k, a in avgs.items():
    if a > top:
        top = a
        best = k
print(best)`,
        options: ["가", "나", "가 나"],
        answer: 0,
        explain: "가가 먼저 70.0으로 최고가 되고, 나는 같을 뿐 더 크지 않아서 갈아 끼우지 못해요. 같으면 먼저 나온 사람이 남아요.",
      },
      {
        type: "write", concept: "dictlist",
        task: "첫 줄 이름들, 둘째 줄 점수들(같은 순서)을 input()으로 받아(괄호는 비워 두세요) groups에 이름별로 append하세요. 처음 나온 순서로 「이름 평균」(sum·len·round, 소수 첫째 자리), 끝에 if로 「1등 이름」. 같으면 먼저 나온 사람. 예: 민지 준 민지 / 90 70 80 → 민지 85.0, 준 70.0, 1등 민지",
        starter: "names = input().split()\nscores = input().split()\ngroups = {}\n",
        tests: [
          { stdin: "민지 준 민지\n90 70 80", expect: "민지 85.0\n준 70.0\n1등 민지", public: true },
          { stdin: "준\n0", expect: "준 0.0\n1등 준", public: false },
          { stdin: "가 나\n70 70", expect: "가 70.0\n나 70.0\n1등 가", public: false },
          { stdin: "하나 둘 하나 하나\n90 50 75 82", expect: "하나 82.3\n둘 50.0\n1등 하나", public: false },
        ],
        require: ["For", "Dict", "If", "Method:append", "Call:round", "Call:sum", "Call:len", "Name:groups"],
        hints: [
          "이름별로 점수를 모아 평균을 낸 뒤, 평균이 가장 높은 사람을 마지막에 찍어요. 예시에서 민지의 평균은 왜 85.0일까요?",
          "A2의 묶어 담기로 groups를 만들고, 반복 안에서 평균을 구해 찍으면서 지금까지의 최고와 비교해요.",
          "최고 평균은 -1에서, 최고 이름은 빈 문자열에서 시작해요. 평균이 최고보다 크면 둘을 갈아 끼워요. 같을 땐 그대로 둬요.",
          "(묶어 담기 뒤)\nbest_name = \"\"\nbest_avg = -1\nfor k, v in groups.items():\n    avg = round(sum(v) / len(v), 1)\n    print(k, avg)\n    if avg ___ best_avg:\n        best_avg = avg\n        best_name = ___\nprint(\"1등\", best_name)",
        ],
        solution: `names = input().split()
scores = input().split()
groups = {}
for i in range(len(names)):
    n = names[i]
    if n not in groups:
        groups[n] = []
    groups[n].append(int(scores[i]))
best_name = ""
best_avg = -1
for k, v in groups.items():
    avg = round(sum(v) / len(v), 1)
    print(k, avg)
    if avg > best_avg:
        best_avg = avg
        best_name = k
print("1등", best_name)`,
        explain: "묶어 담기, 평균, 최고 찾기를 한 흐름으로 이었어요. 점수가 0점이어도 동점이어도 소수가 길게 나와도 모두 맞아요.",
      },
      {
        type: "check", concept: "dictlist",
        q: "최고 평균을 찾는 if에서 >= 대신 > 를 쓰면 동점일 때 누가 남을까요?",
        options: ["먼저 나온 사람", "나중에 나온 사람", "둘 다"],
        answer: 0,
        explain: ">는 진짜 더 클 때만 갈아 끼워요. 동점이면 갈아 끼우지 않아서 먼저 나온 사람이 그대로 남아요.",
      },
    ],
  },
];

// 매일 도전 틀(v0.9, 판정 C54). 형식: docs/lesson-writing-guide.md 7절. 점검: python3 tests/content.py (씨앗 0~99를 실제로 돌려 봄)
export const TEMPLATES = [
  {
    id: "8-T1", concept: "dict", type: "choice",
    q: "과일 가격표예요. 화면에 무엇이 출력될까요?",
    code: 'price = {"{F1}": {A}, "{F2}": {B}}\nprint(price["{F2}"])',
    wrong: ['price = {"{F1}": {A}, "{F2}": {B}}\nprint(price["{F1}"])', 'price = {"{F1}": {A}, "{F2}": {B}}\nprint(price[{B}])'],
    vars: { F1: ["사과", "배", "귤"], F2: ["포도", "감", "딸기"], A: { min: 100, max: 500 }, B: { min: 600, max: 900 } },
    explain: "딕셔너리는 번호가 아니라 키로 값을 꺼내요. 없는 키를 쓰면 KeyError가 나요.",
  },
  {
    id: "8-T2", concept: "dictget", type: "blank",
    q: "「{X}」 키가 없어도 오류 대신 0이 나오게 빈칸을 채워 보세요.",
    code: 'stock = {"사과": {A}, "배": {B}}\nprint(stock.get("{X}", ___))',
    chips: ["0", "None", '"없음"'], answer: 0,
    vars: { X: ["귤", "감", "포도", "딸기"], A: { min: 3, max: 9 }, B: { min: 10, max: 19 } },
    explain: "get(키, 기본값)은 키가 없을 때 기본값을 돌려줘요. 기본값에 0을 쓰면 0이 나오고, None이나 글자를 쓰면 그 값이 나와요.",
  },
  {
    id: "8-T3", concept: "dictmod", type: "choice",
    q: "사과를 {N}개 더 사 왔어요. 화면에 무엇이 출력될까요?",
    code: 'stock = {"사과": {A}, "배": {B}}\nstock["사과"] = stock["사과"] + {N}\nprint(stock)',
    wrong: ['stock = {"사과": {A}, "배": {B}}\nstock["사과"] + {N}\nprint(stock)', 'stock = {"사과": {A}, "배": {B}}\nstock["사과"] = {N}\nprint(stock)'],
    vars: { A: { min: 3, max: 9 }, B: { min: 10, max: 19 }, N: { min: 20, max: 29 } },
    explain: "계산만 하면 딕셔너리는 그대로예요. 계산한 값을 stock[\"사과\"]에 다시 넣어야 바뀌고, =만 쓰면 원래 값이 사라져요.",
  },
  {
    id: "8-T4", concept: "count", type: "choice",
    q: "단어가 몇 번 나왔는지 세요. 화면에 무엇이 출력될까요?",
    code: 'ws = ["{A}", "{B}", "{A}", "{A}"]\ncounts = {}\nfor w in ws:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)',
    wrong: ['ws = ["{A}", "{B}", "{A}", "{A}"]\ncounts = {}\nfor w in ws:\n    counts[w] = 1\nprint(counts)', 'ws = ["{A}", "{B}", "{A}", "{A}"]\ncounts = {}\nfor w in ws:\n    counts[w] += 1\nprint(counts)'],
    vars: { A: ["하나", "가을", "바다", "구름"], B: ["하늘", "겨울", "나무", "노을"] },
    explain: "get(w, 0) + 1은 처음 보는 단어는 0에서 시작해 1을 더해요. counts[w] = 1은 매번 1로 덮고, +=는 없는 키에서 KeyError가 나요.",
  },
  {
    id: "8-T5", concept: "dictmod", type: "choice",
    q: "{K} 모둠에 이름을 두 명 넣어요. 화면에 무엇이 출력될까요?",
    code: 'groups = {}\ngroups["{K}"] = []\ngroups["{K}"].append("{A}")\ngroups["{K}"].append("{B}")\nprint(groups["{K}"])',
    wrong: ['groups = {}\ngroups["{K}"].append("{A}")\ngroups["{K}"].append("{B}")\nprint(groups["{K}"])', 'groups = {}\ngroups["{K}"] = []\ngroups["{K}"].append("{A}")\ngroups["{K}"] = []\ngroups["{K}"].append("{B}")\nprint(groups["{K}"])'],
    vars: { K: ["파랑", "노랑", "초록", "보라"], A: ["민수", "지아", "서준"], B: ["하린", "도윤", "예은"] },
    explain: "먼저 빈 리스트를 만들어야 append를 쓸 수 있어요. 안 만들면 KeyError, 다시 [] 를 넣으면 앞 이름이 사라져요.",
  },
];
