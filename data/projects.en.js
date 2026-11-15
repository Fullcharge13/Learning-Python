// v0.21.0 Project Workshop data (English). Same ids, step counts, test counts and rand lengths as data/projects.js.
// Format: see the header of data/projects.js. Check: python3 tests/projects.py

export const PROJECTS = [
  {
    id: "P1", need: 3, icon: "play",
    title: "Rock Paper Scissors",
    blurb: "Play a round against the computer",
    intro: "Let's build Rock Paper Scissors! Add a little code at each step, and by the end you can play a real round against the computer.",
    finale: "You did it! Want to play a round of your very own Rock Paper Scissors with me? I'll keep it in the showcase so you can play any time.",
    play: { prompt: "Type rock, paper or scissors" },
    steps: [
      {
        goal: "Read your hand and show it",
        task: "The starter line me = input() already reads your hand into the variable me. Below it, add one print line that shows me after \"Me:\". Example: typing rock shows Me: rock",
        starter: "me = input()\n",
        tests: [
          { stdin: "rock", expect: "Me: rock", public: true },
          { stdin: "scissors", expect: "Me: scissors", public: false },
          { stdin: "paper", expect: "Me: paper", public: false },
        ],
        require: ["Call:input", "Call:print"],
        hints: [
          "Put values side by side in print, separated by commas, and they print with one space between them.",
          "\"Me:\" is text, so it goes in quotes. me is a variable, so write its name without quotes.",
          'me = input()\nprint("Me:", ___)',
        ],
        solution: 'me = input()\nprint("Me:", me)\n',
        explain: "Give print two values separated by a comma and they come out with a space between. Now your hand shows on screen.",
      },
      {
        goal: "Let the computer pick a random hand",
        tool: {
          title: "New tool: random",
          body: "random is a toolbox of chance that comes with Python. Write import random once at the top of your code to use it. random.randint(1, 3) picks one of 1, 2 or 3, and it can be different every run.",
          code: "import random\n\nnum = random.randint(1, 3)\nprint(num)",
        },
        task: "Write import random at the top. Below the \"Me:\" line, store a number from random.randint(1, 3) in num (call random only once, on this line). If num is 1, store \"rock\" in com; if 2, \"paper\"; if 3, \"scissors\". Then print com after \"Computer:\".",
        tests: [
          { stdin: "rock", rand: [2], expect: "Me: rock\nComputer: paper", public: true },
          { stdin: "scissors", rand: [3], expect: "Me: scissors\nComputer: scissors", public: false },
          { stdin: "paper", rand: [1], expect: "Me: paper\nComputer: rock", public: false },
        ],
        require: ["Import", "Method:randint", "If"],
        hints: [
          "Use if, elif and else to split into three branches: what goes in com when num is 1, 2 or 3?",
          "Call random.randint(1, 3) only once, on the num = line. If you call it again in each if, you get a new number every time.",
          'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "rock"\nelif num == ___:\n    com = "___"\nelse:\n    com = "___"\nprint("Computer:", com)',
        ],
        solution: 'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\n',
        explain: "You keep one random number in num, then if, elif and else turn it into a hand. If it's not 1 or 2 it must be 3, so else is enough.",
      },
      {
        goal: "Decide who wins",
        task: "Store the outcome in the variable result. If me and com are the same, it's \"It's a tie\". In the three cases where you win (rock-scissors, paper-rock, scissors-paper), it's \"You win\". Otherwise it's \"You lose\". At the bottom, print result after \"Result:\".",
        tests: [
          { stdin: "rock", rand: [3], expect: "Me: rock\nComputer: scissors\nResult: You win", public: true },
          { stdin: "paper", rand: [2], expect: "Me: paper\nComputer: paper\nResult: It's a tie", public: false },
          { stdin: "paper", rand: [1], expect: "Me: paper\nComputer: rock\nResult: You win", public: false },
          { stdin: "scissors", rand: [2], expect: "Me: scissors\nComputer: paper\nResult: You win", public: false },
          { stdin: "rock", rand: [2], expect: "Me: rock\nComputer: paper\nResult: You lose", public: false },
          { stdin: "scissors", rand: [1], expect: "Me: scissors\nComputer: rock\nResult: You lose", public: false },
          { stdin: "paper", rand: [3], expect: "Me: paper\nComputer: scissors\nResult: You lose", public: false },
          { stdin: "rock", rand: [1], expect: "Me: rock\nComputer: rock\nResult: It's a tie", public: false },
          { stdin: "scissors", rand: [3], expect: "Me: scissors\nComputer: scissors\nResult: It's a tie", public: false },
        ],
        require: ["Elif", "Else"],
        hints: [
          "First catch the tie with if me == com:. After that, the only cases left are winning or losing.",
          "Ask about each winning case in its own branch, like elif me == \"rock\" and com == \"scissors\":. If none of them match, else means you lost.",
          'if me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\nelif me == "paper" and com == ___:\n    result = "You win"\nelif ___:\n    result = "You win"\nelse:\n    result = "You lose"\nprint("Result:", result)',
        ],
        solution: 'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\nif me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\nelif me == "paper" and com == "rock":\n    result = "You win"\nelif me == "scissors" and com == "paper":\n    result = "You win"\nelse:\n    result = "You lose"\nprint("Result:", result)\n',
        explain: "You catch the tie first, then check the three winning cases one by one. If none of them match, the only thing left is a loss, so one else covers it.",
      },
      {
        goal: "Catch hands that aren't rock, paper or scissors",
        task: "Right now else handles \"You lose\", so even a made-up hand loses. In place of that else, add the three losing cases (rock-paper, paper-scissors, scissors-rock) as elif branches that store \"You lose\" in result. Then add a final else that stores \"Only rock, paper or scissors\".",
        tests: [
          { stdin: "banana", rand: [1], expect: "Me: banana\nComputer: rock\nResult: Only rock, paper or scissors", public: true },
          { stdin: "rock", rand: [3], expect: "Me: rock\nComputer: scissors\nResult: You win", public: false },
          { stdin: "scissors", rand: [3], expect: "Me: scissors\nComputer: scissors\nResult: It's a tie", public: false },
          { stdin: "Rock", rand: [2], expect: "Me: Rock\nComputer: paper\nResult: Only rock, paper or scissors", public: false },
          { stdin: "rock", rand: [2], expect: "Me: rock\nComputer: paper\nResult: You lose", public: false },
          { stdin: "paper", rand: [3], expect: "Me: paper\nComputer: scissors\nResult: You lose", public: false },
          { stdin: "scissors", rand: [1], expect: "Me: scissors\nComputer: rock\nResult: You lose", public: false },
        ],
        require: ["Elif", "Else"],
        hints: [
          "A made-up hand never ties and never wins. Once every losing case has its own branch too, whatever reaches the last else must be a made-up hand.",
          "Losing is winning flipped around: rock loses to paper, paper loses to scissors, scissors loses to rock.",
          'elif me == "rock" and com == "paper":\n    result = "You lose"\nelif me == "paper" and com == ___:\n    result = "You lose"\nelif ___:\n    result = "You lose"\nelse:\n    result = "Only rock, paper or scissors"\nprint("Result:", result)',
        ],
        solution: 'import random\n\nme = input()\nprint("Me:", me)\nnum = random.randint(1, 3)\nif num == 1:\n    com = "rock"\nelif num == 2:\n    com = "paper"\nelse:\n    com = "scissors"\nprint("Computer:", com)\nif me == com:\n    result = "It\'s a tie"\nelif me == "rock" and com == "scissors":\n    result = "You win"\nelif me == "paper" and com == "rock":\n    result = "You win"\nelif me == "scissors" and com == "paper":\n    result = "You win"\nelif me == "rock" and com == "paper":\n    result = "You lose"\nelif me == "paper" and com == "scissors":\n    result = "You lose"\nelif me == "scissors" and com == "rock":\n    result = "You lose"\nelse:\n    result = "Only rock, paper or scissors"\nprint("Result:", result)\n',
        explain: "Tie, win and lose all have their own branches now, so only a hand that matches none of them reaches the last else. When you cover every case, else takes care of everything else. Now you can play a real round!",
      },
    ],
  },
];
