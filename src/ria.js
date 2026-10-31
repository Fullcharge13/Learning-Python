// 리아 교수(문리아) 그림 — 이미지 파일 없이 SVG 문자열로 그린다 (설계 6-5, v0.6 다시 그리기: 설계 2026-10-31)
// 겹치는 순서: 바닥 그림자·바닥 소품 → 뒤(망토·가방·칠판) → 뒷머리·올림머리 → 몸·의상 → 팔·손에 든 것 → 얼굴 → 표정
//              → 앞머리(청록 브릿지) → 안경 → 눈썹 → 모자 → 얼굴로 올린 팔 → 효과(g.ria-fx)
// 같은 입력이면 언제나 같은 문자열. <defs>·id·<text>를 쓰지 않아 한 화면에 여러 장을 넣어도 충돌이 없다.
// 파이썬 로고(상표)는 그리지 않는다. 그 자리에는 리아의 뱀 무늬(snakeMark) 또는 </> 를 쓴다.

export const OUTFIT_IDS = Object.freeze(["basic", "casual", "whitecoat", "hoodie", "gym", "chef", "explorer", "uniform", "wizard", "graduate"]);
export const FACE_IDS = Object.freeze(["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"]);

const W = 200, H = 260;
// 쓰는 색은 모두 여기에 있다(시험이 확인).
const C = {
  ol: "#3B2C35", white: "#FFFFFF",
  skin: "#FFE6D5", skinS: "#F6C9B0", blush: "#FF8E94", nose: "#E09A80", mouth: "#A8323F", tongue: "#F57F8C",
  hair: "#1D2840", hairHi: "#3B527A", hairD: "#121A2B", teal: "#1FB0A3", tealHi: "#7BE3D6",
  eye: "#9A5A2C", eyeD: "#4A2614", eyeL: "#D29457", pupil: "#2E170B",
  yellow: "#FFD43B", gold: "#E2B04A", goldD: "#B9862C", pink: "#F49AA8", wood: "#F6D9B0",
  navy: "#26315A", navyS: "#1A2343", navyHi: "#3C4C82", pantsD: "#232842", shoe: "#2B2932",
  shirt: "#FFFFFF", shirtS: "#E2E7EF", gray: "#C9CDD3", grayD: "#8A90A0",
  green: "#78C95A", greenS: "#56A23C", greenB: "#CDEE98",
  cream: "#F3E6C8", creamS: "#DCC9A2", dark: "#3A3D47", darkS: "#2A2C33", darkHi: "#585D6B", screen: "#25303F",
  brown: "#8A5A34", brownL: "#C08A55", red: "#E0393E", redS: "#B42A30",
  blue: "#3D8BE0", blueS: "#2E6FB8", blueL: "#9CCBF5", sky: "#CFEAFB",
  black: "#2A2C33", blackS: "#1C1E24", coatS: "#E4E9EE",
  khaki: "#D9B77A", khakiS: "#B8955A", olive: "#8C8F4E", oliveS: "#6F7238", jeans: "#4C6A9A", map: "#F2E2B8", mapS: "#C9A66B",
  plaid: "#3A4F8A", plaidD: "#22305E", plaidL: "#7F96D0", blossom: "#FFB7C9", blossomD: "#FF7FA3",
  robe: "#2E2F6E", robeS: "#202155", robeHi: "#4A4BA0", orb: "#8FD3FF", orbL: "#E3F5FF", purple: "#7656C6", purpleS: "#5A3FA0",
  page: "#F7EED8", food: "#C7843F", foodD: "#9A5F27", leaf: "#5CC06A", heart: "#FF6F91", motion: "#5FCB86",
  shadow: "#3B2C35",
};
export const RIA_COLORS = Object.freeze([...new Set(Object.values(C))]);

// ---- 작은 도우미 ----
const n = (v) => Math.round(v * 10) / 10;
function p(d, fill, o = {}) {
  const sw = o.sw ?? 2.6, st = o.stroke ?? (sw ? C.ol : "none");
  return `<path d="${d}" fill="${fill}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${o.op ? ` opacity="${o.op}"` : ""}${o.tf ? ` transform="${o.tf}"` : ""}/>`;
}
const S = (d, fill, op) => p(d, fill, { sw: 0, op }); // 테두리 없는 그림자·빛
function circ(x, y, r, fill, o = {}) {
  const sw = o.sw ?? 2.6;
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" stroke="${sw ? (o.stroke ?? C.ol) : "none"}" stroke-width="${sw}"${o.op ? ` opacity="${o.op}"` : ""}/>`;
}
function ell(x, y, rx, ry, fill, o = {}) {
  const sw = o.sw ?? 2.6;
  const rot = o.rot ? ` transform="rotate(${o.rot} ${n(x)} ${n(y)})"` : "";
  return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="${sw ? (o.stroke ?? C.ol) : "none"}" stroke-width="${sw}"${o.op ? ` opacity="${o.op}"` : ""}${rot}/>`;
}
// 둥근 네모(회전 가능)
function box(x, y, w, h, r, fill, o = {}) {
  const sw = o.sw ?? 2.6;
  const rot = o.rot ? ` transform="rotate(${o.rot} ${n(x + w / 2)} ${n(y + h / 2)})"` : "";
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${r}" fill="${fill}" stroke="${sw ? (o.stroke ?? C.ol) : "none"}" stroke-width="${sw}"${o.op ? ` opacity="${o.op}"` : ""}${rot}/>`;
}
const line = (d, color = C.ol, w = 2.6, op) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op ? ` opacity="${op}"` : ""}/>`;
// 팔·막대처럼 굵은 선: 바깥 테두리 + 안쪽 색
const limb = (d, color, w = 12) => line(d, C.ol, w + 5.2) + line(d, color, w);
const pts = (a) => "M" + a.map(([x, y]) => `${n(x)},${n(y)}`).join(" L");
const g = (tf, body) => `<g transform="${tf}">${body}</g>`;
function star(x, y, r, fill, o = {}) {
  const a = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    a.push([x + rr * Math.cos(ang), y + rr * Math.sin(ang)]);
  }
  return p(pts(a) + "Z", fill, { sw: o.sw ?? 1.8 });
}
const sparkle = (x, y, r, fill = C.yellow) =>
  p(`M${x},${y - r} Q${n(x + r * 0.18)},${n(y - r * 0.18)} ${x + r},${y} Q${n(x + r * 0.18)},${n(y + r * 0.18)} ${x},${y + r} Q${n(x - r * 0.18)},${n(y + r * 0.18)} ${x - r},${y} Q${n(x - r * 0.18)},${n(y - r * 0.18)} ${x},${y - r}Z`, fill, { sw: 1.6 });
const heart = (x, y, r, fill = C.heart) =>
  p(`M${x},${n(y + r)} C${n(x - r * 1.6)},${n(y - r * 0.2)} ${n(x - r * 0.8)},${n(y - r * 1.4)} ${x},${n(y - r * 0.5)} C${n(x + r * 0.8)},${n(y - r * 1.4)} ${n(x + r * 1.6)},${n(y - r * 0.2)} ${x},${n(y + r)} Z`, fill, { sw: 1.6 });
// </> 무늬 (책·노트북·칠판)
const codeMark = (x, y, s, col, w = 2.4) =>
  line(`M${n(x - 4 * s)},${n(y - 4 * s)} L${n(x - 8 * s)},${y} L${n(x - 4 * s)},${n(y + 4 * s)} M${n(x + 4 * s)},${n(y - 4 * s)} L${n(x + 8 * s)},${y} L${n(x + 4 * s)},${n(y + 4 * s)} M${n(x + 1.5 * s)},${n(y - 5 * s)} L${n(x - 1.5 * s)},${n(y + 5 * s)}`, col, w);
// 리아의 뱀 무늬(브로치·옷 무늬): 청록 S자 + 노란 머리
function snakeMark(x, y, s = 1, body = C.teal) {
  const d = `M${n(x - 6 * s)},${n(y + 6 * s)} Q${n(x - 9 * s)},${n(y - 1 * s)} ${n(x - 2 * s)},${n(y - 1 * s)} Q${n(x + 5 * s)},${n(y - 1 * s)} ${n(x + 3 * s)},${n(y - 7 * s)}`;
  return line(d, C.ol, 5.8 * s) + line(d, body, 3.4 * s) + circ(x + 3 * s, y - 7.5 * s, 2.6 * s, C.yellow, { sw: 1.4 * s });
}

// ---- 손 ----
// kind: open(둥근 손) · point(검지 위로) · peace(브이) · fist(주먹)
function hand(x, y, kind = "open", r = 7) {
  let s = "";
  if (kind === "point") s += limb(`M${x + 1},${y - 3} L${x + 2},${y - 13}`, C.skin, 4.2);
  if (kind === "peace") s += limb(`M${x - 2},${y - 3} L${x - 5},${y - 14}`, C.skin, 4) + limb(`M${x + 2},${y - 3} L${x + 5},${y - 14}`, C.skin, 4);
  s += circ(x, y, r, C.skin);
  s += S(`M${x - r + 2},${y + 1} A${r - 2},${r - 2} 0 0 0 ${x + r - 2},${y + 1} Z`, C.skinS, 0.6);
  if (kind === "fist") s += line(`M${x - 4},${y - 2} L${x + 4},${y - 2} M${x - 4},${y + 2} L${x + 3},${y + 2}`, C.nose, 1.4);
  return s;
}

// ---- 몸의 기본 치수 ----
const SH_L = [76, 158], SH_R = [124, 158];          // 어깨(팔 시작)
const DOWN_L = [[66, 182], [64, 200]], DOWN_R = [[134, 182], [136, 200]]; // 내린 팔(팔꿈치, 손)
const torsoD = (len = 208, flare = 0) =>
  `M78,151 Q67,153 66,167 L${65 - flare},${len} Q100,${len + 6} ${135 + flare},${len} L134,167 Q133,153 122,151 Q100,146 78,151 Z`;
const neck = () => p("M94,138 L106,138 L106,153 Q100,156 94,153 Z", C.skinS, { sw: 2.2 });

function legs({ pants = C.pantsD, shoe = C.shoe, top = 202, stripe = null, sole = null, boot = false, sock = null } = {}) {
  let s = p(`M85,${top} L85,236 Q85,239 89,239 L95,239 Q98,239 98,236 L98,${top} Z`, pants);
  s += p(`M102,${top} L102,236 Q102,239 105,239 L111,239 Q115,239 115,236 L115,${top} Z`, pants);
  if (sock) s += p("M85,226 L98,226 L98,238 L85,238 Z", sock, { sw: 2.2 }) + p("M102,226 L115,226 L115,238 L102,238 Z", sock, { sw: 2.2 });
  if (stripe) s += line(`M88,${top + 5} L88,234 M112,${top + 5} L112,234`, stripe, 2.2);
  if (boot) {
    s += p("M83,224 L83,246 Q83,249 87,249 L101,249 Q102,244 99,241 L99,224 Z", shoe);
    s += p("M101,224 L101,241 Q98,244 99,249 L113,249 Q117,249 117,246 L117,224 Z", shoe);
    s += line("M84,231 L98,231 M102,231 L116,231", C.ol, 1.6);
  } else {
    s += p("M82,244 Q82,236 91,236 Q100,236 100,243 Q100,248 95,248 L86,248 Q82,248 82,244 Z", shoe);
    s += p("M100,243 Q100,236 109,236 Q118,236 118,244 Q118,248 114,248 L105,248 Q100,248 100,243 Z", shoe);
  }
  if (sole) s += line("M83.5,246 L98.5,246 M101.5,246 L116.5,246", sole, 1.8);
  return s;
}
// 셔츠 깃 V
const shirtV = (bot = 178, col = C.shirt) =>
  p(`M87,151 L100,${bot} L113,151 Q100,155 87,151 Z`, col) +
  p("M87,151 L94,163 L100,156 Z", col, { sw: 2 }) + p("M113,151 L106,163 L100,156 Z", col, { sw: 2 });
// 재킷 깃(라펠)
const lapels = (col, bot = 182) =>
  p(`M87,151 L79,163 L86,168 L81,173 L100,${bot + 4} L90,160 Z`, col, { sw: 2.2 }) +
  p(`M113,151 L121,163 L114,168 L119,173 L100,${bot + 4} L110,160 Z`, col, { sw: 2.2 });
const sideShade = (len, col, op = 0.6) => S(`M122,152 Q133,154 134,167 L135,${len - 1} Q129,${len + 2} 123,${len + 2} Z`, col, op);

// ---- 뱀 친구 ----
function snake(x, y, s = 1, hat = false) {
  // (x, y) = 똬리 가운데 바닥
  const body = `M${x - 18},${y - 4} Q${x - 22},${y - 14} ${x - 4},${y - 15} Q${x + 18},${y - 15} ${x + 16},${y - 27} Q${x + 14},${y - 38} ${x},${y - 40} Q${x - 10},${y - 42} ${x - 8},${y - 52}`;
  let d = ell(x + 2, y - 5, 22, 7, C.green);
  d += S(`M${x - 14},${y - 4} Q${x + 2},${y + 1} ${x + 18},${y - 5} Q${x + 4},${y - 2} ${x - 14},${y - 4} Z`, C.greenS, 0.6);
  d += line(body, C.ol, 15.4) + line(body, C.green, 10.2) + line(body, C.greenB, 3.6, 0.9);
  // 머리
  const hx = x - 6, hy = y - 58;
  d += ell(hx, hy, 15, 12, C.green);
  d += S(`M${hx - 9},${hy + 4} Q${hx},${hy + 10} ${hx + 9},${hy + 4} Q${hx},${hy + 7} ${hx - 9},${hy + 4} Z`, C.greenS, 0.6);
  d += ell(hx - 5.5, hy - 2.5, 3.2, 4.2, C.pupil, { sw: 0 }) + ell(hx + 5.5, hy - 2.5, 3.2, 4.2, C.pupil, { sw: 0 });
  d += circ(hx - 6.4, hy - 4, 1.3, C.white, { sw: 0 }) + circ(hx + 4.6, hy - 4, 1.3, C.white, { sw: 0 });
  d += ell(hx - 10, hy + 3.5, 2.8, 1.8, C.blush, { sw: 0, op: 0.8 }) + ell(hx + 10, hy + 3.5, 2.8, 1.8, C.blush, { sw: 0, op: 0.8 });
  d += p(`M${hx - 4},${hy + 4} Q${hx},${hy + 9} ${hx + 4},${hy + 4} Z`, C.mouth, { sw: 1.6 });
  if (hat) {
    d += `<g class="snake-hat">`;
    d += ell(hx, hy - 9, 14, 3.6, C.purple, { sw: 2 });
    d += p(`M${hx - 9},${hy - 10} Q${hx - 4},${hy - 26} ${hx + 8},${hy - 32} Q${hx + 4},${hy - 24} ${hx + 9},${hy - 10} Z`, C.purple, { sw: 2 });
    d += line(`M${hx - 8},${hy - 13} Q${hx},${hy - 15} ${hx + 8},${hy - 13}`, C.gold, 2.4);
    d += star(hx + 1, hy - 21, 3, C.yellow, { sw: 1.1 });
    d += "</g>";
  }
  const tf = s === 1 ? "" : ` transform="translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})"`;
  return `<g class="ria-snake"${tf}>${d}</g>`;
}

// ---- 소품 ----
const book = (x, y, w, h, rot, cover = C.blue, mark = "code") => {
  let s = box(x + 3, y + 3, w, h, 2.5, C.page, { rot, sw: 2.2 });
  s += box(x, y, w, h, 2.5, cover, { rot });
  const cx = x + w / 2, cy = y + h / 2;
  const inner = (mark === "code" ? codeMark(cx, cy + 3, 0.8, C.yellow, 2.2) : snakeMark(cx, cy + 4, 0.8)) +
    line(`M${n(cx - w * 0.3)},${n(y + 6)} L${n(cx + w * 0.3)},${n(y + 6)}`, C.white, 2, 0.8) + line(`M${x + 3.5},${y + 3} L${x + 3.5},${y + h - 3}`, C.navyS, 1.6, 0.7);
  return s + g(`rotate(${rot} ${n(cx)} ${n(cy)})`, inner);
};
const tablet = (x, y, w, h, rot) =>
  box(x, y, w, h, 3.5, C.dark, { rot }) + g(`rotate(${rot} ${n(x + w / 2)} ${n(y + h / 2)})`,
    box(x + 3.5, y + 3.5, w - 7, h - 7, 1.5, C.screen, { sw: 0 }) + codeMark(x + w / 2, y + h / 2, 0.7, C.tealHi, 2));

// ---- 1. 뒷머리·올림머리 ----
function backHair(o) {
  let s = "";
  if (!o.hideBun) {
    if (!o.noPencil) {
      s += limb("M62,22 L138,44", C.yellow, 5.6);
      s += line("M62,22 L68,23.8", C.pink, 5.6);
      s += p("M138,44 L147,48.4 L140,38.2 Z", C.wood, { sw: 1.8 });
      s += circ(146, 47.6, 1.1, C.ol, { sw: 0 });
    }
    s += circ(100, 30, 21, C.hair);
    s += S("M86,19 Q96,10 110,13 Q100,14 92,22 Z", C.hairHi, 0.9);
    s += line("M88,37 Q96,25 112,29", C.hairHi, 2);
    s += line("M91,44 Q103,38 114,41", C.hairD, 1.6);
  }
  // 어깨까지 오는 뒷머리
  s += p("M42,108 C38,60 66,38 100,38 C134,38 162,60 158,108 Q158,124 148,128 L52,128 Q42,124 42,108 Z", C.hair);
  return s;
}

// ---- 2. 의상 ----
const OUTFITS = {
  basic: {
    sleeve: C.navy, cuff: C.shirt,
    armL: [[64, 178], [62, 168]], handL: "point",
    ground: () => snake(170, 246),
    body() {
      let s = legs({ pants: C.pantsD });
      s += neck();
      s += p(torsoD(210), C.navy);
      s += sideShade(210, C.navyS);
      s += shirtV(180) + lapels(C.navyHi, 180);
      s += line("M100,184 L100,210", C.navyS, 2);
      s += circ(104, 194, 2.2, C.gold, { sw: 1.2 }) + circ(104, 204, 2.2, C.gold, { sw: 1.2 });
      s += snakeMark(118, 168, 0.75);
      return s;
    },
    heldL: () => book(52, 178, 26, 34, -14, C.navyHi, "code"),
    fx: () => sparkle(36, 64, 7) + sparkle(166, 56, 6) + sparkle(30, 150, 5, C.yellow),
  },
  casual: {
    sleeve: C.cream, cuff: C.creamS,
    armL: [[64, 182], [74, 196]], armR: [[146, 180], [146, 160]], handR: "fist",
    ground: () => {
      // 가방(왼쪽)·커피(오른쪽)
      let s = p("M8,246 L8,212 Q8,196 26,196 Q44,196 44,212 L44,246 Q26,250 8,246 Z", C.navy);
      s += line("M16,198 Q16,186 26,186 Q36,186 36,198", C.ol, 5) + line("M16,198 Q16,186 26,186 Q36,186 36,198", C.navyHi, 2.4);
      s += p("M12,222 L40,222 L40,240 Q26,243 12,240 Z", C.navyHi, { sw: 2 });
      s += snakeMark(26, 232, 0.6, C.tealHi);
      s += p("M160,214 L184,214 L180,248 L164,248 Z", C.white);
      s += p("M161,224 L183,224 L181.5,238 L162.5,238 Z", C.brownL, { sw: 2 });
      s += box(157, 207, 30, 8, 3, C.dark);
      s += snakeMark(172, 233, 0.45, C.page);
      return s;
    },
    body() {
      let s = legs({ pants: C.navy, shoe: C.white, sole: C.gray, stripe: C.white });
      s += neck();
      s += p(torsoD(210, 2), C.cream);
      s += sideShade(210, C.creamS, 0.8);
      // 후드 깃
      s += p("M80,150 Q100,166 120,150 Q124,156 118,162 Q100,172 82,162 Q76,156 80,150 Z", C.creamS);
      s += line("M94,164 L93,180 M106,164 L107,180", C.white, 2) + circ(93, 181, 1.8, C.white, { sw: 1 }) + circ(107, 181, 1.8, C.white, { sw: 1 });
      s += p("M80,190 L120,190 L124,206 Q100,210 76,206 Z", C.creamS, { sw: 2 });
      s += snakeMark(110, 178, 0.7);
      s += box(64, 203, 72, 7, 3.5, C.creamS, { sw: 2.2 });
      return s;
    },
    heldL: () => tablet(52, 178, 34, 26, -14),
    fx: () => line("M168,70 l10,-8 M172,84 l12,-2 M164,58 l4,-10", C.motion, 3) + line("M28,92 l-10,-4 M30,104 l-11,3", C.motion, 3),
  },
  whitecoat: {
    sleeve: C.white, cuff: C.coatS,
    armL: [[60, 178], [62, 164]],
    armR: [[138, 182], [132, 196]],
    back: () => {
      // 뒤 칠판: 원자 + </>
      let s = box(150, 96, 48, 66, 4, C.white, { sw: 2.4 }) + box(146, 92, 52, 4, 2, C.gray, { sw: 2 });
      const ax = 176, ay = 114;
      s += ell(ax, ay, 12, 4.5, "none", { sw: 1.6, stroke: C.blueS }) + ell(ax, ay, 12, 4.5, "none", { sw: 1.6, stroke: C.blueS, rot: 60 }) + ell(ax, ay, 12, 4.5, "none", { sw: 1.6, stroke: C.blueS, rot: -60 });
      s += circ(ax, ay, 2, C.blueS, { sw: 0 });
      s += codeMark(176, 142, 0.9, C.navyHi, 2.2);
      return s;
    },
    ground: () => {
      let s = box(152, 236, 44, 11, 2, C.navy) + box(156, 225, 38, 11, 2, C.blue) + box(150, 214, 42, 11, 2, C.navyHi);
      s += line("M154,241 L192,241 M159,230 L190,230 M153,219 L188,219", C.page, 1.6);
      return s;
    },
    body() {
      let s = legs({ pants: C.pantsD });
      s += neck();
      s += p(torsoD(224, 4), C.white);
      s += sideShade(224, C.coatS, 0.9);
      // 안쪽 남색 조끼 + 넥타이
      s += p("M86,151 L100,190 L114,151 Q100,155 86,151 Z", C.navy);
      s += p("M90,151 L100,168 L110,151 Q100,154 90,151 Z", C.shirt, { sw: 2 });
      s += p("M98,156 L102,156 L104,176 L100,182 L96,176 Z", C.navyS, { sw: 1.8 });
      s += p("M87,151 L77,165 L86,170 L80,176 L100,194 Z", C.coatS, { sw: 2.2 }) + p("M113,151 L123,165 L114,170 L120,176 L100,194 Z", C.coatS, { sw: 2.2 });
      s += line("M100,194 L100,226", C.ol, 2);
      s += p("M110,198 L124,198 L124,210 L110,210 Z", C.coatS, { sw: 2 });
      s += line("M114,198 L114,190 M119,198 L119,191", C.blue, 2.6);
      s += snakeMark(84, 182, 0.6);
      return s;
    },
    heldL: () => limb("M60,168 L28,124", C.dark, 3) + circ(28, 124, 2.6, C.red, { sw: 1.4 }),
    heldR: () => tablet(128, 180, 22, 30, 12),
    eyewear: () => circ(79, 108, 13.5, "none", { sw: 2.8 }) + circ(121, 108, 13.5, "none", { sw: 2.8 }) + line("M92.5,106 Q100,102 107.5,106", C.ol, 2.4) +
      S("M70,102 Q74,97 79,96 Q73,100 72,104 Z", C.white, 0.9) + S("M112,102 Q116,97 121,96 Q115,100 114,104 Z", C.white, 0.9),
    fx: () => sparkle(30, 160, 7) + sparkle(42, 70, 5, C.tealHi),
  },
  hoodie: {
    sleeve: C.black, cuff: C.blackS,
    armL: [[62, 176], [58, 162]], handL: "point",
    armR: [[142, 194], [130, 214]],
    body() {
      let s = legs({ pants: C.blackS, shoe: C.dark });
      s += neck();
      s += p(torsoD(210, 2), C.black);
      s += sideShade(210, C.blackS, 0.8);
      s += p("M78,150 Q100,168 122,150 Q126,157 119,163 Q100,173 81,163 Q74,157 78,150 Z", C.darkHi);
      s += line("M94,165 L93,180 M106,165 L107,180", C.gray, 2);
      s += snakeMark(114, 182, 0.7);
      return s;
    },
    // 노트북(뚜껑 뒤가 보임) — 오른손이 위에 얹힘
    heldR: () => {
      let s = p("M52,220 L148,220 L142,232 L58,232 Z", C.darkHi);
      s += p("M62,188 L138,188 Q141,188 141,191 L143,220 L57,220 L59,191 Q59,188 62,188 Z", C.dark);
      s += S("M63,192 L137,192 L138,197 L62,197 Z", C.darkHi, 0.5);
      s += snakeMark(100, 207, 0.85, C.gray);
      return s;
    },
    hat: () => {
      // 헤드셋
      let s = line("M46,104 C42,48 70,30 100,30 C130,30 158,48 154,104", C.ol, 9) + line("M46,104 C42,48 70,30 100,30 C130,30 158,48 154,104", C.dark, 4.6);
      s += ell(46, 110, 9, 13, C.dark) + ell(154, 110, 9, 13, C.dark);
      s += ell(46, 110, 4.5, 8, C.teal, { sw: 1.6 }) + ell(154, 110, 4.5, 8, C.teal, { sw: 1.6 });
      s += line("M44,120 Q48,138 76,138", C.ol, 4.4) + line("M44,120 Q48,138 76,138", C.dark, 2) + circ(78, 138, 3, C.dark, { sw: 1.6 });
      return s;
    },
    fx: () => {
      let s = box(12, 128, 32, 18, 9, C.dark, { rot: -12 });
      s += g("rotate(-12 28 137)", line("M19,137 L25,137 M22,134 L22,140", C.white, 2) + circ(34, 134.5, 1.8, C.red, { sw: 0 }) + circ(37, 139, 1.8, C.blue, { sw: 0 }));
      s += line("M166,62 l8,-8 M170,76 l12,-3", C.heart, 3.2) + line("M164,150 l10,4", C.heart, 3.2);
      return s;
    },
  },
  gym: {
    sleeve: C.navy, cuff: C.white, stripe: C.white,
    armL: [[60, 180], [50, 190]],
    armR: [[146, 180], [128, 196]], handR: "fist",
    ground: () => g("rotate(-18 176 236)", box(160, 232, 32, 7, 3, C.gray, { sw: 2 }) + box(152, 222, 12, 26, 4, C.blue) + box(188, 222, 12, 26, 4, C.blue) + line("M155,228 L155,240 M191,228 L191,240", C.blueL, 2)),
    body() {
      let s = legs({ pants: C.navy, shoe: C.white, sole: C.gray, stripe: C.white });
      s += neck();
      s += p(torsoD(210), C.navy);
      s += sideShade(210, C.navyS);
      s += line("M100,166 L100,210", C.white, 2.4);
      s += p("M84,148 L100,160 L116,148 L118,156 L100,166 L82,156 Z", C.white, { sw: 2.2 });
      // 목에 건 수건
      s += p("M84,150 Q100,160 116,150 L118,158 Q100,170 82,158 Z", C.white);
      s += p("M82,156 L91,158 L92,190 Q87,193 82,190 Z", C.white) + p("M118,156 L109,158 L108,190 Q113,193 118,190 Z", C.white);
      s += line("M83,184 L91,184 M109,184 L117,184", C.blueL, 2);
      return s;
    },
    heldL: () => {
      let s = box(36, 162, 18, 38, 6, C.blue, { rot: -8 });
      s += box(38, 154, 14, 10, 3, C.blueS, { sw: 2, rot: -8 });
      s += S("M41,170 L44,170 L46,192 L43,192 Z", C.blueL, 0.9);
      return s;
    },
    fx: () => sparkle(170, 66, 6, C.blueL) + sparkle(178, 84, 4, C.blueL) + sparkle(26, 214, 5, C.blueL),
  },
  chef: {
    sleeve: C.white, cuff: C.coatS,
    hideBun: true, noPencil: true,
    armL: [[58, 182], [56, 192]],
    armR: [[146, 182], [152, 186]],
    body() {
      let s = legs({ pants: C.black });
      s += neck();
      s += p(torsoD(210), C.white);
      s += sideShade(210, C.coatS, 0.9);
      s += p("M86,150 Q100,158 114,150 L114,156 Q100,163 86,156 Z", C.white, { sw: 2.2 });
      for (const y of [166, 178]) s += circ(90, y, 2.2, C.gray, { sw: 1.3 }) + circ(110, y, 2.2, C.gray, { sw: 1.3 });
      // 검은 앞치마
      s += p("M82,176 L118,176 L120,188 L128,192 L130,224 Q100,230 70,224 L72,192 L80,188 Z", C.black);
      s += line("M82,176 L78,160 M118,176 L122,160", C.ol, 2);
      s += snakeMark(100, 206, 0.9);
      return s;
    },
    heldL: () => limb("M56,192 L46,158", C.brown, 4.2) + p("M38,132 L54,128 L56,152 L44,156 Z", C.dark) + line("M44,136 L46,150 M50,134 L52,149", C.darkHi, 2),
    heldR: () => {
      let s = ell(168, 190, 26, 8, C.white);
      s += ell(168, 189, 18, 4.5, C.coatS, { sw: 0 });
      s += ell(160, 182, 9, 6, C.food) + ell(175, 182, 9, 6, C.foodD);
      s += line("M156,180 Q160,177 164,180 M171,180 Q175,177 179,180", C.yellow, 1.8);
      s += p("M166,174 Q170,166 176,170 Q172,172 166,174 Z", C.leaf, { sw: 1.4 });
      return s;
    },
    hat: () => {
      let s = p("M62,58 C44,52 44,22 66,22 C70,2 94,-1 100,10 C108,-2 134,2 136,22 C158,22 156,52 138,58 Z", C.white);
      s += line("M84,28 Q88,42 86,54 M116,28 Q112,42 114,54", C.coatS, 2.4);
      s += p("M60,54 L140,54 Q143,54 143,57 L143,70 Q100,65 57,70 L57,57 Q57,54 60,54 Z", C.white);
      s += S("M60,63 L140,63 L140,67 Q100,63 60,67 Z", C.coatS);
      return s;
    },
    fx: () => line("M162,166 q-4,-6 0,-11 q4,-5 0,-11 M174,164 q-4,-6 0,-11 q4,-5 0,-11", C.grayD, 2.2) + heart(170, 112, 6) + heart(182, 96, 4),
  },
  explorer: {
    sleeve: C.olive, cuff: C.oliveS,
    hideBun: true, noPencil: true,
    armL: [[58, 170], [52, 150]], handL: "point",
    armR: [[138, 188], [124, 208]],
    back: () => box(122, 160, 30, 50, 8, C.olive) + box(128, 186, 22, 18, 5, C.oliveS, { sw: 2 }),
    body() {
      let s = legs({ pants: C.jeans, shoe: C.brown, boot: true });
      s += neck();
      s += p(torsoD(212, 2), C.olive);
      s += sideShade(212, C.oliveS, 0.8);
      s += p("M86,151 L100,200 L114,151 Q100,155 86,151 Z", C.shirt);
      s += p("M87,151 L76,166 L84,171 L80,178 L98,206 Z", C.oliveS, { sw: 2.2 }) + p("M113,151 L124,166 L116,171 L120,178 L102,206 Z", C.oliveS, { sw: 2.2 });
      s += box(68, 184, 14, 12, 2, C.oliveS, { sw: 2 });
      s += line("M130,151 L124,200", C.brown, 3.4);
      return s;
    },
    heldR: () => {
      let s = p("M64,190 L84,186 L104,192 L126,188 L128,226 L106,230 L84,224 L64,228 Z", C.map);
      s += line("M84,186 L84,224 M104,192 L106,230", C.mapS, 1.8);
      s += line("M70,218 Q80,206 92,212 Q100,216 110,206", C.red, 1.8);
      s += line("M114,200 l6,6 M120,200 l-6,6", C.red, 2.4);
      s += p("M70,198 l6,-6 l6,6 Z", C.leaf, { sw: 1.4 });
      return s;
    },
    hat: () => {
      let s = ell(100, 66, 70, 14, C.khaki);
      s += p("M58,66 C56,30 76,18 100,18 C124,18 144,30 142,66 Q100,74 58,66 Z", C.khaki);
      s += p("M59,56 Q100,64 141,56 L142,66 Q100,74 58,66 Z", C.brown, { sw: 2.2 });
      s += line("M70,36 Q100,26 130,36", C.khakiS, 2);
      // 고글
      s += line("M66,46 Q100,36 134,46", C.ol, 4);
      s += circ(86, 40, 10, C.brownL) + circ(114, 40, 10, C.brownL);
      s += circ(86, 40, 6.4, C.sky, { sw: 1.8 }) + circ(114, 40, 6.4, C.sky, { sw: 1.8 });
      s += S("M82,37 Q85,34 88,35 Q85,37 84,39 Z", C.white) + S("M110,37 Q113,34 116,35 Q113,37 112,39 Z", C.white);
      return s;
    },
    fx: () => {
      let s = p("M6,246 L22,216 L30,228 L36,220 L50,246 Z", C.blueS);
      s += p("M17,226 L22,216 L27,226 L24,224 L20,227 Z", C.white, { sw: 1.4 });
      s += circ(178, 170, 13, C.gold) + circ(178, 170, 9, C.white, { sw: 1.6 }) + circ(178, 155.5, 2.6, C.gold, { sw: 1.6 });
      s += p("M178,170 L182,162 L178,166 L174,178 Z", C.red, { sw: 1.2 });
      return s;
    },
  },
  uniform: {
    sleeve: C.navy, cuff: C.shirt,
    armL: [[60, 176], [58, 160]], handL: "peace",
    armR: [[140, 184], [140, 200]],
    body() {
      let s = legs({ pants: C.skin, shoe: C.shoe, top: 214, sock: C.navy });
      // 주름 체크 치마
      s += p("M68,198 L132,198 L138,224 Q100,230 62,224 Z", C.plaid);
      s += line("M66,210 L134,210", C.plaidD, 2.6) + line("M78,199 L74,226 M92,199 L91,228 M108,199 L109,228 M122,199 L126,226", C.plaidD, 2) + line("M64,218 L136,218", C.plaidL, 1.4);
      s += neck();
      s += p(torsoD(204), C.navy);
      s += sideShade(204, C.navyS);
      s += shirtV(176) + lapels(C.navyHi, 176);
      s += circ(100, 188, 2.2, C.gold, { sw: 1.2 });
      s += p("M80,168 L90,168 L90,174 L80,174 Z", C.navyHi, { sw: 1.6 });
      // 빨간 리본
      s += p("M100,160 L86,152 L86,168 Z", C.red, { sw: 2.2 }) + p("M100,160 L114,152 L114,168 Z", C.red, { sw: 2.2 });
      s += p("M97,160 L92,176 L98,172 Z", C.redS, { sw: 1.8 }) + p("M103,160 L108,176 L102,172 Z", C.redS, { sw: 1.8 });
      s += circ(100, 160, 4, C.red, { sw: 2 });
      return s;
    },
    heldR: () => {
      let s = line("M140,200 L150,206", C.ol, 4.2);
      s += box(142, 204, 40, 32, 6, C.navy);
      s += p("M142,212 Q142,204 150,204 L174,204 Q182,204 182,212 L182,222 L142,222 Z", C.navyHi, { sw: 2.2 });
      s += box(158, 218, 8, 7, 1.5, C.gold, { sw: 1.4 });
      return s;
    },
    fx: () => {
      const bl = (x, y, r) => {
        let s = "";
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          s += circ(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, C.blossom, { sw: 1.3 });
        }
        return s + circ(x, y, r * 0.28, C.blossomD, { sw: 0 });
      };
      return bl(30, 160, 9) + bl(176, 96, 8) + bl(184, 160, 7) + bl(20, 206, 6);
    },
  },
  wizard: {
    sleeve: C.robe, cuff: C.gold, armW: 15,
    hideBun: true, noPencil: true,
    armL: [[56, 184], [43, 194]],
    armR: [[140, 186], [134, 202]],
    ground: () => snake(174, 248, 0.82, true),
    back: () => p("M76,152 Q50,170 38,246 Q100,254 162,246 Q150,170 124,152 Z", C.robeS),
    body() {
      let s = legs({ pants: C.robeS, shoe: C.shoe });
      s += neck();
      s += p("M78,151 Q66,153 62,170 L56,238 Q100,246 144,238 L138,170 Q134,153 122,151 Q100,146 78,151 Z", C.robe);
      s += S("M122,152 Q134,155 137,170 L143,236 Q134,240 126,240 Z", C.robeS, 0.7);
      s += p("M92,151 L100,240 L108,151 Q100,154 92,151 Z", C.robeHi, { sw: 2 });
      s += line("M92,152 L98,240 M108,152 L102,240", C.gold, 2.4);
      s += line("M58,236 Q100,244 142,236", C.gold, 3);
      s += p("M80,150 Q100,140 120,150 L124,158 Q100,152 76,158 Z", C.gold, { sw: 2 });
      s += star(74, 214, 3.4, C.yellow, { sw: 1.1 }) + star(128, 222, 3, C.yellow, { sw: 1.1 }) + star(122, 176, 2.6, C.yellow, { sw: 1 });
      return s;
    },
    heldL: () => {
      let s = limb("M48,246 L32,134", C.brown, 4.2);
      s += circ(30, 120, 15, C.orbL, { sw: 0, op: 0.7 });
      s += circ(30, 120, 10, C.orb);
      s += S("M25,116 Q27,112 31,112 Q27,115 27,119 Z", C.white);
      s += line("M21,128 Q30,138 39,128", C.gold, 3);
      return s;
    },
    heldR: () => {
      let s = p("M114,192 Q126,186 136,192 Q146,186 158,192 L158,214 Q146,208 136,214 Q126,208 114,214 Z", C.page);
      s += p("M112,196 L114,192 L114,214 Q126,208 136,214 Q146,208 158,214 L158,192 L160,196 L160,218 Q148,212 136,218 Q124,212 112,218 Z", C.navy, { sw: 2.2 });
      s += line("M136,192 L136,214", C.ol, 1.8);
      s += line("M118,197 L131,195 M118,202 L131,200 M141,195 L154,197", C.mapS, 1.4);
      s += snakeMark(147, 205, 0.55);
      return s;
    },
    hat: () => {
      let s = ell(100, 68, 74, 13, C.robe);
      s += p("M60,68 C66,44 84,22 108,10 C128,0 148,6 160,24 C146,16 132,18 126,30 C120,44 136,56 140,68 Q100,76 60,68 Z", C.robe);
      s += S("M70,62 C78,42 94,24 112,14 C100,28 90,44 86,64 Z", C.robeHi, 0.6);
      s += p("M61,58 Q100,68 139,58 L141,68 Q100,76 59,68 Z", C.gold, { sw: 2.2 });
      s += star(84, 40, 4.4, C.yellow) + star(116, 30, 3.4, C.yellow) + star(146, 16, 3, C.yellow) + star(46, 72, 3, C.yellow);
      s += snakeMark(104, 48, 0.75, C.tealHi);
      return s;
    },
    fx: () => sparkle(30, 92, 7) + sparkle(178, 96, 6) + sparkle(22, 180, 5) + sparkle(184, 150, 4, C.tealHi),
  },
  graduate: {
    sleeve: C.black, cuff: C.blackS, armW: 16,
    hideBun: true, noPencil: true,
    armL: [[58, 180], [62, 172]],
    body() {
      let s = legs({ pants: C.blackS, shoe: C.shoe });
      s += neck();
      s += p("M78,151 Q64,153 62,170 L58,232 Q100,240 142,232 L138,170 Q136,153 122,151 Q100,146 78,151 Z", C.black);
      s += S("M122,152 Q135,155 137,170 L141,230 Q134,234 126,234 Z", C.blackS, 0.8);
      s += p("M88,150 L100,166 L112,150 Q100,154 88,150 Z", C.shirt, { sw: 2 });
      // 청록 휘장(스톨)
      s += p("M80,152 L90,152 L94,214 L82,218 Z", C.teal) + p("M120,152 L110,152 L106,214 L118,218 Z", C.teal);
      s += line("M82,214 L94,210 M118,214 L106,210", C.gold, 2) + star(88, 176, 3.2, C.yellow, { sw: 1 }) + star(112, 176, 3.2, C.yellow, { sw: 1 });
      return s;
    },
    heldL: () => {
      let s = g("rotate(-38 58 172)", box(40, 164, 40, 13, 6.5, C.page) + ell(80, 170.5, 3.5, 6.5, C.page, { sw: 2 }) + box(55, 162, 6, 17, 1.5, C.red, { sw: 1.8 }));
      s += p("M60,180 L56,192 L62,188 L64,194 L66,180 Z", C.red, { sw: 1.6 });
      return s;
    },
    hat: () => {
      let s = p("M66,62 C66,44 80,38 100,38 C120,38 134,44 134,62 Q100,70 66,62 Z", C.black);
      s += p("M100,18 L160,36 L100,54 L40,36 Z", C.black);
      s += S("M100,22 L148,36 L100,50 Z", C.blackS, 0.6);
      s += circ(100, 36, 3, C.gold, { sw: 1.4 });
      s += line("M100,36 Q130,40 148,42 L150,72", C.gold, 2.6);
      s += p("M146,70 L154,70 L156,86 L144,86 Z", C.yellow, { sw: 1.8 });
      return s;
    },
    fx: () => sparkle(32, 80, 7) + sparkle(170, 110, 6) + star(176, 190, 4, C.yellow) + star(24, 210, 3.4, C.tealHi),
  },
};

// 팔: 어깨 → 팔꿈치 → 손. 끝에서 6만큼 앞에 소매 끝 줄
function arm(sh, mid, end, o) {
  const a = [sh, mid, end], w = o.armW ?? 12;
  const dx = end[0] - mid[0], dy = end[1] - mid[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const cx = end[0] - ux * 6.5, cy = end[1] - uy * 6.5, px = -uy * (w / 2 + 0.5), py = ux * (w / 2 + 0.5);
  let s = limb(pts(a), o.sleeve, w);
  if (o.stripe) s += line(pts(a), o.stripe, 2.2);
  if (o.cuff) s += line(`M${n(cx + px)},${n(cy + py)} L${n(cx - px)},${n(cy - py)}`, o.cuff, 3.2);
  return s;
}

// ---- 3. 얼굴 ----
const FACE_D = "M47,100 C47,66 72,54 100,54 C128,54 153,66 153,100 C153,131 130,148 100,148 C70,148 47,131 47,100 Z";
const headBase = () => ell(47, 113, 6, 8, C.skin) + ell(153, 113, 6, 8, C.skin) + S("M45,110 Q48,113 46,117", C.skinS) +
  p(FACE_D, C.skin);

// ---- 4. 표정 ----
const EYE_L = [78, 109], EYE_R = [122, 109];
function eyeOpen([x, y], o = {}) {
  const ry = o.ry ?? 13, rx = o.rx ?? 11, lx = o.lookX ?? 0, side = x < 100 ? -1 : 1, cx = x + lx;
  let s = ell(x, y, rx, ry, C.white, { sw: 0 });
  s += ell(cx, y + 0.4, rx - 0.6, ry - 0.6, C.eye, { sw: 1.2, stroke: C.eyeD });
  s += S(`M${n(cx - rx + 0.8)},${n(y + 1)} A${n(rx - 0.8)},${n(ry - 1)} 0 0 1 ${n(cx + rx - 0.8)},${n(y + 1)} Z`, C.eyeD, 0.8);
  s += ell(cx, y + 6.6, rx - 3.6, ry - 8.6, C.eyeL, { sw: 0, op: 0.95 });
  if (o.star) s += star(cx, y + 1.5, 7.4, C.yellow, { sw: 1.2 });
  else {
    s += ell(cx, y + 1.6, 4.6, 5.8, C.pupil, { sw: 0 });
    s += ell(cx - 3.8, y - 4.6, 3.8, 4.6, C.white, { sw: 0 }) + circ(cx + 4, y + 5, 2, C.white, { sw: 0 });
  }
  // 굵은 윗눈꺼풀(눈 위 테두리를 따라) + 바깥 속눈썹 하나
  const ex = rx + 1.6, ey = y - 3;
  s += p(`M${n(x - ex)},${ey} Q${x},${n(y - 2 * ry)} ${n(x + ex)},${ey} Q${x},${n(y - 1.62 * ry)} ${n(x - ex)},${ey} Z`, C.ol, { sw: 1.6 });
  s += line(`M${n(x + side * (ex - 0.6))},${ey - 1} l${side * 4.4},-3`, C.ol, 2.4);
  return s;
}
const eyeClosedHappy = ([x, y]) => line(`M${x - 9.5},${y + 3} Q${x},${y - 9} ${x + 9.5},${y + 3}`, C.ol, 3.6);
const eyeWink = ([x, y]) => line(`M${x - 9.5},${y} Q${x},${y + 6} ${x + 9.5},${y}`, C.ol, 3.6) + line(`M${x + 9.5},${y} l3.4,-2.6 M${x + 9},${y + 2} l3.6,0.8`, C.ol, 2.2);
const blush = (op = 0.75) => ell(66, 127, 10, 6.4, C.blush, { sw: 0, op }) + ell(134, 127, 10, 6.4, C.blush, { sw: 0, op });
const nose = () => line("M100,121 l-1.2,2", C.nose, 2);
const MY = 129;
const mouthSmile = () => line(`M94,${MY} Q100,${MY + 6} 106,${MY}`, C.ol, 2.6);
const mouthOpen = (w = 7, h = 6) =>
  p(`M${100 - w},${MY} Q100,${MY + h * 2} ${100 + w},${MY} Z`, C.mouth, { sw: 2.2 }) +
  S(`M${n(100 - w * 0.55)},${n(MY + h * 0.78)} Q100,${n(MY + h * 0.3)} ${n(100 + w * 0.55)},${n(MY + h * 0.78)} Q100,${n(MY + h * 1.08)} ${n(100 - w * 0.55)},${n(MY + h * 0.78)} Z`, C.tongue);
const brow = (x, y, tilt = 0, raise = 0) => line(`M${x - 6},${y - raise + tilt} Q${x},${y - raise - 2.6} ${x + 6},${y - raise - tilt}`, C.hairD, 2);

// 얼굴로 올린 왼팔(생각·응원). 앞머리 위에 그린다.
const raisedArm = (o, mid, end) => arm(SH_L, mid, end, o);
// top: 앞머리 위에 그릴 것(눈썹)
const FACES = {
  smile: () => ({ face: eyeOpen(EYE_L) + eyeOpen(EYE_R) + blush() + nose() + mouthOpen(9, 6.6), top: brow(78, 87) + brow(122, 87) }),
  joy: () => ({
    face: eyeClosedHappy(EYE_L) + eyeClosedHappy(EYE_R) + blush(0.85) + nose() + mouthOpen(9, 8),
    top: brow(78, 88, 0, 2) + brow(122, 88, 0, 2),
    fx: sparkle(38, 52, 6, C.tealHi) + sparkle(164, 44, 5, C.yellow),
  }),
  sparkle: () => ({
    face: eyeOpen(EYE_L, { star: true }) + eyeOpen(EYE_R, { star: true }) + blush(0.85) + nose() + mouthOpen(8, 7),
    top: brow(78, 88, 0, 3) + brow(122, 88, 0, 3),
    fx: sparkle(26, 104, 8) + sparkle(176, 82, 8) + sparkle(42, 44, 5, C.tealHi) + sparkle(170, 128, 5, C.tealHi),
  }),
  think: (o) => ({
    face: eyeOpen(EYE_L, { lookX: 2.6, ry: 11.5 }) + eyeOpen(EYE_R, { lookX: 2.6, ry: 11.5 }) + blush(0.55) + nose() + line(`M95,${MY + 2} Q101,${MY - 1} 107,${MY + 1}`, C.ol, 2.6),
    arm: raisedArm(o, [62, 184], [82, 146]) + hand(82, 144) + line("M78,140 Q82,138 86,140", C.nose, 1.6),
    top: brow(78, 90, 2) + brow(122, 87, -1, 4),
    fx: circ(162, 60, 2.6, C.blueL, { sw: 1.4 }) + circ(170, 50, 3.6, C.blueL, { sw: 1.4 }) + p("M174,28 q-2,-10 9,-10 q8,-6 14,2 q-1,8 -10,10 q-10,6 -13,-2 Z", C.sky, { sw: 1.8 }),
  }),
  surprise: () => ({
    face: eyeOpen(EYE_L, { rx: 10.8, ry: 13.2 }) + eyeOpen(EYE_R, { rx: 10.8, ry: 13.2 }) + blush(0.55) + nose() + ell(100, MY + 3, 4.6, 5.6, C.mouth, { sw: 2.2 }),
    top: brow(78, 87, 0, 5) + brow(122, 87, 0, 5),
    fx: p("M168,30 L178,30 L175,58 L171,58 Z", C.red, { sw: 2 }) + circ(173, 66, 3.6, C.red, { sw: 2 }),
  }),
  worry: () => ({
    face: eyeOpen(EYE_L, { ry: 11.5 }) + eyeOpen(EYE_R, { ry: 11.5 }) + blush(0.55) + nose() + line(`M91,${MY + 2} q3,-3 6,0 q3,3 6,0 q3,-3 6,0`, C.ol, 2.4),
    top: brow(78, 89, -3) + brow(122, 89, 3),
    fx: p("M156,72 Q164,86 160,92 Q154,96 151,90 Q150,84 156,72 Z", C.blueL, { sw: 2 }) + S("M154,86 Q154,82 156,80", C.white),
  }),
  cheer: (o) => ({
    face: eyeOpen(EYE_L, { ry: 12 }) + eyeOpen(EYE_R, { ry: 12 }) + blush(0.85) + nose() + mouthOpen(8, 7),
    arm: raisedArm(o, [50, 150], [44, 126]) + hand(44, 120, "fist", 8.4),
    top: brow(78, 90, 3) + brow(122, 90, -3),
    fx: line("M26,110 l-6,-5 M28,98 l-4,-8 M38,94 l0,-8", C.motion, 2.6),
  }),
  wink: () => ({
    face: eyeOpen(EYE_L) + eyeWink(EYE_R) + blush(0.85) + nose() + mouthOpen(7.5, 6.4),
    top: brow(78, 89, 0, 1) + brow(122, 90),
    fx: star(172, 70, 6, C.yellow) + sparkle(178, 90, 4, C.tealHi),
  }),
};

// ---- 5. 앞머리(청록 브릿지) ----
function frontHair() {
  // 앞머리 아래 이마 그림자
  let s = S("M52,100 Q54,86 62,80 Q76,74 88,92 Q96,74 104,68 Q116,74 128,92 Q138,82 148,94 Q150,80 140,70 Q120,58 100,58 Q72,58 58,74 Q50,86 52,100 Z", C.skinS, 0.55);
  // 옆머리: 왼쪽은 턱까지, 오른쪽은 어깨까지 내려와 바깥으로 뻗침
  s += p("M52,90 C44,106 43,128 49,144 Q51,151 46,156 Q57,155 60,145 Q63,128 61,108 Z", C.hair);
  s += p("M148,88 C158,108 158,138 153,154 Q151,161 157,167 Q144,166 141,154 Q137,134 139,108 Z", C.hair);
  // 앞머리: 가운데 이마가 보이고, 양옆으로 큰 가닥이 뾰족하게 내려옴
  s += p("M42,108 C38,60 66,38 100,38 C134,38 162,60 158,108 Q154,96 148,90 Q146,98 142,102 Q140,88 132,80 Q132,90 126,96 Q122,78 112,68 Q106,64 102,62 Q96,72 92,80 Q90,88 86,94 Q84,84 80,78 Q74,90 64,96 Q68,88 68,80 Q58,88 54,100 Q50,102 42,108 Z", C.hair);
  s += S("M58,62 Q74,46 96,43 Q80,50 68,66 Z", C.hairHi, 0.95);
  s += line("M76,56 Q86,62 90,74 M112,48 Q126,58 132,72", C.hairHi, 1.8);
  // 청록 브릿지: 정수리에서 오른쪽 앞머리를 따라
  s += p("M110,40 C128,44 148,58 153,84 Q150,90 148,96 Q146,84 140,76 Q134,62 122,52 Q116,46 110,40 Z", C.teal, { sw: 2 });
  s += line("M120,46 Q136,56 144,72", C.tealHi, 1.8);
  return s;
}

export const OUTFIT_KO = Object.freeze({
  basic: "기본복장", casual: "캐주얼룩", whitecoat: "화이트 코트", hoodie: "후드티", gym: "체육복",
  chef: "요리사 옷", explorer: "탐험가 옷", uniform: "교복", wizard: "마법사 망토", graduate: "졸업 가운",
});
export const FACE_KO = Object.freeze({
  smile: "미소", joy: "기쁨", sparkle: "반짝", think: "생각", surprise: "놀람", worry: "걱정", cheer: "응원", wink: "장난",
});

function clampSize(v) {
  const x = v === null || v === undefined || v === "" ? NaN : Number(v);
  if (!Number.isFinite(x) || x <= 0) return 160;
  return Math.min(2048, Math.max(1, x));
}

// class="ria"·g.ria-body·g.ria-fx는 화면 쪽 움직임(숨쉬기·폴짝·효과 깜빡임)을 거는 고리다
export function riaSVG(opts) {
  const { outfit = "basic", face = "smile", size = 160 } = opts ?? {};
  const oid = typeof outfit === "string" && Object.hasOwn(OUTFITS, outfit) ? outfit : "basic";
  const fid = typeof face === "string" && Object.hasOwn(FACES, face) ? face : "smile";
  const o = OUTFITS[oid];
  const ex = FACES[fid](o);
  const raised = fid === "think" || fid === "cheer";
  const sz = clampSize(size);
  const [mL, hL] = o.armL ?? DOWN_L, [mR, hR] = o.armR ?? DOWN_R;
  const parts = [
    ell(100, 249, 34, 4.5, C.shadow, { sw: 0, op: 0.12 }),
    o.back ? o.back() : "",
    o.ground ? o.ground() : "",
    backHair(o),
    o.body(),
    raised ? "" : arm(SH_L, mL, hL, o),
    arm(SH_R, mR, hR, o),
    !raised && o.heldL ? o.heldL() : "",
    raised ? "" : hand(hL[0], hL[1], o.handL),
    o.heldR ? o.heldR() : "",
    hand(hR[0], hR[1], o.handR),
    headBase(),
    ex.face,
    frontHair(),
    o.eyewear ? o.eyewear() : "",
    ex.top,
    o.hat ? o.hat() : "",
    ex.arm ?? "",
  ];
  const fx = (o.fx ? o.fx() : "") + (ex.fx ?? "");
  if (fx) parts.push(`<g class="ria-fx">${fx}</g>`);
  const label = `리아 교수, ${FACE_KO[fid]}, ${OUTFIT_KO[oid]}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ria" viewBox="0 0 ${W} ${H}" width="${n(sz)}" height="${n((sz * H) / W)}" role="img" aria-label="${label}"><title>${label}</title><g class="ria-body">${parts.join("")}</g></svg>`;
}
