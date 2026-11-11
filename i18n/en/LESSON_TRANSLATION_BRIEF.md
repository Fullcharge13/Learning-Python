# Lesson translation brief (영어 레슨 번역 지침) — v0.13.1~v0.13.4

You translate ONE chapter file of the Korean Python course 「리아와 파이썬!」 (Ria & Python!) into English.

**Read first:** `docs/specs/2026-11-11-영어판-설계.md` §3–§4 and `i18n/en/glossary.md` (mandatory terms and style). Look at `i18n/en/ui.lesson.json` and `i18n/en/data.json` briefly to match the app's existing English voice.

## Input / output

- Input: `data/lessons/chN.js` (do not edit).
- Output: `data/lessons/en/chN.js` — same ES-module shape: `export const CHAPTER`, `LESSONS`, and `ADVANCED` / `TEMPLATES` if present.
- Write it with the same structure and order. The safest method is to load the Korean module with node and write the English file from a script that keeps every non-text value identical. Never retype ids, answers or structure by hand.
- Keep the file readable: same layout style as the Korean file, one lesson per block. The comments at the top can be short English comments.

## What must stay identical (the parity test enforces this)

- `id`, `chapter`, `isAdvanced`, `isExam`, `updated`, `type`, `concept`, `answer`, `public`, `require`, `min`, `max`, `kind`, `status`, `show_only`
- Order and length of every array: lessons, cards, items, options, chips, lines, tests, hints, summary, wrong, vars lists…
- Object keys: the same keys everywhere, including `files` names, `server` URLs and `vars` names. File names and URLs are already ASCII, so keep them as they are.
- `task` text may be translated. The structural fields of tests stay the same.

## What you translate

All Korean text:
- `title`, `goal`, `summary`, `say`, `q`, `options`, `explain`, `task`, `hints`, `chips` when they are words
- **Korean inside code and data**: string literals, comments, `print` text, `out`, `expect`, `stdin`, test inputs and outputs, `solution`, `starter`, file contents, server bodies, chart labels and titles, template `vars` values.

There must be **no Hangul anywhere** in the output file.

## Code and output consistency (most important)

- If you change a string in code, every expected output that depends on it must change the same way: `out`, `expect`, test outputs, options that show output, explanations that quote output.
- The content checker actually runs every code sample and test, so mismatches fail.
- Keep numbers the same where you can (prices in won, counts). Keep Korean setting words as romanized English: gimbap, tteokbokki, Seoul, won (₩). Explain a Korean food or thing briefly the first time it appears in a lesson, e.g. "gimbap (Korean rice rolls)".
- Lessons that depend on Korean text (string length/slicing of Korean words, Korean in regex patterns, sorting Korean names, character counts, encoding) must be **adapted** to English text so the lesson teaches the same concept. Recompute outputs by running the code; do not guess.
- Code lines must still fit the phone width: at most 38 columns. Hangul counted double, so English strings may now be longer — rewrap or shorten when needed.
- Wrong-answer options (`options` in choice questions, `wrong` code in templates) must stay plausibly wrong in English. If an option shows an output, recompute it.
- Korean quote marks 「」 become “ ” or plain quotes in prose. In code, use normal Python quotes.

## Checker keywords (the content checker reads these words in English mode)

- A choice/check question that asks for the printed result must contain the word **"output"** or **"print"** (e.g. "What's the output?", "What does this print?"). The checker then requires the correct option to equal the real output.
- If the code raises an error and the question asks for output, the correct option must contain the word **"error"**. Use **"It causes an error"** — the same text the app uses.
- A code-less question that asks which code fails or works must say **"causes an error"** (e.g. "Which code causes an error?") or **"without an error"** (e.g. "Which code runs without an error?").
- 단서 (what the course calls error messages) → **"clue"**.

## Voice

- Professor Ria: warm, brief, a little playful. Use plain friendly English, no honorifics. Keep her jokes; replace Korean wordplay with jokes that work in English.
- Questions stay short. Explanations follow the order "why it's right → what the trap was". Never put the full answer code in an explanation of a write task.
- Use the glossary terms (variable, string, list, dictionary, loop, indentation, chapter checkpoint, Deep Dive…).

## Checks you must run before reporting

1. `python3 tests/lesson_parity.py --ch N` → `ok chN`
2. `python3 tests/content.py --lang en` → no errors for your chapter's file. Other translators' chapters may show up in the same run; ignore those, but your section must be clean. This run executes all code, so it can take a few minutes.
3. Optional sanity check: `node -e` to import your file.

## Rules

- Edit only `data/lessons/en/chN.js` (and a scratch script outside the repo if you need one).
- Do not run `build.py` or `tests/flow.py`. Do not git commit. Do not spawn subagents.
- Report: DONE / BLOCKED / NEEDS_CONTEXT. Include counts (lessons, items translated), the adaptations you made where Korean text was the subject (one line each), and anything you were unsure about.
