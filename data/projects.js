// v0.21.0 프로젝트 공방 데이터(한국어). 영어는 data/projects.en.js(같은 id·같은 단계 수·같은 시험 수와 rand 길이).
// 설계 docs/specs/2026-11-15-프로젝트-공방-설계.md §4-1·§4-2·§7. 검사: python3 tests/projects.py
//
// PROJECTS: [{ id: "P1", need: 열리는 장(그 장을 끝내면), icon: 앱 아이콘 이름(src/ui/dom.js),
//   title·blurb: 목록·진열장 한 줄, intro: 리아의 시작 말, finale: 완성 때 리아 말,
//   play: { prompt: 완성작 주고받기 실행의 입력 안내, files?: { 이름: 글자 } — 완성작 실행의 가상 파일 },
//   steps: [3~5개 { goal: 단계 머리 한 줄, task: 할 일(쓸 변수 이름을 정해 줌),
//     starter?: 시작 코드(첫 단계만 — 이후 단계는 앞 단계 학습자 코드에서 시작),
//     tool?: { title, body, code } — 새 도구 카드(레슨에서 안 배운 import random 등을 짧게 소개),
//     tests: [{ stdin, expect, public, rand?: [randint·choice가 차례로 돌려줄 값], files? }],
//     require: 레슨 「직접 쓰기」와 같은 필수 문법, hints: [...], solution: 모범 코드(빌드에 남김, 판정 W-P1),
//     explain?: 정답과 함께 보이는 해설 }] }]
// 단계 채점은 그 단계 tests만(앞 단계 시험은 다시 보지 않음). 그 장까지 배운 문법만 쓴다(새 도구 카드 예외는 random뿐).
// 무작위는 rand로 정해 채점하고, 단계 글이 「무작위는 이 줄에서 한 번만」처럼 부르는 자리를 정해 준다.

export const PROJECTS = [
  {
    id: "P1", need: 3, icon: "play",
    title: "가위바위보",
    blurb: "컴퓨터와 가위바위보 한 판",
    intro: "오늘은 가위바위보 게임을 만들어 봐요! 한 단계씩 코드를 더해 가면, 마지막엔 컴퓨터와 진짜로 한 판 할 수 있어요.",
    finale: "완성이에요! 직접 만든 가위바위보로 저랑 한 판 해 볼까요? 진열장에 넣어 둘 테니 언제든 다시 꺼내 놀아요.",
    play: { prompt: "가위, 바위, 보 중 하나를 입력해요" },
    steps: [
      {
        goal: "내가 낸 손을 받아 보여 주기",
        task: "시작 코드의 me = input()이 내가 낸 손을 받아 변수 me에 담아 둬요. 그 아래에 print를 한 줄 더해 「나:」 뒤에 me를 출력해요. 예: 가위를 입력하면 「나: 가위」",
        starter: "me = input()\n",
        tests: [
          { stdin: "가위", expect: "나: 가위", public: true },
          { stdin: "보", expect: "나: 보", public: false },
          { stdin: "바위", expect: "나: 바위", public: false },
        ],
        require: ["Call:input", "Call:print"],
        hints: [
          "print 안에 값을 쉼표로 나란히 쓰면, 사이에 빈칸 하나를 넣어 이어 출력해요.",
          "「나:」는 따옴표로 감싼 글자, me는 따옴표 없이 변수 이름 그대로 써요.",
          'me = input()\nprint("나:", ___)',
        ],
        solution: 'me = input()\nprint("나:", me)\n',
        explain: "print에 쉼표로 값 두 개를 주면 빈칸 하나를 사이에 두고 이어 나와요. 이제 내가 낸 손이 화면에 보여요.",
      },
      {
        goal: "컴퓨터가 무작위로 손 고르기",
        tool: {
          title: "새 도구: random",
          body: "random은 파이썬에 들어 있는 무작위 도구 상자예요. 코드 맨 위에 import random을 한 번 쓰면 꺼내 쓸 수 있어요. random.randint(1, 3)은 1, 2, 3 중 하나를 골라 줘요. 실행할 때마다 달라질 수 있어요.",
          code: "import random\n\nnum = random.randint(1, 3)\nprint(num)",
        },
        task: "맨 위에 import random을 써요. 「나:」 줄 아래에서 random.randint(1, 3)으로 고른 수를 num에 담아요(무작위는 이 줄에서 한 번만). num이 1이면 「가위」, 2면 「바위」, 3이면 「보」를 com에 담고, print로 「컴퓨터:」 뒤에 com을 출력해요.",
        tests: [
          { stdin: "가위", rand: [2], expect: "나: 가위\n컴퓨터: 바위", public: true },
          { stdin: "보", rand: [3], expect: "나: 보\n컴퓨터: 보", public: false },
          { stdin: "바위", rand: [1], expect: "나: 바위\n컴퓨터: 가위", public: false },
        ],
        require: ["Import", "Method:randint", "If"],
        hints: [
          "num이 1, 2, 3일 때 com에 무엇을 담을지 if·elif·else로 세 갈래를 나눠요.",
          "random.randint(1, 3)은 num = 줄에서 한 번만 불러요. if 줄마다 새로 부르면 그때마다 다른 수가 나와요.",
          'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "가위"\nelif num == ___:\n    com = "___"\nelse:\n    com = "___"\nprint("컴퓨터:", com)',
        ],
        solution: 'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\n',
        explain: "무작위 수 하나를 num에 담아 두고, if·elif·else로 그 수를 손 이름으로 바꿨어요. 1·2가 아니면 남은 건 3이라 else로 충분해요.",
      },
      {
        goal: "이겼는지 졌는지 판정하기",
        task: "판정을 변수 result에 담아요. me와 com이 같으면 「비겼어요」, 내가 이기는 세 경우(가위-보, 바위-가위, 보-바위)면 「이겼어요」, 나머지는 「졌어요」예요. 맨 아래에서 print로 「결과:」 뒤에 result를 출력해요.",
        tests: [
          { stdin: "가위", rand: [3], expect: "나: 가위\n컴퓨터: 보\n결과: 이겼어요", public: true },
          { stdin: "바위", rand: [2], expect: "나: 바위\n컴퓨터: 바위\n결과: 비겼어요", public: false },
          { stdin: "바위", rand: [1], expect: "나: 바위\n컴퓨터: 가위\n결과: 이겼어요", public: false },
          { stdin: "보", rand: [2], expect: "나: 보\n컴퓨터: 바위\n결과: 이겼어요", public: false },
          { stdin: "가위", rand: [2], expect: "나: 가위\n컴퓨터: 바위\n결과: 졌어요", public: false },
          { stdin: "보", rand: [1], expect: "나: 보\n컴퓨터: 가위\n결과: 졌어요", public: false },
          { stdin: "바위", rand: [3], expect: "나: 바위\n컴퓨터: 보\n결과: 졌어요", public: false },
          { stdin: "가위", rand: [1], expect: "나: 가위\n컴퓨터: 가위\n결과: 비겼어요", public: false },
          { stdin: "보", rand: [3], expect: "나: 보\n컴퓨터: 보\n결과: 비겼어요", public: false },
        ],
        require: ["Elif", "Else"],
        hints: [
          "먼저 if me == com: 으로 비긴 경우를 걸러요. 남은 건 이기거나 지는 경우뿐이에요.",
          "이기는 경우는 elif me == \"가위\" and com == \"보\": 처럼 세 갈래로 하나씩 물어요. 셋 다 아니면 else로 진 거예요.",
          'if me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\nelif me == "바위" and com == ___:\n    result = "이겼어요"\nelif ___:\n    result = "이겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)',
        ],
        solution: 'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\nif me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\nelif me == "바위" and com == "가위":\n    result = "이겼어요"\nelif me == "보" and com == "바위":\n    result = "이겼어요"\nelse:\n    result = "졌어요"\nprint("결과:", result)\n',
        explain: "비김을 먼저 거르고, 이기는 세 경우를 하나씩 물었어요. 어느 것도 아니면 남은 건 지는 경우라 else 하나면 돼요.",
      },
      {
        goal: "가위·바위·보가 아닌 손 걸러 내기",
        task: "지금은 else가 「졌어요」를 맡아서, 엉뚱한 손을 내도 「졌어요」가 나와요. else 자리에 지는 세 경우(가위-바위, 바위-보, 보-가위)를 elif로 하나씩 적어 result에 「졌어요」를 담고, 맨 끝 else에서는 「가위·바위·보만 돼요」를 담아요.",
        tests: [
          { stdin: "바나나", rand: [1], expect: "나: 바나나\n컴퓨터: 가위\n결과: 가위·바위·보만 돼요", public: true },
          { stdin: "가위", rand: [3], expect: "나: 가위\n컴퓨터: 보\n결과: 이겼어요", public: false },
          { stdin: "보", rand: [3], expect: "나: 보\n컴퓨터: 보\n결과: 비겼어요", public: false },
          { stdin: "묵", rand: [2], expect: "나: 묵\n컴퓨터: 바위\n결과: 가위·바위·보만 돼요", public: false },
          { stdin: "가위", rand: [2], expect: "나: 가위\n컴퓨터: 바위\n결과: 졌어요", public: false },
          { stdin: "바위", rand: [3], expect: "나: 바위\n컴퓨터: 보\n결과: 졌어요", public: false },
          { stdin: "보", rand: [1], expect: "나: 보\n컴퓨터: 가위\n결과: 졌어요", public: false },
        ],
        require: ["Elif", "Else"],
        hints: [
          "엉뚱한 손은 비기지도 이기지도 않아요. 지는 경우까지 모두 적으면, 어디에도 안 맞아 남는 else가 바로 엉뚱한 손이에요.",
          "지는 경우는 이기는 경우를 뒤집은 거예요. 가위는 바위에게, 바위는 보에게, 보는 가위에게 져요.",
          'elif me == "가위" and com == "바위":\n    result = "졌어요"\nelif me == "바위" and com == ___:\n    result = "졌어요"\nelif ___:\n    result = "졌어요"\nelse:\n    result = "가위·바위·보만 돼요"\nprint("결과:", result)',
        ],
        solution: 'import random\n\nme = input()\nprint("나:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "가위"\nelif num == 2:\n    com = "바위"\nelse:\n    com = "보"\nprint("컴퓨터:", com)\nif me == com:\n    result = "비겼어요"\nelif me == "가위" and com == "보":\n    result = "이겼어요"\nelif me == "바위" and com == "가위":\n    result = "이겼어요"\nelif me == "보" and com == "바위":\n    result = "이겼어요"\nelif me == "가위" and com == "바위":\n    result = "졌어요"\nelif me == "바위" and com == "보":\n    result = "졌어요"\nelif me == "보" and com == "가위":\n    result = "졌어요"\nelse:\n    result = "가위·바위·보만 돼요"\nprint("결과:", result)\n',
        explain: "비김·이김·짐을 모두 적었으니, 어디에도 안 맞는 손만 마지막 else로 와요. 경우를 빠짐없이 나누면 else가 「그 밖의 것」을 맡아 줘요. 이제 진짜 한 판을 할 수 있어요!",
      },
    ],
  },
];
