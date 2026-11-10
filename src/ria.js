// 리아 교수(문리아) 그림 — #리아_이미지_세트2 (v0.12.4~). 이미지 파일 없이 SVG 문자열로 그린다.
// 그림 데이터: data/ria_set2.js (원본 art/ria_set2_sheet.svg → tools/ria_set2_import.py로 생성, 손으로 고치지 않음)
// 80칸이 나눠 쓰는 조각(pieces)을 칸마다 정해진 순서로 이어 붙인다. 같은 입력이면 언제나 같은 문자열.
// <defs>·id·<text>를 쓰지 않아 한 화면에 여러 장을 넣어도 충돌이 없다. 파이썬 로고(상표)는 그리지 않는다.
// 옛 코드 그림 #리아_이미지_세트1은 art/ria_set1/ria_set1.js에 보관(빌드에 안 들어감).
import { RIA_SET2 } from "../data/ria_set2.js";
import { t, tp, tx } from "./i18n.js";

export const RIA_SET = "set2";
export const OUTFIT_IDS = Object.freeze(["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"]);
export const FACE_IDS = Object.freeze(["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"]);
// 80칸 전체를 감싸는 틀(원본 좌표). 세트1과 같은 가로세로 비율(200:260)이라 화면 배치가 그대로다.
export const RIA_VIEWBOX = "166 -6 354 460";
const RATIO = 260 / 200;

export const OUTFIT_KO = Object.freeze({ // I18N_SKIP: 한국어 기준 표(영어는 tx outfit.*.short)
  basic: "기본복장", casual: "캐주얼룩", whitecoat: "화이트 코트", hoodie: "후드티", gym: "체육복",
  chef: "요리사 옷", explorer: "탐험가 옷", uniform: "교복", wizard: "마법사 망토", graduate: "졸업 가운", // I18N_SKIP: 한국어 기준 표
});
export const FACE_KO = Object.freeze({ // I18N_SKIP: 한국어 기준 표(영어는 faceName)
  smile: "미소", joy: "기쁨", sparkle: "반짝", think: "생각", surprise: "놀람", worry: "걱정", cheer: "응원", wink: "장난",
});

// 세트2가 쓰는 색 전부(시험이 확인)
export const RIA_COLORS = Object.freeze([...new Set(RIA_SET2.pieces.concat(RIA_SET2.heads).join("").match(/#[0-9a-fA-F]{3,8}\b/g).map((c) => c.toUpperCase()))]);

// 표정 이름(이름표용). 영어는 영어 표의 face:: 열쇠
const faceName = (f) => ({
  smile: tp("face", "미소"), joy: tp("face", "기쁨"), sparkle: tp("face", "반짝"), think: tp("face", "생각"),
  surprise: tp("face", "놀람"), worry: tp("face", "걱정"), cheer: tp("face", "응원"), wink: tp("face", "장난"),
})[f];

const cache = new Map();
function cell(oid, fid) {
  const k = oid + "_" + fid;
  if (!cache.has(k)) {
    const row = RIA_SET2.cells[k];
    cache.set(k, RIA_SET2.heads[row[0]] + row.slice(1).map((i) => RIA_SET2.pieces[i]).join("") + "</g>");
  }
  return cache.get(k);
}

const n = (v) => Math.round(v * 10) / 10;
function clampSize(v) {
  const x = v === null || v === undefined || v === "" ? NaN : Number(v);
  if (!Number.isFinite(x) || x <= 0) return 160;
  return Math.min(2048, Math.max(1, x));
}

// class="ria"·g.ria-body는 화면 쪽 움직임(숨쉬기·폴짝)을 거는 고리다
export function riaSVG(opts) {
  const { outfit = "basic", face = "smile", size = 160 } = opts ?? {};
  const oid = typeof outfit === "string" && OUTFIT_IDS.includes(outfit) ? outfit : "basic";
  const fid = typeof face === "string" && FACE_IDS.includes(face) ? face : "smile";
  const sz = clampSize(size);
  const label = t`리아 교수, ${faceName(fid)}, ${tx(`outfit.${oid}.short`, OUTFIT_KO[oid])}`; // v0.13.0 영어판
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ria" viewBox="${RIA_VIEWBOX}" width="${n(sz)}" height="${n(sz * RATIO)}" role="img" aria-label="${label}"><title>${label}</title><g class="ria-body">${cell(oid, fid)}</g></svg>`;
}
