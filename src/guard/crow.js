// 경비실 해커 「크로우」 그림 (v0.15.0, 설계 docs/specs/2026-11-12-경비실-설계.md §4). 이미지 파일 없이 SVG 문자열로 그린다.
// 그림 데이터: data/crow.js (원본 art/crow_sheet.svg → tools/crow_import.py로 생성, 손으로 고치지 않음)
// 6포즈가 나눠 쓰는 조각(pieces)을 포즈마다 정해진 순서로 이어 붙인다. 같은 입력이면 언제나 같은 문자열.
// <defs>·id·<text>를 쓰지 않아 한 화면에 여러 장을 넣어도 충돌이 없다. 말풍선 글자는 화면 쪽이 언어에 맞게 띄운다.
import { CROW } from "../../data/crow.js";
import { t } from "../i18n.js";

export const CROW_POSES = Object.freeze(["wave", "wait", "shock", "loot", "cry", "rank"]);

const cache = new Map();
function body(pose) {
  if (!cache.has(pose)) cache.set(pose, CROW.head + CROW.poses[pose].map((i) => CROW.pieces[i]).join("") + "</g>");
  return cache.get(pose);
}

const n = (v) => Math.round(v * 10) / 10;
function clampSize(v) {
  const x = v === null || v === undefined || v === "" ? NaN : Number(v);
  if (!Number.isFinite(x) || x <= 0) return 120;
  return Math.min(2048, Math.max(1, x));
}

// class="crow"·g.crow-body는 화면 쪽 움직임을 거는 고리다
export function crowSVG({ pose = "wave", size = 120 } = {}) {
  const p = typeof pose === "string" && CROW_POSES.includes(pose) ? pose : "wave";
  const sz = n(clampSize(size));
  const label = t`크로우`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="crow" viewBox="${CROW.viewBox}" width="${sz}" height="${sz}" role="img" aria-label="${label}"><title>${label}</title><g class="crow-body">${body(p)}</g></svg>`;
}
