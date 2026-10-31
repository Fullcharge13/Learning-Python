export const CHAPTER = { id: 16, title: "데이터베이스와 SQL" };

const J = (...lines) => lines.join("\n");

// 연습 DB 공통 앞부분 (실행마다 새 빈 DB)
const HEAD = ["import sqlite3", `conn = sqlite3.connect(":memory:")`, "cur = conn.cursor()"];

// SQL 글을 38칸에 맞게 여러 줄로 쪼갠다: Q("sel", "SELECT …", "FROM …")
const Q = (name, ...parts) => {
  if (parts.length === 1) return [`${name} = "${parts[0]}"`];
  return parts.map((p, i) => {
    const head = i === 0 ? `${name} = ("` : `${" ".repeat(name.length + 4)}"`;
    return head + p + (i === parts.length - 1 ? `")` : `"`);
  });
};

const MAKE = [...Q("make", "CREATE TABLE books ", "(title TEXT, genre TEXT, ", "year INTEGER)"), "cur.execute(make)"];

// 책 여러 권을 한 번에 넣는 INSERT
const INS = (rows) => {
  const out = [];
  rows.forEach((r, i) => {
    const last = i === rows.length - 1;
    const body = `('${r[0]}', '${r[1]}', ${r[2]})` + (last ? "" : ", ");
    const head = i === 0 ? `add = ("INSERT INTO books VALUES "` : null;
    if (head) out.push(head);
    out.push(`    "${body}"` + (last ? ")" : ""));
  });
  out.push("cur.execute(add)");
  return out;
};

const PRE = (rows) => [...HEAD, ...MAKE, ...INS(rows), "conn.commit()"];

const B4 = [["달빛 정원", "소설", 2021], ["별의 지도", "과학", 2019], ["작은 숲", "동화", 2023], ["구름 빵집", "동화", 2020]];
const B6 = [...B4, ["바다 일기", "시", 2015], ["옛날 시장", "역사", 2012]];

// 파이썬 리스트 줄 (16-4, 16-5): name = [("a", "b", 1),
const TUP = (r) => (typeof r[2] === "number" && typeof r[1] === "number")
  ? `("${r[0]}", ${r[1]}, ${r[2]})`
  : (typeof r[2] === "number" ? `("${r[0]}", "${r[1]}", ${r[2]})` : `("${r[0]}", "${r[1]}", "${r[2]}")`);
const LIST = (name, rows) => rows.map((r, i) => {
  const lead = i === 0 ? `${name} = [` : " ".repeat(name.length + 4);
  return lead + TUP(r) + (i === rows.length - 1 ? "]" : ",");
});

const INSQ = Q("ins", "INSERT INTO books ", "VALUES (?, ?, ?)");

// 16-2·16-3 과제: books.csv를 표에 넣는 starter (시험마다 파일을 바꿔 하드코딩을 막음)
const CSVPRE = [
  "import sqlite3", "import csv", `conn = sqlite3.connect(":memory:")`, "cur = conn.cursor()",
  ...MAKE, ...INSQ, `with open("books.csv") as f:`, "    data = csv.reader(f)", "    cur.executemany(ins, data)",
];
const CSV = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
const H4 = [["새벽 버스", "소설", 2022], ["봄비 편지", "시", 2019], ["시장 골목", "역사", 2020], ["하늘 정원", "동화", 2024]];
const H6 = [...H4, ["여름 바다", "시", 2018], ["가을 숲", "시", 2021]];

const LOANS = [
  ["달빛 정원", "하늘", 7], ["작은 숲", "하늘", 14], ["구름 빵집", "하늘", 3],
  ["별의 지도", "바다", 3], ["작은 숲", "바다", 5], ["달빛 정원", "바다", 10],
  ["옛날 시장", "나무", 1],
];
const LMAKE = [...Q("make", "CREATE TABLE loans ", "(book, member, days)"), "cur.execute(make)"];
const LINS = [...Q("ins", "INSERT INTO loans ", "VALUES (?, ?, ?)"), "cur.executemany(ins, loans)"];
const LPRE = [...HEAD, ...LMAKE, ...LIST("loans", LOANS), ...LINS];

const LOOP = (expr) => ["rows = cur.fetchall()", "for r in rows:", `    print(${expr})`];

export const LESSONS = [
  {
    id: "16-1", chapter: 16, title: "테이블 만들기",
    goal: "CREATE TABLE과 INSERT로 표를 만들고 채울 수 있다",
    summary: [
      "connect(\":memory:\")는 임시 연습 DB",
      "CREATE TABLE로 표를 만들어요",
      "INSERT INTO … VALUES로 한 줄 넣기",
    ],
    cards: [
      {
        say: "데이터베이스는 표 모양으로 데이터를 모아 두는 창고예요. connect(\":memory:\")는 임시 연습 DB라서 실행이 끝나면 사라져요. CREATE TABLE로 표를 만들고 INSERT로 채워요. commit()은 넣은 것을 확정해요.",
        code: J(
          ...PRE([["달빛 정원", "소설", 2021]]),
          ...Q("sel", "SELECT title, year ", "FROM books"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        out: "달빛 정원 2021",
      },
      {
        say: "문자열(TEXT)은 작은따옴표로, 숫자(INTEGER)는 따옴표 없이 써요. VALUES 뒤에 괄호 묶음을 쉼표로 이으면 여러 줄을 한 번에 넣어요. SQL 키워드는 보통 대문자로 써요.",
        code: J(
          ...PRE(B4.slice(0, 2)),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "달빛 정원\n별의 지도",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlcreate",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE([["바다 일기", "시", 2015]]),
          ...Q("sel", "SELECT title, year ", "FROM books"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        options: ["바다 일기 2015", "바다 일기 시", "시 2015"],
        answer: 0,
        explain: "SELECT에 title, year를 골랐으니 r[0]은 제목, r[1]은 연도예요. 장르 시는 고르지 않아서 나오지 않아요.",
      },
      {
        type: "choice", concept: "sqlcreate",
        q: "표에 책 한 권을 넣는 올바른 SQL은?",
        options: [
          "INSERT INTO books VALUES ('숲', '동화', 2023)",
          "INSERT books ('숲', '동화', 2023)",
          "ADD INTO books VALUES ('숲', '동화', 2023)",
        ],
        answer: 0,
        explain: "INSERT INTO 표이름 VALUES (값들) 모양이에요. 문자열 값은 작은따옴표, 숫자 값은 따옴표 없이 써요.",
      },
      {
        type: "choice", concept: "sqlcreate",
        q: "이 코드를 실행하면 어떻게 될까요?",
        code: J(
          ...HEAD,
          ...MAKE,
          ...Q("add", "INSERT INTO books ", `VALUES ('숲', 2020)`),
          "cur.execute(add)",
        ),
        options: ["오류 (OperationalError)", "정상으로 저장돼요", "빈 칸으로 저장돼요"],
        answer: 0,
        explain: "표에는 열이 3개(title, genre, year)인데 값을 2개만 줬어요. 값의 개수는 열의 개수와 같아야 해요.",
      },
      {
        type: "blank", concept: "sqlcreate",
        q: "바다 일기가 찍히도록 빈칸을 채워 보세요.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...Q("add", "INSERT INTO books ", `___ ('바다 일기', `, `'시', 2015)`),
          "cur.execute(add)",
          `cur.execute("SELECT title FROM books")`,
          "print(cur.fetchall()[0][0])",
        ),
        chips: ["VALUES", "SET", "INTO"],
        answer: 0,
        explain: "값을 줄 때는 INSERT INTO 표 VALUES (…)예요. SET이나 INTO를 또 쓰면 SQL 문법이 틀려서 OperationalError가 나요.",
      },
      {
        type: "order", concept: "sqlcreate",
        q: "빈 표의 줄 수 0이 찍히게 놓아 보세요.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("CREATE TABLE t (n)")`,
          `cur.execute("SELECT COUNT(*) FROM t")`,
          "print(cur.fetchone()[0])",
        ],
        expect: "0",
        explain: "표를 먼저 만들어야 조회할 수 있어요. 줄을 하나도 넣지 않았으니 COUNT(*)는 0이에요. 조회(execute) 뒤에 결과를 꺼내요.",
      },
      {
        type: "write", concept: "sqlcreate",
        task: "connect(\":memory:\")와 cursor로 books(title TEXT, genre TEXT, year INTEGER) 표를 만들어요. INSERT로 달빛 정원(소설, 2021), 별의 지도(과학, 2019)를 넣고 ORDER BY year로 execute·fetchall, for로 「제목 (연도)」 출력해요. 첫 줄 별의 지도 (2019)",
        starter: "import sqlite3\n",
        tests: [
          { stdin: "", expect: "별의 지도 (2019)\n달빛 정원 (2021)", public: true },
        ],
        require: ["Method:connect", "Method:execute", "Method:fetchall", "For"],
        hints: [
          "표를 만드는 일, 두 권을 넣는 일, 꺼내서 찍는 일 세 단계예요. 순서가 중요해요.",
          "CREATE TABLE로 표를 만든 뒤에야 INSERT가 되고, 그 뒤에 SELECT로 꺼낼 수 있어요.",
          "SQL 글은 cur.execute(…)에 넣고, SELECT 뒤에는 cur.fetchall()로 모든 줄을 가져와 for로 돌아요.",
          "cur.execute(\"CREATE TABLE books (title TEXT, genre TEXT, year INTEGER)\")  (길면 나눠 써요)\n(두 번 INSERT 후)\nfor r in rows:\n    print(f\"{r[0]} ({___})\")",
        ],
        solution: J(
          ...PRE(B4.slice(0, 2)),
          ...Q("sel", "SELECT title, year ", "FROM books ", "ORDER BY year"),
          "cur.execute(sel)",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]} ({r[1]})")`,
        ),
        explain: "ORDER BY year로 연도가 작은 순서가 정해져서 별의 지도가 먼저 나와요. 순서가 중요할 때는 ORDER BY를 꼭 붙여요.",
      },
      {
        type: "check", concept: "sqlcreate",
        q: "CREATE TABLE이 하는 일은?",
        options: ["열 이름이 있는 빈 표를 만들어요", "표에 값을 한 줄 넣어요", "표의 값을 화면에 보여 줘요"],
        answer: 0,
        explain: "CREATE TABLE은 빈 표(열 이름과 종류)만 만들어요. 값을 넣는 일은 INSERT, 보는 일은 SELECT가 맡아요.",
      },
    ],
  },
  {
    id: "16-2", chapter: 16, title: "SELECT로 조회",
    goal: "WHERE로 조건에 맞는 줄만 꺼낼 수 있다",
    summary: [
      "SELECT 열 FROM 표",
      "WHERE 뒤에 조건을 써요",
      "문자열 값은 작은따옴표, 같다는 =",
    ],
    cards: [
      {
        say: "SELECT는 어떤 열을 꺼낼지 고르고, WHERE는 어떤 줄만 꺼낼지 걸러요. 여기서는 2020년 이후에 나온 책만 골라 연도 순서로 꺼내요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title, year ", "FROM books ", "WHERE year >= 2020 ", "ORDER BY year"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        out: "구름 빵집 2020\n달빛 정원 2021\n작은 숲 2023",
      },
      {
        say: "같은지 볼 때는 =를 하나만 써요. 문자열은 작은따옴표로 감싸고, 조건은 AND로 이어요. SELECT *는 모든 열이고, 한 줄은 튜플로 와요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT * FROM books ", "WHERE genre = '동화' ", "AND year > 2020"),
          "cur.execute(sel)",
          ...LOOP("r"),
        ),
        out: "('작은 숲', '동화', 2023)",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlselect",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE year > 2020 ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["달빛 정원\n작은 숲", "구름 빵집\n달빛 정원\n작은 숲", "작은 숲"],
        answer: 0,
        explain: "year > 2020은 2020을 뺀 2021과 2023이에요. 달빛 정원과 작은 숲이 title 순으로 나와요.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = '동화' ", "AND year < 2023"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["구름 빵집", "작은 숲", "구름 빵집\n작은 숲"],
        answer: 0,
        explain: "AND는 두 조건을 모두 만족해야 해요. 동화 중에 2023보다 작은 해는 2020년 구름 빵집뿐이에요.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "이 코드를 실행하면 어떻게 될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = 동화"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["오류 (OperationalError)", "구름 빵집\n작은 숲", "빈 줄"],
        answer: 0,
        explain: "따옴표가 없으면 동화를 열 이름으로 읽어요. 그런 열이 없어서 단서가 나와요. 문자열 값은 작은따옴표로 감싸요.",
      },
      {
        type: "blank", concept: "sqlselect",
        q: "2020년 이후(2020 포함) 책이 나오도록 채워요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title ", "FROM books ", "WHERE year ___ 2020 ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        chips: [">=", "=>", "=="],
        answer: 0,
        explain: "이상은 >=예요. =>는 SQL에 없는 모양이라 단서가 나고, ==는 2020년 책 하나만 골라 구름 빵집만 나와요.",
      },
      {
        type: "order", concept: "sqlselect",
        q: "계산 결과 2가 찍히게 놓아 보세요.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("SELECT 1 + 1")`,
          "rows = cur.fetchall()",
          "print(rows[0][0])",
        ],
        expect: "2",
        explain: "SELECT는 표 없이 계산만 해도 돼요. execute로 물은 뒤에 fetchall로 가져오고, 첫 줄의 첫 값을 찍어요.",
      },
      {
        type: "write", concept: "sqlselect",
        task: "starter가 books.csv의 책을 books 표에 넣어 둬요(?는 16-4에서 배워요). SELECT title, year에 WHERE year >= 2020을 걸고 year 순(ORDER BY)으로 execute·fetchall해, for로 「제목 연도」를 출력해요. 첫 줄은 구름 빵집 2020",
        starter: J(...CSVPRE, ""),
        files: { "books.csv": CSV(B6) },
        tests: [
          { stdin: "", expect: "구름 빵집 2020\n달빛 정원 2021\n작은 숲 2023", public: true },
          { stdin: "", expect: "시장 골목 2020\n새벽 버스 2022\n하늘 정원 2024", public: false, files: { "books.csv": CSV(H4) } },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "표에 책이 몇 권 있든 2020년 이후만 골라 연도가 작은 순으로 찍어요.",
          "방금 배운 WHERE가 줄을 거르고, ORDER BY가 순서를 정해요.",
          "WHERE year >= 2020 다음에 ORDER BY year를 이어 쓰고, execute 뒤 fetchall로 가져와 for로 돌아요.",
          "sel = (\"SELECT title, year \"\n       \"FROM books \"\n       \"WHERE year >= ___ \"\n       \"ORDER BY year\")\n(이어서 execute, fetchall, for)",
        ],
        solution: J(
          ...CSVPRE,
          ...Q("sel", "SELECT title, year ", "FROM books ", "WHERE year >= 2020 ", "ORDER BY year"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        explain: "WHERE가 2020년 이후 책만 남겼고, ORDER BY year가 연도순을 정해 줬어요. 이상(>=)이라 2020년 책도 포함돼요.",
      },
      {
        type: "check", concept: "sqlselect",
        q: "SELECT ... WHERE year >= 2020에서 WHERE의 역할은?",
        options: ["조건에 맞는 줄만 걸러요", "열 이름을 바꿔요", "줄을 정렬해요"],
        answer: 0,
        explain: "WHERE는 조건에 맞는 줄만 남겨요. 정렬은 ORDER BY가 맡고, 어떤 열을 보일지는 SELECT 뒤에 써요.",
      },
    ],
  },
  {
    id: "16-3", chapter: 16, title: "정렬과 집계",
    goal: "ORDER BY, COUNT, AVG, GROUP BY를 쓸 수 있다",
    summary: [
      "ORDER BY 열 DESC는 큰 순서",
      "COUNT(*)는 줄 수, AVG는 평균",
      "GROUP BY로 묶고 ORDER BY로 순서",
    ],
    cards: [
      {
        say: "ORDER BY 열 DESC는 큰 것부터 정렬해요. 쉼표로 열을 이으면 값이 같을 때의 기준이 돼요. 여기서는 최근 책부터 보여 줘요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY year DESC, title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "작은 숲\n달빛 정원\n구름 빵집\n별의 지도",
      },
      {
        say: "GROUP BY는 같은 장르끼리 묶어 COUNT(권수)와 AVG(평균)를 구해요. 한 줄만 올 때는 fetchone()이 편해요. 묶음 결과도 ORDER BY로 순서를 정해요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT genre, COUNT(*), ", "AVG(year) FROM books ", "GROUP BY genre ", "ORDER BY genre"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1], r[2]"),
          ...Q("cnt", "SELECT COUNT(*) ", "FROM books"),
          "cur.execute(cnt)",
          "print(cur.fetchone()[0])",
        ),
        out: "과학 1 2019.0\n동화 2 2021.5\n소설 1 2021.0\n4",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlagg",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY year DESC"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["작은 숲", "별의 지도", "달빛 정원"],
        answer: 0,
        explain: "DESC는 큰 값부터예요. year가 가장 큰 2023년 책이 맨 앞이고, fetchone은 그 첫 줄만 가져와요.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT COUNT(*) FROM books ", "WHERE genre = '동화'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2", "4", "(2,)"],
        answer: 0,
        explain: "동화는 작은 숲과 구름 빵집 두 권이에요. fetchone()이 주는 한 줄은 (2,)이고, [0]으로 값을 꺼내 2가 돼요.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT AVG(year) FROM books ", "WHERE genre = '동화'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2021.5", "2021", "2023"],
        answer: 0,
        explain: "동화는 2023년과 2020년이에요. 두 값의 평균은 2021.5이고, AVG는 정수로 딱 떨어져도 소수 모양으로 와요.",
      },
      {
        type: "blank", concept: "sqlagg",
        q: "장르별 권수가 나오도록 빈칸을 채워 보세요.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT genre, COUNT(*) ", "FROM books ", "GROUP BY ___ ", "ORDER BY genre"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        chips: ["genre", "year", "COUNT"],
        answer: 0,
        explain: "같은 장르끼리 묶으려면 GROUP BY genre예요. year로 묶으면 연도마다 한 줄이 되고, COUNT는 열이 아니라 단서가 나요.",
      },
      {
        type: "order", concept: "sqlagg",
        q: "4의 평균 4.0이 찍히게 놓아 보세요.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("SELECT AVG(4)")`,
          "row = cur.fetchone()",
          "print(row[0])",
        ],
        expect: "4.0",
        explain: "SELECT로 먼저 물어야 fetchone이 줄을 가져와요. AVG는 정수만 줘도 소수 모양(4.0)으로 돌아와요.",
      },
      {
        type: "write", concept: "sqlagg",
        task: "starter가 books.csv의 책을 books 표에 넣어 둬요(?는 16-4에서 배워요). SELECT genre, COUNT(*)를 GROUP BY genre로 묶고 ORDER BY genre로 정렬해 execute·fetchall해요. for로 「장르 N권」을 출력해요. 첫 줄은 과학 1권",
        starter: J(...CSVPRE, ""),
        files: { "books.csv": CSV(B6) },
        tests: [
          { stdin: "", expect: "과학 1권\n동화 2권\n소설 1권\n시 1권\n역사 1권", public: true },
          { stdin: "", expect: "동화 1권\n소설 1권\n시 3권\n역사 1권", public: false, files: { "books.csv": CSV(H6) } },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "장르마다 몇 권인지 세어요. 같은 장르는 한 줄로 묶여야 해요.",
          "방금 배운 GROUP BY와 COUNT(*)를 함께 쓰고, ORDER BY로 순서를 정해요.",
          "SELECT 뒤에 genre와 COUNT(*)를 쓰고, GROUP BY genre, ORDER BY genre를 이어요. 출력은 r[0]과 r[1]이에요.",
          "sel = (\"SELECT genre, COUNT(*) \"\n       \"FROM books \"\n       \"GROUP BY ___ \"\n       \"ORDER BY genre\")\n(이어서 execute, fetchall, for)",
        ],
        solution: J(
          ...CSVPRE,
          ...Q("sel", "SELECT genre, COUNT(*) ", "FROM books ", "GROUP BY genre ", "ORDER BY genre"),
          "cur.execute(sel)",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]} {r[1]}권")`,
        ),
        explain: "GROUP BY genre가 같은 장르를 한 줄로 묶고 COUNT(*)가 권수를 세요. ORDER BY genre로 순서도 고정돼요.",
      },
      {
        type: "check", concept: "sqlagg",
        q: "GROUP BY genre를 쓰는 이유는?",
        options: ["같은 장르끼리 묶어 집계하려고", "장르를 지우려고", "장르만 거꾸로 세우려고"],
        answer: 0,
        explain: "GROUP BY는 같은 값끼리 한 묶음으로 만들어 COUNT나 AVG를 묶음마다 구하게 해요. 묶음의 순서는 ORDER BY로 정해요.",
      },
    ],
  },
  {
    id: "16-4", chapter: 16, title: "Python과 함께",
    goal: "반복과 ?로 Python 값을 DB에 안전하게 넣을 수 있다",
    summary: [
      "for로 돌며 execute를 여러 번",
      "값 자리는 ?, 값은 튜플로 넘기기",
      "글을 이어 붙이면 위험하니 ?를 써요",
    ],
    cards: [
      {
        say: "SQL에서 값이 들어갈 자리를 ?로 비워 두고, 값은 튜플로 따로 넘겨요. 리스트의 책을 for로 한 권씩 넣을 수 있어요.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "new = [(\"달빛 정원\", \"소설\", 2021),",
          "       (\"작은 숲\", \"동화\", 2023)]",
          "for b in new:",
          "    cur.execute(ins, b)",
          ...Q("sel", "SELECT title FROM books ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "달빛 정원\n작은 숲",
      },
      {
        say: "값이 하나여도 (값,)처럼 쉼표를 붙인 튜플이에요. 값을 글로 이어 붙이면 위험해요(SQL 주입). ?로 넘기면 안전해요. executemany는 리스트를 한 번에 넣어요.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "new = [(\"달빛 정원\", \"소설\", 2021),",
          "       (\"작은 숲\", \"동화\", 2023),",
          "       (\"구름 빵집\", \"동화\", 2020)]",
          "cur.executemany(ins, new)",
          "genre = input()",
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = ? ", "ORDER BY title"),
          "cur.execute(sel, (genre,))",
          ...LOOP("r[0]"),
        ),
        stdin: "동화",
        out: "구름 빵집\n작은 숲",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlpy",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...HEAD,
          `cur.execute("CREATE TABLE t (n)")`,
          ...Q("ins", "INSERT INTO t VALUES (?)"),
          "for n in [4, 5]:",
          "    cur.execute(ins, (n,))",
          `cur.execute("SELECT COUNT(*) FROM t")`,
          "print(cur.fetchone()[0])",
        ),
        options: ["2", "9", "4"],
        answer: 0,
        explain: "for가 4와 5를 하나씩 꺼내 INSERT를 두 번 실행했어요. 그래서 줄은 2개이고 COUNT(*)는 2예요.",
      },
      {
        type: "choice", concept: "sqlpy",
        q: "이 코드를 실행하면 어떻게 될까요?",
        code: J(
          ...HEAD,
          `cur.execute("CREATE TABLE t (g)")`,
          ...Q("ins", "INSERT INTO t VALUES (?)"),
          "g = \"동화\"",
          "cur.execute(ins, (g))",
        ),
        options: ["오류 (ProgrammingError)", "정상으로 저장돼요", "빈 칸으로 저장돼요"],
        answer: 0,
        explain: "(g)는 튜플이 아니라 그냥 g예요. 동화 두 글자가 값 2개로 읽혀 ?는 하나인데 값이 둘이라 단서가 나요. (g,)로 써요.",
      },
      {
        type: "choice", concept: "sqlpy",
        q: "값을 넣는 가장 안전한 방법은?",
        options: [
          "cur.execute(sel, (genre,))  (SQL에는 ?)",
          "SQL 글에 genre를 + 로 이어 붙여요",
          "SQL 글에 f-문자열로 genre를 넣어요",
        ],
        answer: 0,
        explain: "글을 이어 붙이면 입력에 SQL 명령을 숨겨 넣는 공격(SQL 주입)에 위험해요. ?와 튜플로 넘기면 값은 값으로만 다뤄요.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "6보다 큰 8, 12가 나오게 빈칸을 채워 보세요.",
        code: J(
          ...HEAD,
          `cur.execute("CREATE TABLE t (n)")`,
          ...Q("ins", "INSERT INTO t VALUES (?)"),
          "nums = [(5,), (8,), (12,)]",
          "cur.executemany(ins, nums)",
          ...Q("sel", "SELECT n FROM t ", "WHERE n > ___ ORDER BY n"),
          "cur.execute(sel, (6,))",
          ...LOOP("r[0]"),
        ),
        chips: ["?", "n", "%s"],
        answer: 0,
        explain: "값 자리는 ?예요. n을 쓰면 SQL에 ?가 없어 넘긴 (6,)이 들어갈 자리가 없다는 단서가 나요. %s는 SQLite 문법이 아니라 단서가 나요.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "리스트를 한 번에 넣어 2가 나오게 채워 보세요.",
        code: J(
          ...HEAD,
          `cur.execute("CREATE TABLE t (n)")`,
          ...Q("ins", "INSERT INTO t VALUES (?)"),
          "nums = [(5,), (8,)]",
          "cur.___(ins, nums)",
          `cur.execute("SELECT COUNT(*) FROM t")`,
          "print(cur.fetchone()[0])",
        ),
        chips: ["executemany", "execute", "fetchall"],
        answer: 0,
        explain: "여러 묶음을 한 번에 넣는 건 executemany예요. execute는 한 묶음만 받아 단서가 나고, fetchall은 값을 받지 않아요.",
      },
      {
        type: "write", concept: "sqlpy",
        task: "표에 책 2권이 이미 있어요. input()(괄호 비움)으로 title, genre, year(정수)를 차례로 받아 ?와 튜플로 INSERT해요. 모든 책을 year, title 순(ORDER BY)으로 execute·fetchall해 for로 「제목 (연도)」를 출력해요. 작은 숲, 동화, 2023이면 마지막 줄 작은 숲 (2023)",
        starter: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "seed = [(\"달빛 정원\", \"소설\", 2021),",
          "        (\"별의 지도\", \"과학\", 2019)]",
          "cur.executemany(ins, seed)",
          "",
        ),
        tests: [
          { stdin: "작은 숲\n동화\n2023", expect: "별의 지도 (2019)\n달빛 정원 (2021)\n작은 숲 (2023)", public: true },
          { stdin: "옛날 시장\n역사\n2012", expect: "옛날 시장 (2012)\n별의 지도 (2019)\n달빛 정원 (2021)", public: false },
          { stdin: "가을 노래\n시\n2019", expect: "가을 노래 (2019)\n별의 지도 (2019)\n달빛 정원 (2021)", public: false },
          { stdin: "아저씨's 책\n수필\n2021", expect: "별의 지도 (2019)\n달빛 정원 (2021)\n아저씨's 책 (2021)", public: false },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "입력한 책이 어떤 해이든, 같은 해라면 제목 순서로 자리가 정해져야 해요.",
          "방금 배운 ?와 튜플이에요. 값 세 개를 (title, genre, year)로 묶어 넘겨요.",
          "INSERT는 ins와 튜플로 하고, SELECT에는 ORDER BY year, title을 써서 fetchall 뒤 for로 찍어요.",
          "title = input()\ngenre = input()\nyear = int(input())\ncur.execute(ins, (title, genre, ___))\n(이어서 SELECT, fetchall, for로 출력)",
        ],
        solution: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "seed = [(\"달빛 정원\", \"소설\", 2021),",
          "        (\"별의 지도\", \"과학\", 2019)]",
          "cur.executemany(ins, seed)",
          "title = input()",
          "genre = input()",
          "year = int(input())",
          "cur.execute(ins, (title, genre, year))",
          ...Q("sel", "SELECT title, year ", "FROM books ", "ORDER BY year, title"),
          "cur.execute(sel)",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]} ({r[1]})")`,
        ),
        explain: "?와 튜플로 넘기면 제목에 작은따옴표가 있어도 안전해요. ORDER BY year, title이라 같은 해에도 순서가 정해져요.",
      },
      {
        type: "check", concept: "sqlpy",
        q: "값이 하나일 때 알맞은 튜플은?",
        options: ["(genre,)", "(genre)", "[genre"],
        answer: 0,
        explain: "튜플은 쉼표가 만들어요. (genre)는 그냥 genre라서 글자 하나하나가 값으로 읽힐 수 있어요. 값 하나도 (값,)로 써요.",
      },
    ],
  },
  {
    id: "16-5", chapter: 16, title: "16장 평가", isExam: true,
    goal: "동네 도서관 대출 기록을 DB로 다룰 수 있다",
    summary: [
      "CREATE·INSERT로 표를 만들고 채우기",
      "WHERE·ORDER BY·집계로 꺼내기",
      "값은 ?와 튜플로 안전하게",
    ],
    cards: [
      {
        say: "동네 도서관의 대출 기록을 임시 DB에 넣어 볼게요. 표를 만들고, executemany로 채우고, GROUP BY로 회원별 대출 수와 평균 대출일을 구해요.",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT member, COUNT(*), ", "AVG(days) FROM loans ", "GROUP BY member ", "ORDER BY member"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1], r[2]"),
        ),
        out: "나무 1 1.0\n바다 3 6.0\n하늘 3 8.0",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlcreate",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...LPRE,
          ...Q("cnt", "SELECT COUNT(*) ", "FROM loans"),
          "cur.execute(cnt)",
          "print(cur.fetchone()[0])",
        ),
        options: ["7", "6", "3"],
        answer: 0,
        explain: "loans 리스트에는 대출 기록이 7건 있고 executemany가 모두 넣었어요. COUNT(*)는 줄 수이므로 7이에요.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT book FROM loans ", "WHERE days >= 7 ", "ORDER BY book"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["달빛 정원\n달빛 정원\n작은 숲", "달빛 정원\n작은 숲", "작은 숲\n달빛 정원\n달빛 정원"],
        answer: 0,
        explain: "7일 이상인 기록은 달빛 정원(7일), 작은 숲(14일), 달빛 정원(10일)이에요. 같은 책도 기록마다 한 줄씩 나와요.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT AVG(days) FROM loans ", "WHERE member = '바다'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["6.0", "6", "18"],
        answer: 0,
        explain: "바다의 대출일은 3, 5, 10일이에요. 합 18을 3으로 나눈 평균이 6.0이고 AVG는 소수 모양으로 와요.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "바다의 기록이 나오도록 빈칸을 채워 보세요.",
        code: J(
          ...LPRE,
          "who = \"바다\"",
          ...Q("sel", "SELECT book FROM loans ", "WHERE member = ___ ", "ORDER BY book"),
          "cur.execute(sel, (who,))",
          ...LOOP("r[0]"),
        ),
        chips: ["?", "who", "%s"],
        answer: 0,
        explain: "값 자리는 ?이고 값은 튜플 (who,)로 넘겨요. who를 SQL 글에 쓰면 그런 열이 없어 단서가 나요.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "화면에 무엇이 출력될까요?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT book FROM loans ", "ORDER BY days DESC"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["작은 숲", "달빛 정원", "구름 빵집"],
        answer: 0,
        explain: "days DESC는 대출일이 긴 것부터예요. 14일로 가장 오래 빌린 작은 숲이 첫 줄이고 fetchone이 그 줄만 가져와요.",
      },
      {
        type: "write", concept: "sqlpy",
        task: "loans(book, member, days) 표를 CREATE TABLE로 만들고 리스트를 executemany로 넣어요. input()(괄호 비움)으로 받은 member의 기록을 ?와 튜플로 book 순(ORDER BY) fetchall해 for로 「책 N일」, COUNT(*)를 fetchone해 「총 N건」을 출력해요. 하늘이면 마지막 줄 총 3건",
        starter: J(...HEAD, ...LIST("loans", LOANS), ""),
        tests: [
          { stdin: "하늘", expect: "구름 빵집 3일\n달빛 정원 7일\n작은 숲 14일\n총 3건", public: true },
          { stdin: "바다", expect: "달빛 정원 10일\n별의 지도 3일\n작은 숲 5일\n총 3건", public: false },
          { stdin: "나무", expect: "옛날 시장 1일\n총 1건", public: false },
          { stdin: "별", expect: "총 0건", public: false },
        ],
        require: ["Method:execute", "Method:executemany", "Method:fetchall", "Method:fetchone", "For"],
        hints: [
          "회원마다 기록 수가 달라요. 기록이 하나도 없는 회원도 있어요.",
          "표 만들기, executemany, ?와 튜플로 조회, 그리고 COUNT를 떠올려요.",
          "기록 조회와 개수 조회에 모두 WHERE member = ?를 쓰고, 값은 (member,)로 넘겨요. 개수는 fetchone()[0]이에요.",
          "member = input()\n(표 만들기, executemany 후)\ncur.execute(sel, (___,))\nrows = cur.fetchall()\n(이어서 for 출력, COUNT(*), fetchone)",
        ],
        solution: J(
          ...HEAD,
          ...LIST("loans", LOANS),
          ...LMAKE,
          ...LINS,
          "member = input()",
          ...Q("sel", "SELECT book, days ", "FROM loans ", "WHERE member = ? ", "ORDER BY book"),
          "cur.execute(sel, (member,))",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]} {r[1]}일")`,
          ...Q("cnt", "SELECT COUNT(*) ", "FROM loans ", "WHERE member = ?"),
          "cur.execute(cnt, (member,))",
          "n = cur.fetchone()[0]",
          `print(f"총 {n}건")`,
        ),
        explain: "기록이 없는 회원도 for가 한 번도 돌지 않고 총 0건이 나와요. ?와 튜플 덕에 입력값이 무엇이든 안전하게 조회돼요.",
      },
      {
        type: "check", concept: "sqlpy",
        q: "cur.execute(sel, (member,))에서 쉼표가 필요한 이유는?",
        options: ["값 하나짜리 튜플을 만들려고", "SQL 글을 둘로 나누려고", "member를 지우려고"],
        answer: 0,
        explain: "(member)는 튜플이 아니라 그냥 member예요. 쉼표를 붙여야 값이 하나인 튜플이 되어 ?에 알맞게 들어가요.",
      },
    ],
  },
];
