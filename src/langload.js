// 언어 꾸러미 받기 (v0.13.0, 설계 docs/specs/2026-11-11-영어판-설계.md §2)
// 배포판: build.py가 넣은 window.RIA_LANG_FILES = { en: "lang/en-<지문>.json" } (서비스 작업자 저장본으로 오프라인도 됨)
// 개발판(tools/dev.py): 그 값이 없으면 원본 i18n/en/*.json을 직접 받아 합친다.
import { usePack, hasPack } from "./i18n.js";

const DEV_SOURCES = { en: ["i18n/en/ui.lesson.json", "i18n/en/ui.shell.json", "i18n/en/ui.garden.json", "i18n/en/ui.garden_nodes.json", "i18n/en/data.json"] };

const TIMEOUT_MS = 4000; // 느린 첫 연결에서 시작 화면이 멈추지 않게(검토 I3). 넘으면 한국어로 시작

async function getJson(url) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
  let r;
  try { r = await fetch(new URL(url, location.href), ctl ? { signal: ctl.signal } : undefined); }
  finally { if (timer) clearTimeout(timer); }
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

/** 꾸러미를 받아 i18n에 넣는다. 성공하면 true(이미 있으면 바로 true), 못 받으면 false */
export async function loadLangPack(l) {
  if (hasPack(l)) return true;
  try {
    const files = typeof window !== "undefined" && window.RIA_LANG_FILES;
    if (files && files[l]) {
      usePack(l, await getJson(files[l]));
      return true;
    }
    if (!DEV_SOURCES[l]) return false;
    const pack = { ui: {}, data: {} };
    for (const src of DEV_SOURCES[l]) {
      const part = await getJson(src);
      Object.assign(src.endsWith("data.json") ? pack.data : pack.ui, part);
    }
    usePack(l, pack);
    return true;
  } catch (e) {
    console.warn("lang pack", l, e);
    return false;
  }
}
