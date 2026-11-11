// Chapter 16 "Databases and SQL" lessons (English). Source: data/lessons/ch16.js. Check: python3 tests/content.py --lang en
// Korean book titles, genres and member names became English titles, short genre words and romanized names.
// ORDER BY results were recomputed by running the code (English sorts differently from Korean).
export const CHAPTER = { id: 16, title: "Databases and SQL" };

const J = (...lines) => lines.join("\n");

// Shared start for practice DBs (a fresh empty DB every run)
const HEAD = ["import sqlite3", `conn = sqlite3.connect(":memory:")`, "cur = conn.cursor()"];

// Split SQL text over several lines to fit 38 columns: Q("sel", "SELECT …", "FROM …")
const Q = (name, ...parts) => {
  if (parts.length === 1) return [`${name} = "${parts[0]}"`];
  return parts.map((p, i) => {
    const head = i === 0 ? `${name} = ("` : `${" ".repeat(name.length + 4)}"`;
    return head + p + (i === parts.length - 1 ? `")` : `"`);
  });
};

const MAKE = [...Q("make", "CREATE TABLE books ", "(title TEXT, genre TEXT, ", "year INTEGER)"), "cur.execute(make)"];

// One INSERT that adds several books at once
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

const B4 = [["Moon Garden", "novel", 2021], ["Star Map", "science", 2019], ["Tiny Forest", "kids", 2023], ["Cloud Bakery", "kids", 2020]];
const B6 = [...B4, ["Ocean Diary", "poem", 2015], ["Old Market", "history", 2012]];

// Python list lines (16-4, 16-5): name = [("a", "b", 1),
const TUP = (r) => (typeof r[2] === "number" && typeof r[1] === "number")
  ? `("${r[0]}", ${r[1]}, ${r[2]})`
  : (typeof r[2] === "number" ? `("${r[0]}", "${r[1]}", ${r[2]})` : `("${r[0]}", "${r[1]}", "${r[2]}")`);
const LIST = (name, rows) => rows.map((r, i) => {
  const lead = i === 0 ? `${name} = [` : " ".repeat(name.length + 4);
  return lead + TUP(r) + (i === rows.length - 1 ? "]" : ",");
});

const INSQ = Q("ins", "INSERT INTO books ", "VALUES (?, ?, ?)");

// 16-2 and 16-3 tasks: starter that loads books.csv into the table (each test swaps the file to stop hard-coding)
const CSVPRE = [
  "import sqlite3", "import csv", `conn = sqlite3.connect(":memory:")`, "cur = conn.cursor()",
  ...MAKE, ...INSQ, `with open("books.csv") as f:`, "    data = csv.reader(f)", "    cur.executemany(ins, data)",
];
const CSV = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
const H4 = [["Dawn Bus", "novel", 2022], ["Rain Letter", "poem", 2019], ["Market Alley", "history", 2020], ["Sky Garden", "kids", 2024]];
const H6 = [...H4, ["Summer Sea", "poem", 2018], ["Autumn Woods", "poem", 2021]];

const LOANS = [
  ["Moon Garden", "Yuna", 7], ["Tiny Forest", "Yuna", 14], ["Cloud Bakery", "Yuna", 3],
  ["Star Map", "Jun", 3], ["Tiny Forest", "Jun", 5], ["Moon Garden", "Jun", 10],
  ["Old Market", "Dami", 1],
];
const LMAKE = [...Q("make", "CREATE TABLE loans ", "(book, member, days)"), "cur.execute(make)"];
const LINS = [...Q("ins", "INSERT INTO loans ", "VALUES (?, ?, ?)"), "cur.executemany(ins, loans)"];
const LPRE = [...HEAD, ...LMAKE, ...LIST("loans", LOANS), ...LINS];

const LOOP = (expr) => ["rows = cur.fetchall()", "for r in rows:", `    print(${expr})`];

// 16-4 seed books (wrapped so each line fits 38 columns)
const SEED = ["seed = [", "    (\"Moon Garden\", \"novel\", 2021),", "    (\"Star Map\", \"science\", 2019)]", "cur.executemany(ins, seed)"];

export const LESSONS = [
  {
    id: "16-1", chapter: 16, title: "Make a table",
    goal: "Make a table and fill it with CREATE TABLE and INSERT",
    summary: [
      "connect(\":memory:\") is a temporary practice DB",
      "CREATE TABLE makes a table",
      "INSERT INTO … VALUES adds one row",
    ],
    cards: [
      {
        say: "A database is a storeroom that keeps data in tables. connect(\":memory:\") is a temporary practice DB, so it vanishes when the run ends. CREATE TABLE makes a table and INSERT fills it. commit() locks in what you added.",
        code: J(
          ...PRE([["Moon Garden", "novel", 2021]]),
          ...Q("sel", "SELECT title, year ", "FROM books"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        out: "Moon Garden 2021",
      },
      {
        say: "Text (TEXT) goes in single quotes; numbers (INTEGER) go without quotes. Chain groups in parentheses with commas after VALUES and you add several rows at once. SQL keywords are usually written in capitals.",
        code: J(
          ...PRE(B4.slice(0, 2)),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "Moon Garden\nStar Map",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlcreate",
        q: "What's the output?",
        code: J(
          ...PRE([["Ocean Diary", "poem", 2015]]),
          ...Q("sel", "SELECT title, year ", "FROM books"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        options: ["Ocean Diary 2015", "Ocean Diary poem", "poem 2015"],
        answer: 0,
        explain: "SELECT picked title and year, so r[0] is the title and r[1] is the year. The genre, poem, wasn't picked, so it doesn't show up.",
      },
      {
        type: "choice", concept: "sqlcreate",
        q: "Which SQL correctly adds one book to the table?",
        options: [
          "INSERT INTO books VALUES ('Forest', 'kids', 2023)",
          "INSERT books ('Forest', 'kids', 2023)",
          "ADD INTO books VALUES ('Forest', 'kids', 2023)",
        ],
        answer: 0,
        explain: "The shape is INSERT INTO table VALUES (values). Text values go in single quotes; number values go without.",
      },
      {
        type: "choice", concept: "sqlcreate",
        q: "What happens when you run this code?",
        code: J(
          ...HEAD,
          ...MAKE,
          ...Q("add", "INSERT INTO books ", `VALUES ('Forest', 2020)`),
          "cur.execute(add)",
        ),
        options: ["It causes an error (OperationalError)", "It saves normally", "It saves a blank cell"],
        answer: 0,
        explain: "The table has 3 columns (title, genre, year), but only 2 values were given, so you get an OperationalError clue. The number of values must match the number of columns.",
      },
      {
        type: "blank", concept: "sqlcreate",
        q: "Fill in the blank so Ocean Diary is printed.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...Q("add", "INSERT INTO books ", `___ ('Ocean Diary', `, `'poem', 2015)`),
          "cur.execute(add)",
          `cur.execute("SELECT title FROM books")`,
          "print(cur.fetchall()[0][0])",
        ),
        chips: ["VALUES", "SET", "INTO"],
        answer: 0,
        explain: "To give values, write INSERT INTO table VALUES (…). SET or a second INTO breaks the SQL grammar, so you get an OperationalError.",
      },
      {
        type: "order", concept: "sqlcreate",
        q: "Put the lines in order so an empty table's row count, 0, is printed.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("CREATE TABLE t (n)")`,
          `cur.execute("SELECT COUNT(*) FROM t")`,
          "print(cur.fetchone()[0])",
        ],
        expect: "0",
        explain: "The table has to exist before you can query it. No rows were added, so COUNT(*) is 0. Fetch the result after the query (execute).",
      },
      {
        type: "write", concept: "sqlcreate",
        task: "Use connect(\":memory:\") and a cursor to make the table books(title TEXT, genre TEXT, year INTEGER). INSERT Moon Garden (novel, 2021) and Star Map (science, 2019). Then SELECT them with ORDER BY year using execute and fetchall, and print “title (year)” with a for loop. The first line is Star Map (2019)",
        starter: "import sqlite3\n",
        tests: [
          { stdin: "", expect: "Star Map (2019)\nMoon Garden (2021)", public: true },
        ],
        require: ["Method:connect", "Method:execute", "Method:fetchall", "For"],
        hints: [
          "There are three steps: make the table, add the two books, then take them out and print. Order matters.",
          "INSERT only works after CREATE TABLE has made the table, and only then can SELECT take rows out.",
          "Put SQL text in cur.execute(…). After SELECT, cur.fetchall() brings every row, and you loop over them with for.",
          "cur.execute(\"CREATE TABLE books (title TEXT, genre TEXT, year INTEGER)\")  (split it if it's long)\n(after two INSERTs)\nfor r in rows:\n    print(f\"{r[0]} ({___})\")",
        ],
        solution: J(
          ...PRE(B4.slice(0, 2)),
          ...Q("sel", "SELECT title, year ", "FROM books ", "ORDER BY year"),
          "cur.execute(sel)",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]} ({r[1]})")`,
        ),
        explain: "ORDER BY year puts smaller years first, so Star Map comes out first. When order matters, always add ORDER BY.",
      },
      {
        type: "check", concept: "sqlcreate",
        q: "What does CREATE TABLE do?",
        options: ["Makes an empty table with column names", "Adds one row of values to a table", "Shows a table's values on screen"],
        answer: 0,
        explain: "CREATE TABLE only makes an empty table (column names and types). Adding values is INSERT's job, and looking at them is SELECT's.",
      },
    ],
  },
  {
    id: "16-2", chapter: 16, title: "Query with SELECT",
    goal: "Use WHERE to take out only the rows that match a condition",
    summary: [
      "SELECT columns FROM table",
      "Write the condition after WHERE",
      "Text values in single quotes; equal is =",
    ],
    cards: [
      {
        say: "SELECT picks which columns to take out, and WHERE filters which rows. Here we take only books from 2020 or later, in year order. (kids means children's books.)",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title, year ", "FROM books ", "WHERE year >= 2020 ", "ORDER BY year"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        out: "Cloud Bakery 2020\nMoon Garden 2021\nTiny Forest 2023",
      },
      {
        say: "To check equality, use a single =. Wrap text in single quotes, and join conditions with AND. SELECT * means every column, and each row comes back as a tuple.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT * FROM books ", "WHERE genre = 'kids' ", "AND year > 2020"),
          "cur.execute(sel)",
          ...LOOP("r"),
        ),
        out: "('Tiny Forest', 'kids', 2023)",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlselect",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE year > 2020 ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["Moon Garden\nTiny Forest", "Cloud Bakery\nMoon Garden\nTiny Forest", "Tiny Forest"],
        answer: 0,
        explain: "year > 2020 leaves out 2020, so it's 2021 and 2023. Moon Garden and Tiny Forest come out in title order.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = 'kids' ", "AND year < 2023"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["Cloud Bakery", "Tiny Forest", "Cloud Bakery\nTiny Forest"],
        answer: 0,
        explain: "AND needs both conditions to be true. Among the kids books, the only one before 2023 is Cloud Bakery from 2020.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "What happens when you run this code?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = kids"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["It causes an error (OperationalError)", "Cloud Bakery\nTiny Forest", "A blank line"],
        answer: 0,
        explain: "Without quotes, kids is read as a column name. There's no such column, so you get an OperationalError clue. Wrap text values in single quotes.",
      },
      {
        type: "blank", concept: "sqlselect",
        q: "Fill in the blank so books from 2020 on (2020 included) come out.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title ", "FROM books ", "WHERE year ___ 2020 ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        chips: [">=", "=>", "=="],
        answer: 0,
        explain: "“At least” is >=. => isn't valid SQL, so it gives a clue, and == picks only the 2020 book, so just Cloud Bakery comes out.",
      },
      {
        type: "order", concept: "sqlselect",
        q: "Put the lines in order so the result 2 is printed.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("SELECT 1 + 1")`,
          "rows = cur.fetchall()",
          "print(rows[0][0])",
        ],
        expect: "2",
        explain: "SELECT can just calculate, no table needed. Ask with execute, then fetch with fetchall, and print the first value of the first row.",
      },
      {
        type: "write", concept: "sqlselect",
        task: "The starter loads the books in books.csv into the books table (you'll learn ? in 16-4). Run SELECT title, year with WHERE year >= 2020, sorted by year (ORDER BY), using execute and fetchall. Print “title year” with a for loop. The first line is Cloud Bakery 2020",
        starter: J(...CSVPRE, ""),
        files: { "books.csv": CSV(B6) },
        tests: [
          { stdin: "", expect: "Cloud Bakery 2020\nMoon Garden 2021\nTiny Forest 2023", public: true },
          { stdin: "", expect: "Market Alley 2020\nDawn Bus 2022\nSky Garden 2024", public: false, files: { "books.csv": CSV(H4) } },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "However many books are in the table, pick only those from 2020 on and print them from the smallest year.",
          "The WHERE you just learned filters rows, and ORDER BY sets the order.",
          "Write ORDER BY year right after WHERE year >= 2020, fetch with fetchall after execute, and loop with for.",
          "sel = (\"SELECT title, year \"\n       \"FROM books \"\n       \"WHERE year >= ___ \"\n       \"ORDER BY year\")\n(then execute, fetchall, for)",
        ],
        solution: J(
          ...CSVPRE,
          ...Q("sel", "SELECT title, year ", "FROM books ", "WHERE year >= 2020 ", "ORDER BY year"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        explain: "WHERE kept only books from 2020 on, and ORDER BY year put them in year order. It's “at least” (>=), so the 2020 book is included too.",
      },
      {
        type: "check", concept: "sqlselect",
        q: "In SELECT ... WHERE year >= 2020, what does WHERE do?",
        options: ["Keeps only the rows that match", "Renames columns", "Sorts the rows"],
        answer: 0,
        explain: "WHERE keeps only the rows that match the condition. Sorting is ORDER BY's job, and the columns to show go right after SELECT.",
      },
    ],
  },
  {
    id: "16-3", chapter: 16, title: "Sort and summarize",
    goal: "Use ORDER BY, COUNT, AVG and GROUP BY",
    updated: "v0.9",
    summary: [
      "ORDER BY column DESC means largest first",
      "COUNT(*) counts rows, AVG is the average",
      "Group with GROUP BY, order with ORDER BY",
      "SUM is the total; MAX and MIN are the largest and smallest",
    ],
    cards: [
      {
        say: "ORDER BY column DESC sorts from largest to smallest. Add another column after a comma and it breaks ties. Here the newest books come first.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY year DESC, title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "Tiny Forest\nMoon Garden\nCloud Bakery\nStar Map",
      },
      {
        say: "GROUP BY groups books of the same genre so you can get COUNT (how many) and AVG (the average). When only one row comes back, fetchone() is handy. Grouped results get their order from ORDER BY too.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT genre, COUNT(*), ", "AVG(year) FROM books ", "GROUP BY genre ", "ORDER BY genre"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1], r[2]"),
          ...Q("cnt", "SELECT COUNT(*) ", "FROM books"),
          "cur.execute(cnt)",
          "print(cur.fetchone()[0])",
        ),
        out: "kids 2 2021.5\nnovel 1 2021.0\nscience 1 2019.0\n4",
      },
      {
        say: "SUM is the total, MAX the largest value, MIN the smallest. Chain parentheses with commas, like VALUES (3), (8), (5), to add several rows at once. The result is one row, so fetchone is handy.",
        code: J(
          ...HEAD,
          ...Q("make", "CREATE TABLE t (n INTEGER)"),
          "cur.execute(make)",
          ...Q("add", "INSERT INTO t ", "VALUES (3), (8), (5)"),
          "cur.execute(add)",
          ...Q("sel", "SELECT SUM(n), ", "MAX(n), MIN(n) ", "FROM t"),
          "cur.execute(sel)",
          "print(cur.fetchone())",
        ),
        out: "(16, 8, 3)",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT title FROM books ", "ORDER BY year DESC"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["Tiny Forest", "Star Map", "Moon Garden"],
        answer: 0,
        explain: "DESC means largest first. The 2023 book has the largest year, so it's at the front, and fetchone takes just that first row.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT COUNT(*) FROM books ", "WHERE genre = 'kids'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2", "4", "(2,)"],
        answer: 0,
        explain: "There are two kids books, Tiny Forest and Cloud Bakery. The row from fetchone() is (2,), and [0] takes the value out, so it's 2.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT AVG(year) FROM books ", "WHERE genre = 'kids'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2021.5", "2021", "2023"],
        answer: 0,
        explain: "The kids books are from 2023 and 2020. Their average is 2021.5, and AVG always comes back with a decimal point, even when it divides evenly.",
      },
      {
        type: "blank", concept: "sqlagg",
        q: "Fill in the blank so the number of books per genre comes out.",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT genre, COUNT(*) ", "FROM books ", "GROUP BY ___ ", "ORDER BY genre"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1]"),
        ),
        chips: ["genre", "year", "COUNT"],
        answer: 0,
        explain: "To group books by genre, use GROUP BY genre. Grouping by year makes one row per year, and COUNT isn't a column, so it gives a clue.",
      },
      {
        type: "order", concept: "sqlagg",
        q: "Put the lines in order so the average of 4, 4.0, is printed.",
        lines: [
          "import sqlite3",
          `conn = sqlite3.connect(":memory:")`,
          "cur = conn.cursor()",
          `cur.execute("SELECT AVG(4)")`,
          "row = cur.fetchone()",
          "print(row[0])",
        ],
        expect: "4.0",
        explain: "You have to ask with SELECT first so fetchone has a row to fetch. AVG comes back with a decimal point (4.0) even if you give it only integers.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT MAX(year) FROM books"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2023", "2019", "4"],
        answer: 0,
        explain: "MAX is the largest value. Of the four books' years, the largest is 2023. The smallest, 2019, would be MIN, and the count, 4, would be COUNT.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...PRE(B4),
          ...Q("sel", "SELECT MIN(year) FROM books ", "WHERE genre = 'kids'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["2020", "2023", "2"],
        answer: 0,
        explain: "WHERE keeps only the kids books: 2023 and 2020. MIN is the smaller one, 2020. 2023 would be MAX, and 2 would be COUNT.",
      },
      {
        type: "write", concept: "sqlagg",
        task: "The starter loads the books in books.csv into the books table (you'll learn ? in 16-4). Group SELECT genre, COUNT(*) with GROUP BY genre, sort with ORDER BY genre, then execute and fetchall. Print “genre: N” with for. The first line is history: 1",
        starter: J(...CSVPRE, ""),
        files: { "books.csv": CSV(B6) },
        tests: [
          { stdin: "", expect: "history: 1\nkids: 2\nnovel: 1\npoem: 1\nscience: 1", public: true },
          { stdin: "", expect: "history: 1\nkids: 1\nnovel: 1\npoem: 3", public: false, files: { "books.csv": CSV(H6) } },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "Count how many books each genre has. Each genre should become a single row.",
          "Use the GROUP BY and COUNT(*) you just learned together, and set the order with ORDER BY.",
          "Write genre and COUNT(*) after SELECT, then GROUP BY genre and ORDER BY genre. Print r[0] and r[1].",
          "sel = (\"SELECT genre, COUNT(*) \"\n       \"FROM books \"\n       \"GROUP BY ___ \"\n       \"ORDER BY genre\")\n(then execute, fetchall, for)",
        ],
        solution: J(
          ...CSVPRE,
          ...Q("sel", "SELECT genre, COUNT(*) ", "FROM books ", "GROUP BY genre ", "ORDER BY genre"),
          "cur.execute(sel)",
          "rows = cur.fetchall()",
          "for r in rows:",
          `    print(f"{r[0]}: {r[1]}")`,
        ),
        explain: "GROUP BY genre turns each genre into one row, and COUNT(*) counts the books. ORDER BY genre fixes the order too.",
      },
      {
        type: "check", concept: "sqlagg",
        q: "Why use GROUP BY genre?",
        options: ["To group books by genre and summarize each group", "To delete genres", "To list genres backwards"],
        answer: 0,
        explain: "GROUP BY makes one group per value, so COUNT or AVG can be worked out for each group. The order of the groups is set with ORDER BY.",
      },
    ],
  },
  {
    id: "16-4", chapter: 16, title: "SQL from Python",
    goal: "Add Python values to a DB safely with loops and ?",
    summary: [
      "Loop with for and call execute many times",
      "? marks a value's spot; pass values as a tuple",
      "Gluing text together is risky, so use ?",
    ],
    cards: [
      {
        say: "Leave the spot for each value as ? in the SQL and pass the values separately as a tuple. Then for can add the books in a list one at a time.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "new = [(\"Moon Garden\", \"novel\", 2021),",
          "       (\"Tiny Forest\", \"kids\", 2023)]",
          "for b in new:",
          "    cur.execute(ins, b)",
          ...Q("sel", "SELECT title FROM books ", "ORDER BY title"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        out: "Moon Garden\nTiny Forest",
      },
      {
        say: "Even with one value, it's a tuple with a comma, like (value,). Gluing values into the SQL text is risky (SQL injection). Passing them with ? is safe. executemany adds a whole list at once.",
        code: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          "new = [(\"Moon Garden\", \"novel\", 2021),",
          "       (\"Tiny Forest\", \"kids\", 2023),",
          "       (\"Cloud Bakery\", \"kids\", 2020)]",
          "cur.executemany(ins, new)",
          "genre = input()",
          ...Q("sel", "SELECT title FROM books ", "WHERE genre = ? ", "ORDER BY title"),
          "cur.execute(sel, (genre,))",
          ...LOOP("r[0]"),
        ),
        stdin: "kids",
        out: "Cloud Bakery\nTiny Forest",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlpy",
        q: "What's the output?",
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
        explain: "for took out 4 and 5 one at a time and ran INSERT twice. So there are 2 rows, and COUNT(*) is 2.",
      },
      {
        type: "choice", concept: "sqlpy",
        q: "What happens when you run this code?",
        code: J(
          ...HEAD,
          `cur.execute("CREATE TABLE t (g)")`,
          ...Q("ins", "INSERT INTO t VALUES (?)"),
          "g = \"poem\"",
          "cur.execute(ins, (g))",
        ),
        options: ["It causes an error (ProgrammingError)", "It saves normally", "It saves a blank cell"],
        answer: 0,
        explain: "(g) isn't a tuple, it's just g. The 4 letters of poem are read as 4 values, but there's only one ?, so you get a ProgrammingError clue. Write (g,).",
      },
      {
        type: "choice", concept: "sqlpy",
        q: "What's the safest way to pass a value in?",
        options: [
          "cur.execute(sel, (genre,))  (with ? in the SQL)",
          "Glue genre onto the SQL text with +",
          "Put genre into the SQL text with an f-string",
        ],
        answer: 0,
        explain: "Gluing text is open to attacks that hide SQL commands in the input (SQL injection). Passing values with ? and a tuple treats them only as values.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "Fill in the blank so 8 and 12, the ones bigger than 6, come out.",
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
        explain: "A value's spot is ?. With n there's no ? in the SQL, so the clue says the (6,) you passed has nowhere to go. %s isn't SQLite grammar, so it gives a clue too.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "Fill in the blank to add the whole list at once, so 2 comes out.",
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
        explain: "Adding several groups at once is executemany. execute takes only one group, so it gives a clue, and fetchall doesn't take values.",
      },
      {
        type: "write", concept: "sqlpy",
        task: "The table already has 2 books. Read title, genre and year (an integer) in turn with input() (leave the parentheses empty) and INSERT them with ? and a tuple. Then get all the books sorted by year, then title (ORDER BY), using execute and fetchall, and print “title (year)” with a for loop. For Tiny Forest, kids, 2023 the last line is Tiny Forest (2023)",
        starter: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          ...SEED,
          "",
        ),
        tests: [
          { stdin: "Tiny Forest\nkids\n2023", expect: "Star Map (2019)\nMoon Garden (2021)\nTiny Forest (2023)", public: true },
          { stdin: "Old Market\nhistory\n2012", expect: "Old Market (2012)\nStar Map (2019)\nMoon Garden (2021)", public: false },
          { stdin: "Autumn Song\npoem\n2019", expect: "Autumn Song (2019)\nStar Map (2019)\nMoon Garden (2021)", public: false },
          { stdin: "Uncle's Book\nessay\n2021", expect: "Star Map (2019)\nMoon Garden (2021)\nUncle's Book (2021)", public: false },
        ],
        require: ["Method:execute", "Method:fetchall", "For"],
        hints: [
          "Whatever year the new book has, books from the same year must be placed in title order.",
          "It's the ? and tuple you just learned. Bundle the three values as (title, genre, year) and pass them.",
          "INSERT with ins and a tuple, then use ORDER BY year, title in the SELECT and print with for after fetchall.",
          "title = input()\ngenre = input()\nyear = int(input())\ncur.execute(ins, (title, genre, ___))\n(then SELECT, fetchall, and print with for)",
        ],
        solution: J(
          ...HEAD,
          ...MAKE,
          ...INSQ,
          ...SEED,
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
        explain: "Passing with ? and a tuple stays safe even when a title has a single quote in it. With ORDER BY year, title, books from the same year get a fixed order too.",
      },
      {
        type: "check", concept: "sqlpy",
        q: "Which is the right tuple for a single value?",
        options: ["(genre,)", "(genre)", "[genre"],
        answer: 0,
        explain: "The comma is what makes a tuple. (genre) is just genre, so each letter can be read as a separate value. Even one value is written (value,).",
      },
    ],
  },
  {
    id: "16-5", chapter: 16, title: "Chapter 16 checkpoint", isExam: true,
    goal: "Handle a neighborhood library's loan records with a DB",
    summary: [
      "Make and fill a table with CREATE and INSERT",
      "Take rows out with WHERE, ORDER BY and summaries",
      "Pass values safely with ? and a tuple",
    ],
    cards: [
      {
        say: "Let's put the neighborhood library's loan records in a temporary DB. Make the table, fill it with executemany, and use GROUP BY to get each member's number of loans and average loan days.",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT member, COUNT(*), ", "AVG(days) FROM loans ", "GROUP BY member ", "ORDER BY member"),
          "cur.execute(sel)",
          ...LOOP("r[0], r[1], r[2]"),
        ),
        out: "Dami 1 1.0\nJun 3 6.0\nYuna 3 8.0",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlcreate",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...Q("cnt", "SELECT COUNT(*) ", "FROM loans"),
          "cur.execute(cnt)",
          "print(cur.fetchone()[0])",
        ),
        options: ["7", "6", "3"],
        answer: 0,
        explain: "The loans list has 7 loan records, and executemany added them all. COUNT(*) counts rows, so it's 7.",
      },
      {
        type: "choice", concept: "sqlselect",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT book FROM loans ", "WHERE days >= 7 ", "ORDER BY book"),
          "cur.execute(sel)",
          ...LOOP("r[0]"),
        ),
        options: ["Moon Garden\nMoon Garden\nTiny Forest", "Moon Garden\nTiny Forest", "Tiny Forest\nMoon Garden\nMoon Garden"],
        answer: 0,
        explain: "The records of 7 days or more are Moon Garden (7 days), Tiny Forest (14 days) and Moon Garden (10 days). The same book shows up once per record.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT AVG(days) FROM loans ", "WHERE member = 'Jun'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["6.0", "6", "18"],
        answer: 0,
        explain: "Jun's loans were 3, 5 and 10 days. The total, 18, divided by 3 gives the average 6.0, and AVG comes back with a decimal point.",
      },
      {
        type: "blank", concept: "sqlpy",
        q: "Fill in the blank so Jun's records come out.",
        code: J(
          ...LPRE,
          "who = \"Jun\"",
          ...Q("sel", "SELECT book FROM loans ", "WHERE member = ___ ", "ORDER BY book"),
          "cur.execute(sel, (who,))",
          ...LOOP("r[0]"),
        ),
        chips: ["?", "who", "%s"],
        answer: 0,
        explain: "A value's spot is ?, and the value goes in as the tuple (who,). Writing who in the SQL text gives a clue because there's no such column.",
      },
      {
        type: "choice", concept: "sqlagg",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT book FROM loans ", "ORDER BY days DESC"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["Tiny Forest", "Moon Garden", "Cloud Bakery"],
        answer: 0,
        explain: "days DESC puts the longest loans first. Tiny Forest, borrowed for 14 days, is the first row, and fetchone takes just that row.",
      },
      {
        type: "write", concept: "sqlpy",
        task: "Make the table loans(book, member, days) with CREATE TABLE and add the list with executemany. Read a member with input() (leave the parentheses empty). Query that member's records with ? and a tuple in book order (ORDER BY), fetchall them and print “book: N” (N = loan days) with a for loop. Then fetchone COUNT(*) and print “Total: N” (number of loans). For Yuna the last line is Total: 3",
        starter: J(...HEAD, ...LIST("loans", LOANS), ""),
        tests: [
          { stdin: "Yuna", expect: "Cloud Bakery: 3\nMoon Garden: 7\nTiny Forest: 14\nTotal: 3", public: true },
          { stdin: "Jun", expect: "Moon Garden: 10\nStar Map: 3\nTiny Forest: 5\nTotal: 3", public: false },
          { stdin: "Dami", expect: "Old Market: 1\nTotal: 1", public: false },
          { stdin: "Somin", expect: "Total: 0", public: false },
        ],
        require: ["Method:execute", "Method:executemany", "Method:fetchall", "Method:fetchone", "For"],
        hints: [
          "Each member has a different number of records. Some members have none at all.",
          "Think of making the table, executemany, querying with ? and a tuple, and COUNT.",
          "Use WHERE member = ? for both the record query and the count query, and pass (member,). The count is fetchone()[0].",
          "member = input()\n(after making the table and executemany)\ncur.execute(sel, (___,))\nrows = cur.fetchall()\n(then print with for, COUNT(*), fetchone)",
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
          `    print(f"{r[0]}: {r[1]}")`,
          ...Q("cnt", "SELECT COUNT(*) ", "FROM loans ", "WHERE member = ?"),
          "cur.execute(cnt, (member,))",
          "n = cur.fetchone()[0]",
          `print(f"Total: {n}")`,
        ),
        explain: "For a member with no records, for never runs and Total: 0 comes out. Thanks to ? and a tuple, the query stays safe whatever is typed in.",
      },
      {
        type: "check", concept: "sqlpy",
        q: "Why is the comma needed in cur.execute(sel, (member,))?",
        options: ["To make a one-value tuple", "To split the SQL text in two", "To delete member"],
        answer: 0,
        explain: "(member) isn't a tuple, it's just member. Add the comma and it becomes a one-value tuple that fits the ? properly.",
      },
    ],
  },
];

// Shared start for templates (lines split to fit 38 columns)
const TPRE = [
  "import sqlite3",
  "con = sqlite3.connect(\":memory:\")",
  "cur = con.cursor()",
  "mk = \"CREATE TABLE t (n TEXT, p INT)\"",
  "cur.execute(mk)",
  "ins = \"INSERT INTO t VALUES (?, ?)\"",
];
const ROWS3 = "rows = [(\"bread\", {A}),\n        (\"milk\", {B}),\n        (\"gum\", {C})]";
const ROWS4 = "rows = [(\"bread\", {A}),\n        (\"milk\", {B}),\n        (\"gum\", {C}),\n        (\"water\", {D})]";
const T = (rows, ...rest) => J(...TPRE, rows, "cur.executemany(ins, rows)", ...rest);

export const TEMPLATES = [
  {
    id: "16-T1", concept: "sqlselect", type: "choice",
    q: "What's the output?",
    code: T("rows = [(\"{N1}\", {A}),\n        (\"{N2}\", {B}),\n        (\"gum\", {C})]", "q = \"SELECT n FROM t\"", "q += \" WHERE p > ? ORDER BY p\"", "cur.execute(q, ({LIM},))", "print(cur.fetchall())"),
    wrong: [
      T("rows = [(\"{N1}\", {A}),\n        (\"{N2}\", {B}),\n        (\"gum\", {C})]", "q = \"SELECT n FROM t\"", "q += \" WHERE p < ? ORDER BY p\"", "cur.execute(q, ({LIM},))", "print(cur.fetchall())"),
      T("rows = [(\"{N1}\", {A}),\n        (\"{N2}\", {B}),\n        (\"gum\", {C})]", "q = \"SELECT n FROM t ORDER BY p\"", "cur.execute(q)", "print(cur.fetchall())"),
    ],
    vars: { A: [1500, 1800], B: [2500, 2800], C: [500, 700], LIM: [1000, 2000], N1: ["bun", "pie", "egg", "fig"], N2: ["tea", "jam", "ham", "nut", "oat"] },
    explain: "WHERE p > ? keeps only rows above the limit. The tuple ({LIM},) goes into the ? spot. → {OUT}",
  },
  {
    id: "16-T2", concept: "sqlselect", type: "blank",
    q: "Fill in the blank so the highest p (price) comes first.",
    code: T(ROWS3, "q = \"SELECT n FROM t ORDER BY ___\"", "cur.execute(q)", "print(cur.fetchall())"),
    chips: ["p DESC", "p", "DESC p"], answer: 0,
    vars: { A: [1500, 1800], B: [2500, 2800], C: [500, 700] },
    explain: "ORDER BY column DESC sorts from the largest value. Without DESC it starts from the smallest, and DESC in front causes an error.",
  },
  {
    id: "16-T3", concept: "sqlagg", type: "choice",
    q: "What's the output?",
    code: T(ROWS3, "cur.execute(\"SELECT SUM(p) FROM t\")", "print(cur.fetchone()[0])"),
    wrong: [
      T(ROWS3, "cur.execute(\"SELECT MAX(p) FROM t\")", "print(cur.fetchone()[0])"),
      T(ROWS3, "cur.execute(\"SELECT COUNT(p) FROM t\")", "print(cur.fetchone()[0])"),
    ],
    vars: { A: [1500, 1800, 2200], B: [2500, 2800, 3100], C: [500, 700, 900] },
    explain: "SUM is the total, MAX the largest value, COUNT the number of rows. A summary gives just one row, so fetchone takes it out. → {OUT}",
  },
  {
    id: "16-T4", concept: "sqlagg", type: "blank",
    q: "Fill in the blank so it counts all the rows.",
    code: T(ROWS4, "cur.execute(\"SELECT ___(*) FROM t\")", "print(cur.fetchone()[0])"),
    chips: ["COUNT", "SUM", "MAX"], answer: 0,
    vars: { A: [1500, 1800], B: [2500, 2800], C: [500, 700], D: [900, 1100] },
    explain: "COUNT(*) counts the rows. SUM(*) and MAX(*) don't know which column to use, so they cause an error.",
  },
  {
    id: "16-T5", concept: "sqlpy", type: "choice",
    q: "What's the output?",
    code: J(...TPRE, "cur.execute(ins, (\"{NAME}\", {S}))", "q = \"SELECT p FROM t WHERE n = ?\"", "cur.execute(q, (\"{NAME}\",))", "print(cur.fetchone()[0])"),
    wrong: [
      J(...TPRE, "cur.execute(ins, (\"{NAME}\", {S}))", "q = \"SELECT p FROM t WHERE n = ?\"", "cur.execute(q, (\"{NAME}\"))", "print(cur.fetchone()[0])"),
      J(...TPRE, "cur.execute(ins, (\"{NAME}\", {S}))", "cur.execute(\"SELECT p FROM t\")", "print(cur.fetchall())"),
    ],
    vars: { NAME: ["Ria", "Minsu", "Jiwoo", "Hana"], S: { min: 60, max: 99 } },
    explain: "When you pass a value into a ? spot, even a single value needs a comma, like (value,), to be a tuple. Without the comma it causes an error. → {OUT}",
  },
];

// ───────── Chapter 16 Deep Dive (16-A1 to 16-A3) ─────────
// Split SQL text over lines within 38 columns automatically (at spaces; wide characters count as 2)
const XW = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
const XQ = (name, ...parts) => {
  const room = 38 - (name.length + 5) - 1;
  // Cut at clauses (SELECT, FROM, JOIN, ON, WHERE, GROUP BY, HAVING, ORDER BY); only split a clause into words if it's too long
  const units = [];
  parts.join("").split(/(?=\b(?:SELECT|FROM|JOIN|ON|WHERE|GROUP BY|HAVING|ORDER BY)\b)/).forEach((u) => {
    if (XW(u) <= room) { units.push(u); return; }
    const glued = u.replace(/(\S+) ([=<>]+) (\S+)/g, "$1 $2 $3").replace(/(ORDER|GROUP) BY/g, "$1 BY");
    let piece = "";
    glued.split(/(?<= )/).forEach((w) => {
      if (piece && XW(piece + w) > room) { units.push(piece); piece = w; } else piece += w;
    });
    units.push(piece);
  });
  const lines = [];
  let cur = "";
  units.map((u) => u.replace(/ /g, " ")).forEach((u) => {
    if (cur && XW(cur + u) > room) { lines.push(cur); cur = u; } else cur += u;
  });
  lines.push(cur);
  if (lines.length === 1) return [`${name} = "${lines[0]}"`];
  return lines.map((p, k) => (k === 0 ? `${name} = ("` : `${" ".repeat(name.length + 4)}"`) + p + (k === lines.length - 1 ? `")` : `"`));
};
const XV = (v) => (typeof v === "number" ? String(v) : `"${v}"`);
const XLIST = (name, rows) => rows.map((r, i) =>
  (i === 0 ? `${name} = [` : " ".repeat(name.length + 4)) + `(${r.map(XV).join(", ")})` + (i === rows.length - 1 ? "]" : ","));
// For cards: list + CREATE TABLE + INSERT + executemany (column names only, no types)
const XTBL = (name, cols, rows) => [
  ...XLIST(name, rows),
  ...XQ("make", `CREATE TABLE ${name} `, `(${cols})`), "cur.execute(make)",
  ...XQ("ins", `INSERT INTO ${name} `, `VALUES (${cols.split(", ").map(() => "?").join(", ")})`),
  `cur.executemany(ins, ${name})`,
];
// For task starters: load a csv file into a table (column types given so numbers are stored as numbers)
const XLOAD = (name, cols) => [
  ...XQ("make", `CREATE TABLE ${name} `, `(${cols})`), "cur.execute(make)",
  ...XQ("ins", `INSERT INTO ${name} `, `VALUES (${cols.split(", ").map(() => "?").join(", ")})`),
  `with open("${name}.csv") as f:`, "    data = csv.reader(f)", "    cur.executemany(ins, data)",
];
const XHEAD = ["import sqlite3", "import csv", `conn = sqlite3.connect(":memory:")`, "cur = conn.cursor()"];
const XFETCH = (expr) => ["cur.execute(sel)", "rows = cur.fetchall()", "for r in rows:", `    print(${expr})`];

// Shared data for 16-A1, A2 and cards
const XBOOKS = [[1, "Moon Garden"], [2, "Star Map"], [3, "Tiny Forest"]];
const XLOANS = [[1, 1, "Yuna"], [2, 3, "Yuna"], [3, 1, "Jun"], [4, 2, "Dami"]];
const XJOIN = ["FROM loans JOIN books ", "ON loans.book_id = books.id "];

// 16-A1 task test data
const A1_P = { b: [[1, "Moon Garden"], [2, "Star Map"], [3, "Tiny Forest"]], l: [[1, 1, "Yuna"], [2, 3, "Yuna"], [3, 1, "Jun"], [4, 2, "Dami"]] };
const A1_H1 = { b: [[1, "Dawn Bus"], [2, "Rain Letter"], [3, "Market Alley"], [4, "Sky Garden"]], l: [[1, 2, "Dami"], [2, 2, "Bora"], [3, 9, "Somin"], [4, 1, "Dami"], [5, 2, "Ara"]] };
const A1_H2 = { b: [[1, "Summer Sea"]], l: [[1, 1, "Hana"], [2, 5, "Eun"]] };
const A1F = (d) => ({ "books.csv": CSV(d.b), "loans.csv": CSV(d.l) });

// 16-A2 task test data (member, book, days)
const A2_P = LOANS.map((r) => [r[1], r[0], r[2]]);
const A2_H = [["Bora", "A", 2], ["Bora", "B", 4], ["Bora", "C", 6], ["Ara", "A", 3], ["Ara", "B", 1], ["Ara", "C", 8],
  ["Dami", "D", 5], ["Dami", "E", 5], ["Dami", "F", 5], ["Dami", "G", 5]];

// 16-A3 task test data
const A3_P = {
  m: [[1, "Yuna"], [2, "Jun"], [3, "Dami"], [4, "Bora"]],
  b: [[1, "Moon Garden", "novel"], [2, "Star Map", "science"], [3, "Tiny Forest", "kids"], [4, "Cloud Bakery", "kids"]],
  l: [[1, 1, 7], [1, 3, 14], [1, 4, 3], [2, 2, 3], [2, 3, 5], [2, 1, 10], [3, 3, 2]],
};
const A3_Q = {
  m: [[1, "Ara"], [2, "Bora"]],
  b: [[1, "Village Map", "poem"], [2, "Wind Song", "history"]],
  l: [[1, 1, 4], [1, 2, 7], [2, 1, 5], [2, 2, 6]],
};
const A3F = (d) => ({ "members.csv": CSV(d.m), "books.csv": CSV(d.b), "loans.csv": CSV(d.l) });
// Small data for cards
const XM = [[1, "Yuna"], [2, "Jun"]];
const XB3 = [[1, "Moon Garden", "novel"], [2, "Tiny Forest", "kids"]];
const XL3 = [[1, 1, 7], [1, 2, 14], [2, 2, 5]];
const X3 = [...HEAD, ...XTBL("members", "id, name", XM), ...XTBL("books", "id, title, genre", XB3),
  ...XTBL("loans", "member_id, book_id, days", XL3)];

export const ADVANCED = [
  {
    id: "16-A1", chapter: 16, title: "Join two tables", isAdvanced: true,
    goal: "Use JOIN … ON to link two tables by number and query them",
    summary: [
      "JOIN … ON links rows with the same number",
      "Write columns as table.column",
      "Rows without a match drop out",
    ],
    cards: [
      {
        say: "This is where we go one step further. You don't need it to unlock the next chapter. loans only has the book number (book_id); the title lives in books. JOIN … ON links rows with the same number. Write columns as table.column, like loans.member.",
        code: J(
          ...HEAD,
          ...XTBL("books", "id, title", XBOOKS),
          ...XTBL("loans", "id, book_id, member", XLOANS.slice(0, 3)),
          ...XQ("sel", "SELECT books.title, loans.member ", ...XJOIN, "ORDER BY books.title, ", "loans.member"),
          ...XFETCH("r[0], r[1]"),
        ),
        out: "Moon Garden Jun\nMoon Garden Yuna\nTiny Forest Yuna",
      },
      {
        say: "INNER JOIN keeps only rows that have a matching number. A row with no match drops out. Below, of the 4 loans rows, the one with book number 9 has no match, so it's missing from the result.",
        code: J(
          ...HEAD,
          ...XTBL("books", "id, title", XBOOKS),
          ...XTBL("loans", "id, book_id, member", [...XLOANS.slice(0, 3), [4, 9, "Somin"]]),
          ...XQ("a", "SELECT COUNT(*) FROM loans"),
          ...XQ("b", "SELECT COUNT(*) ", ...XJOIN),
          "cur.execute(a)",
          "print(cur.fetchone()[0])",
          "cur.execute(b)",
          "print(cur.fetchone()[0])",
        ),
        out: "4\n3",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqljoin",
        q: "What's the output?",
        code: J(
          ...HEAD,
          ...XTBL("books", "id, title", XBOOKS),
          ...XTBL("loans", "id, book_id, member", XLOANS),
          ...XQ("sel", "SELECT books.title ", ...XJOIN, "WHERE loans.member = 'Jun'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["Moon Garden", "Star Map", "Jun"],
        answer: 0,
        explain: "Jun's record has book_id 1. ON links it to id 1 in books, so the title Moon Garden comes out. Jun is a member, not a title.",
      },
      {
        type: "choice", concept: "sqljoin",
        q: "Which ON condition links loans and books correctly?",
        options: ["ON loans.book_id = books.id", "ON loans.member = books.title", "ON loans.id = books.title"],
        answer: 0,
        explain: "Link the rows where loans' book number (book_id) equals books' number (id). Columns that mean different things, like a member name and a title, can't be linked.",
      },
      {
        type: "blank", concept: "sqljoin",
        q: "Fill in the blank so all 4 loans rows are linked and 4 is printed.",
        code: J(
          ...HEAD,
          ...XTBL("books", "id, title", XBOOKS),
          ...XTBL("loans", "id, book_id, member", XLOANS),
          ...XQ("sel", "SELECT COUNT(*) ", "FROM loans JOIN books ", "ON loans.book_id = ___"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        chips: ["books.id", "loans.id", "books.title"],
        answer: 0,
        explain: "The partner of the book number book_id is books.id. With loans.id there's no condition tying it to books, so you get the wrong count, 3, and books.title is text, so nothing links and you get 0.",
      },
      {
        type: "choice", concept: "sqljoin",
        q: "What happens when you run this code?",
        code: J(
          ...HEAD,
          ...XTBL("books", "id, title", XBOOKS),
          ...XTBL("loans", "id, book_id, member", XLOANS),
          ...XQ("sel", "SELECT id ", ...XJOIN),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["It causes an error (which table's id?)", "1", "Only loans' id comes out"],
        answer: 0,
        explain: "Both tables have an id column, so SQL can't tell which one you mean and gives an OperationalError clue. Write it as table.column, like loans.id.",
      },
      {
        type: "choice", concept: "sqljoin",
        q: "loans has a row with book_id 9, but books has no id 9. What happens?",
        options: ["That row drops out of the JOIN result", "It comes out with a blank title", "It causes an error"],
        answer: 0,
        explain: "INNER JOIN keeps only rows with a match. Rows without one quietly drop out with no error, so check whether the count got smaller.",
      },
      {
        type: "write", concept: "sqljoin",
        task: "The starter loads books.csv (id, title) and loans.csv (id, book_id, member) into tables. JOIN the two tables and print “title - borrower” in title order (borrower order for ties). The first line is Moon Garden - Jun",
        starter: J(...XHEAD, ...XLOAD("books", "id INTEGER, title TEXT"), ...XLOAD("loans", "id INTEGER, book_id INTEGER, member TEXT"), ""),
        files: A1F(A1_P),
        tests: [
          { stdin: "", expect: "Moon Garden - Jun\nMoon Garden - Yuna\nStar Map - Dami\nTiny Forest - Yuna", public: true },
          { stdin: "", expect: "Dawn Bus - Dami\nRain Letter - Ara\nRain Letter - Bora\nRain Letter - Dami", public: false, files: A1F(A1_H1) },
          { stdin: "", expect: "Summer Sea - Hana", public: false, files: A1F(A1_H2) },
        ],
        require: ["SQL:JOIN", "Method:execute", "Method:fetchall", "For"],
        hints: [
          "Titles are in books and borrowers are in loans. You need to combine them in a single SELECT.",
          "Link loans.book_id and books.id with the JOIN … ON you just learned. Write columns as table.column.",
          "After SELECT books.title, loans.member FROM loans JOIN books ON …, add ORDER BY with two columns. Print r[0] and r[1].",
          "sel = (\"SELECT books.title, \"\n       \"loans.member \"\n       \"FROM loans JOIN books \"\n       \"ON ___ ORDER BY ___\")\n(then execute, fetchall, for)",
        ],
        solution: J(
          ...XHEAD, ...XLOAD("books", "id INTEGER, title TEXT"), ...XLOAD("loans", "id INTEGER, book_id INTEGER, member TEXT"),
          ...XQ("sel", "SELECT books.title, loans.member ", ...XJOIN, "ORDER BY books.title, ", "loans.member"),
          ...XFETCH(`f"{r[0]} - {r[1]}"`),
        ),
        explain: "ON linked the rows with the same number, putting title and borrower on one row. Loans with no match drop out, and the same title is sorted by borrower.",
      },
      {
        type: "check", concept: "sqljoin",
        q: "Why write columns as table.column, like loans.member?",
        options: ["To make clear which table the column belongs to", "To delete the column", "To make a new table"],
        answer: 0,
        explain: "A JOIN brings both tables' columns into one result. Writing table.column keeps columns with the same name (id) from getting mixed up.",
      },
    ],
  },
  {
    id: "16-A2", chapter: 16, title: "GROUP BY and HAVING", isAdvanced: true,
    goal: "WHERE filters before grouping, HAVING filters after",
    summary: [
      "WHERE filters rows before grouping",
      "HAVING filters groups after grouping",
      "The order is WHERE→GROUP BY→HAVING",
    ],
    cards: [
      {
        say: "This is where we go one step further. In 16-3 you learned COUNT and AVG, plus SUM (total), MAX and MIN, right? To filter grouped results, use HAVING. Here we keep only members with 2 or more loans.",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member, COUNT(*), ", "SUM(days) FROM loans ", "GROUP BY member ", "HAVING COUNT(*) >= 2 ", "ORDER BY member"),
          ...XFETCH("r[0], r[1], r[2]"),
        ),
        out: "Jun 3 18\nYuna 3 24",
      },
      {
        say: "WHERE filters rows before grouping, and HAVING filters groups after grouping. The writing order is WHERE → GROUP BY → HAVING → ORDER BY. Below, only loans of 5 days or more are counted per member.",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member, COUNT(*) ", "FROM loans WHERE days >= 5 ", "GROUP BY member ", "ORDER BY member"),
          ...XFETCH("r[0], r[1]"),
        ),
        out: "Jun 2\nYuna 2",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqlhaving",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member FROM loans ", "GROUP BY member ", "HAVING SUM(days) >= 20 ", "ORDER BY member"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["Yuna", "Jun", "Dami"],
        answer: 0,
        explain: "The totals per member are Yuna 24 days, Jun 18 days and Dami 1 day. Only Yuna's group passes HAVING SUM(days) >= 20.",
      },
      {
        type: "choice", concept: "sqlhaving",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member, COUNT(*) ", "FROM loans WHERE days >= 10 ", "GROUP BY member ", "ORDER BY member"),
          "cur.execute(sel)",
          "r = cur.fetchone()",
          "print(r[0], r[1])",
        ),
        options: ["Jun 1", "Jun 3", "Dami 1"],
        answer: 0,
        explain: "WHERE keeps only the records of 10 days or more (Jun 10 days, Yuna 14 days), then groups them. Jun has one record left, so 1, and Dami disappears completely.",
      },
      {
        type: "blank", concept: "sqlhaving",
        q: "Fill in the blank so only members with 3 or more loans come out.",
        code: J(
          ...LPRE,
          ...Q("sel", "SELECT member FROM loans ", "GROUP BY member ", "___ COUNT(*) >= 3 ", "ORDER BY member"),
          ...XFETCH("r[0]"),
        ),
        chips: ["HAVING", "WHERE", "ORDER BY"],
        answer: 0,
        explain: "You're filtering the count after grouping, so it's HAVING. WHERE or ORDER BY after GROUP BY breaks the SQL grammar and gives a clue.",
      },
      {
        type: "choice", concept: "sqlhaving",
        q: "What happens when you run this code?",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member FROM loans ", "WHERE COUNT(*) >= 2 ", "GROUP BY member"),
          "cur.execute(sel)",
        ),
        options: ["It causes an error (no COUNT in WHERE)", "Yuna and Jun come out", "Nothing comes out"],
        answer: 0,
        explain: "WHERE works before grouping, so there's no count yet, and you can't use summaries in WHERE. To filter with a summary like COUNT, use HAVING.",
      },
      {
        type: "choice", concept: "sqlhaving",
        q: "What's the output?",
        code: J(
          ...LPRE,
          ...XQ("sel", "SELECT member, MAX(days) ", "FROM loans GROUP BY member ", "HAVING MAX(days) >= 10 ", "ORDER BY member"),
          "cur.execute(sel)",
          "r = cur.fetchone()",
          "print(r[0], r[1])",
        ),
        options: ["Jun 10", "Yuna 14", "Dami 1"],
        answer: 0,
        explain: "MAX is the largest value in a group. Jun 10 days and Yuna 14 days remain, and in member order the first row is Jun.",
      },
      {
        type: "write", concept: "sqlhaving",
        task: "The starter loads loans.csv (member, book, days) into a table. n=int(input()). Keep only records of 3 days or more with WHERE, group by member, and with HAVING print only members with n or more loans as “name count days” (most loans first, name order for ties), then “Members: N” at the end. Input 2 → first line Jun 3 18",
        starter: J(...XHEAD, ...XLOAD("loans", "member TEXT, book TEXT, days INTEGER"), "n = int(input())", ""),
        files: { "loans.csv": CSV(A2_P) },
        tests: [
          { stdin: "2", expect: "Jun 3 18\nYuna 3 24\nMembers: 2", public: true },
          { stdin: "2", expect: "Dami 4 20\nAra 2 11\nBora 2 10\nMembers: 3", public: false, files: { "loans.csv": CSV(A2_H) } },
          { stdin: "3", expect: "Dami 4 20\nMembers: 1", public: false, files: { "loans.csv": CSV(A2_H) } },
          { stdin: "9", expect: "Members: 0", public: false, files: { "loans.csv": CSV(A2_H) } },
        ],
        require: ["SQL:WHERE", "SQL:HAVING", "Method:execute", "Method:fetchall", "For"],
        hints: [
          "Two steps: filter the records first, then filter again after grouping. Count the members at the end too.",
          "3 days or more is before grouping, so WHERE; n or more loans is after grouping, so HAVING. Pass the value n with ?.",
          "Chain WHERE days >= 3 → GROUP BY member → HAVING COUNT(*) >= ? → ORDER BY COUNT(*) DESC, member. The member count is len(rows).",
          "sel = (\"SELECT member, COUNT(*), SUM(days) \"\n       \"FROM loans WHERE ___ \"\n       \"GROUP BY member HAVING ___ >= ? \"\n       \"ORDER BY ___ DESC, member\")\ncur.execute(sel, (n,))",
        ],
        solution: J(
          ...XHEAD, ...XLOAD("loans", "member TEXT, book TEXT, days INTEGER"), "n = int(input())",
          ...XQ("sel", "SELECT member, COUNT(*), ", "SUM(days) FROM loans ", "WHERE days >= 3 ", "GROUP BY member ", "HAVING COUNT(*) >= ? ", "ORDER BY COUNT(*) DESC, ", "member"),
          "cur.execute(sel, (n,))",
          "rows = cur.fetchall()",
          "for r in rows:",
          "    print(r[0], r[1], r[2])",
          `print(f"Members: {len(rows)}")`,
        ),
        explain: "WHERE first drops records under 3 days, then HAVING filters the counts after grouping. Swap the two and the result changes. Members with exactly n loans are included too.",
      },
      {
        type: "check", concept: "sqlhaving",
        q: "Which correctly describes WHERE and HAVING?",
        options: ["WHERE filters before grouping, HAVING after", "WHERE filters after grouping, HAVING before", "They're exactly the same"],
        answer: 0,
        explain: "WHERE filters row by row to decide what gets grouped, and HAVING filters the groups by count or total once they've been made.",
      },
    ],
  },
  {
    id: "16-A3", chapter: 16, title: "Loan stats", isAdvanced: true,
    goal: "JOIN three tables to get stats per member and per genre",
    summary: [
      "Chain JOINs to combine three tables",
      "Group with GROUP BY, filter with HAVING",
      "Tidy AVG with Python's round",
    ],
    cards: [
      {
        say: "This is where we go one step further. With three tables, chain your JOINs. Follow the numbers from loans to members and books, and who borrowed which book lands on one row.",
        code: J(
          ...X3,
          ...XQ("sel", "SELECT members.name, books.title ", "FROM loans ", "JOIN members ", "ON loans.member_id = members.id ", "JOIN books ", "ON loans.book_id = books.id ", "ORDER BY members.name, ", "books.title"),
          ...XFETCH("r[0], r[1]"),
        ),
        out: "Jun Tiny Forest\nYuna Moon Garden\nYuna Tiny Forest",
      },
      {
        say: "After combining, GROUP BY and HAVING work as usual. Let's get the average loan days per genre, keeping only genres with 2 or more loans. AVG can have long decimals, so tidy it with Python's round.",
        code: J(
          ...X3,
          ...XQ("sel", "SELECT books.genre, AVG(loans.days) ", "FROM loans JOIN books ", "ON loans.book_id = books.id ", "GROUP BY books.genre ", "HAVING COUNT(*) >= 2 ", "ORDER BY books.genre"),
          ...XFETCH("r[0], round(r[1], 1)"),
        ),
        out: "kids 9.5",
      },
    ],
    items: [
      {
        type: "choice", concept: "sqljoin",
        q: "What's the output?",
        code: J(
          ...X3,
          ...XQ("sel", "SELECT books.title ", "FROM loans ", "JOIN members ", "ON loans.member_id = members.id ", "JOIN books ", "ON loans.book_id = books.id ", "WHERE members.name = 'Jun'"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        options: ["Tiny Forest", "Moon Garden", "Jun"],
        answer: 0,
        explain: "Jun (member 2) only has book number 2, and that book's title is Tiny Forest. The two JOINs followed the numbers one after another.",
      },
      {
        type: "blank", concept: "sqljoin",
        q: "Fill in the blank so the second JOIN links to the books table.",
        code: J(
          ...X3,
          ...XQ("sel", "SELECT COUNT(*) FROM loans ", "JOIN members ", "ON loans.member_id = members.id ", "JOIN books ", "ON loans.book_id = ___"),
          "cur.execute(sel)",
          "print(cur.fetchone()[0])",
        ),
        chips: ["books.id", "members.id", "loans.id"],
        answer: 0,
        explain: "The partner of the book number book_id is books.id. Linking with members.id compares against member numbers and links the wrong rows, and loans.id doesn't exist, so you get an OperationalError clue.",
      },
      {
        type: "choice", concept: "sqlhaving",
        q: "What's the output?",
        code: J(
          ...X3,
          ...XQ("sel", "SELECT members.name, SUM(loans.days) ", "FROM loans JOIN members ", "ON loans.member_id = members.id ", "GROUP BY members.name ", "HAVING SUM(loans.days) >= 10 ", "ORDER BY members.name"),
          "cur.execute(sel)",
          "r = cur.fetchone()",
          "print(r[0], r[1])",
        ),
        options: ["Yuna 21", "Jun 5", "Yuna 2"],
        answer: 0,
        explain: "Yuna borrowed for 7 and 14 days, a total of 21, which passes the limit of 10. Jun has only 5 days, so HAVING drops Jun.",
      },
      {
        type: "choice", concept: "sqljoin",
        q: "A member is in the members table but has no loans. What happens to them in the per-member result?",
        options: ["They don't appear in the JOIN result", "They show up with a count of 0", "It causes an error"],
        answer: 0,
        explain: "INNER JOIN keeps only rows with a match. A member whose number isn't in loans has no rows to link, so they don't appear in the stats.",
      },
      {
        type: "write", concept: "sqlhaving",
        task: "The starter loads members.csv, books.csv and loans.csv into tables. n=int(input()). JOIN them and print per member “name count days” (most days first, name order for ties), then, using HAVING, only genres with n or more loans as “genre avg X.X” (genre order, round to 1 place). Input 2 → first line Yuna 3 24",
        starter: J(
          ...XHEAD,
          ...XLOAD("members", "id INTEGER, name TEXT"),
          ...XLOAD("books", "id INTEGER, title TEXT, genre TEXT"),
          ...XLOAD("loans", "member_id INTEGER, book_id INTEGER, days INTEGER"),
          "n = int(input())", "",
        ),
        files: A3F(A3_P),
        tests: [
          { stdin: "2", expect: "Yuna 3 24\nJun 3 18\nDami 1 2\nkids avg 6.0\nnovel avg 8.5", public: true },
          { stdin: "3", expect: "Yuna 3 24\nJun 3 18\nDami 1 2\nkids avg 6.0", public: false },
          { stdin: "2", expect: "Ara 2 11\nBora 2 11\nhistory avg 6.5\npoem avg 4.5", public: false, files: A3F(A3_Q) },
          { stdin: "5", expect: "Ara 2 11\nBora 2 11", public: false, files: A3F(A3_Q) },
        ],
        require: ["SQL:JOIN", "SQL:HAVING", "Method:execute", "Method:fetchall", "For"],
        hints: [
          "The output has two parts. Member stats first, then genre averages.",
          "Per member, JOIN loans and members; per genre, JOIN loans and books. Filter genres with HAVING and pass the value n with ?.",
          "Per member is GROUP BY members.name sorted by SUM(loans.days) DESC; per genre is GROUP BY books.genre HAVING COUNT(*) >= ?.",
          "sel = (\"SELECT books.genre, AVG(loans.days) \"\n       \"FROM loans JOIN books ON ___ \"\n       \"GROUP BY books.genre \"\n       \"HAVING COUNT(*) >= ? ORDER BY books.genre\")",
        ],
        solution: J(
          ...XHEAD,
          ...XLOAD("members", "id INTEGER, name TEXT"),
          ...XLOAD("books", "id INTEGER, title TEXT, genre TEXT"),
          ...XLOAD("loans", "member_id INTEGER, book_id INTEGER, days INTEGER"),
          "n = int(input())",
          ...XQ("sel", "SELECT members.name, COUNT(*), ", "SUM(loans.days) FROM loans ", "JOIN members ", "ON loans.member_id = members.id ", "GROUP BY members.name ", "ORDER BY SUM(loans.days) DESC, ", "members.name"),
          ...XFETCH("r[0], r[1], r[2]"),
          ...XQ("sel", "SELECT books.genre, AVG(loans.days) ", "FROM loans JOIN books ", "ON loans.book_id = books.id ", "GROUP BY books.genre ", "HAVING COUNT(*) >= ? ", "ORDER BY books.genre"),
          "cur.execute(sel, (n,))",
          "rows = cur.fetchall()",
          "for r in rows:",
          "    avg = round(r[1], 1)",
          `    print(f"{r[0]} avg {avg}")`,
        ),
        explain: "JOIN attached names and genres, and GROUP BY grouped them. It's an INNER JOIN, so members with no records drop out, and HAVING filters out genres with fewer than n loans.",
      },
      {
        type: "check", concept: "sqlhaving",
        q: "How do you keep only genres with n or more loans?",
        options: ["HAVING COUNT(*) >= n after GROUP BY", "WHERE COUNT(*) >= n", "ORDER BY COUNT(*) >= n"],
        answer: 0,
        explain: "You only know the count after grouping, so it's HAVING. COUNT in WHERE gives a clue, and ORDER BY doesn't filter, it just lines rows up.",
      },
    ],
  },
];
