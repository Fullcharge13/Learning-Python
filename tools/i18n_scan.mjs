// 영어판 문구 찾기 (v0.13.0). 코드 속 한글 문자열을 찾아 t``로 감쌌는지 본다.
//   node tools/i18n_scan.mjs            → 감싸지 않은 한글 문자열 목록(파일:줄)
//   node tools/i18n_scan.mjs --keys     → t``·tk("…")가 쓰는 열쇠 전부(JSON 배열)
//   node tools/i18n_scan.mjs --json     → { keys, raw: [{file, line, text}] }
// 주석·console 문구·허용 목록(I18N_SKIP 주석이 붙은 줄)은 뺀다. 열쇠 만드는 법은 src/i18n.js keyOf와 같다.
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
// 화면 문구가 없는 파일(데이터 표는 tx로, 그림 데이터는 글자가 없음)
const SKIP_FILES = new Set(["src/i18n.js", "src/snake.js", "src/worker.js"]); // ria.js는 이름표가 있어 검사함(v0.13.0 검토)

export function scanFiles() {
  const out = [];
  const walkDir = (d) => {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      const rel = path.join(d, f);
      const st = fs.statSync(path.join(ROOT, rel));
      if (st.isDirectory()) walkDir(rel);
      else if (f.endsWith(".js") && !SKIP_FILES.has(rel)) out.push(rel);
    }
  };
  walkDir("src");
  return out.sort();
}

export function scan(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const lines = src.split("\n");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const keys = [];
  const raw = [];
  const okNodes = new Set();
  walk.full(ast, (node) => {
    if (node.type === "TaggedTemplateExpression" && node.tag.type === "Identifier" && node.tag.name === "t") {
      okNodes.add(node.quasi);
      keys.push(node.quasi.quasis.map((q) => q.value.cooked).join("{}"));
    }
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && ["tk", "tx", "tp"].includes(node.callee.name)) {
      for (const a of node.arguments) okNodes.add(a);
      if (node.callee.name === "tk" && node.arguments[0]?.type === "Literal") keys.push(node.arguments[0].value);
      if (node.callee.name === "tp" && node.arguments[0]?.type === "Literal" && node.arguments[1]?.type === "Literal")
        keys.push(`${node.arguments[0].value}::${node.arguments[1].value}`);
    }
    // console.* 안의 문구는 개발자용
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.name === "console") {
      for (const a of node.arguments) okNodes.add(a);
    }
  });
  const skipLine = (ln) => /I18N_SKIP/.test(lines[ln - 1] || "") || /I18N_SKIP/.test(lines[ln - 2] || "");
  walk.ancestor(ast, {
    Literal(node, anc) {
      if (typeof node.value !== "string" || !HANGUL.test(node.value)) return;
      if (anc.some((a) => okNodes.has(a)) || skipLine(node.loc.start.line)) return;
      // import 경로·객체 열쇠 이름은 문구가 아님
      const parent = anc[anc.length - 2];
      if (parent && (parent.type === "ImportDeclaration" || (parent.type === "Property" && parent.key === node))) return;
      raw.push({ file: rel, line: node.loc.start.line, text: node.value });
    },
    TemplateLiteral(node, anc) {
      if (!node.quasis.some((q) => HANGUL.test(q.value.cooked))) return;
      if (anc.some((a) => okNodes.has(a)) || skipLine(node.loc.start.line)) return;
      raw.push({ file: rel, line: node.loc.start.line, text: node.quasis.map((q) => q.value.cooked).join("{}") });
    },
  });
  return { keys, raw };
}

export function scanAll() {
  const keys = new Set();
  const raw = [];
  for (const f of scanFiles()) {
    const r = scan(f);
    r.keys.forEach((k) => keys.add(k));
    raw.push(...r.raw);
  }
  return { keys: [...keys].sort(), raw };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const r = scanAll();
  if (process.argv.includes("--keys")) console.log(JSON.stringify(r.keys, null, 1));
  else if (process.argv.includes("--json")) console.log(JSON.stringify(r));
  else {
    const by = {};
    for (const x of r.raw) by[x.file] = (by[x.file] || 0) + 1;
    for (const x of r.raw) console.log(`${x.file}:${x.line}  ${x.text.slice(0, 80).replace(/\n/g, "⏎")}`);
    console.log("\n감싸지 않은 한글 문자열:", r.raw.length, JSON.stringify(by));
    console.log("t 열쇠:", r.keys.length);
  }
}
