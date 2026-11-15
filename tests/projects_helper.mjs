// tests/projects.py의 도우미: data/projects.js(한국어)·data/projects.en.js(영어)와 보상 상수, 아이콘 이름을 JSON으로 준다.
//   node tests/projects_helper.mjs   → { ko: [...], en: [...], stepXp, doneXp, index }
import { PROJECTS as KO } from "../data/projects.js";
import { PROJECTS as EN } from "../data/projects.en.js";
import { PROJECT_STEP_XP, PROJECT_DONE_XP } from "../src/projects/state.js";
import { buildProjectIndex } from "../src/projects/catalog.js";

process.stdout.write(JSON.stringify({ ko: KO, en: EN, stepXp: PROJECT_STEP_XP, doneXp: PROJECT_DONE_XP,
  index: buildProjectIndex(KO, EN) }));
