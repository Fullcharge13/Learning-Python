// 리아 교수(문리아) 그림 — 이미지 파일 없이 SVG 문자열로 그린다 (설계 6-5)
// 겹치는 순서: 뒷머리·올림머리 → 몸·의상 → 목·얼굴 → 표정 → 앞머리(청록 브릿지) → 표정 위 부품(눈썹·손) → 모자·소품
// 같은 입력이면 언제나 같은 문자열을 돌려준다. <defs>·id를 쓰지 않아 한 화면에 여러 장을 넣어도 충돌이 없다.

export const OUTFIT_IDS = Object.freeze(["basic", "lab", "detective", "chef", "painter", "gardener", "rain", "camping", "astronaut"]);
export const FACE_IDS = Object.freeze(["smile", "joy", "sparkle", "think", "surprise", "worry", "cheer", "wink"]);

const W = 200, H = 260;
const C = {
  ol: "#3B2C35", skin: "#FFE3CF", skinS: "#F5C6AC", blush: "#FF9C9C",
  hair: "#1F2B3D", hairHi: "#3C5170", teal: "#1FB0A3", tealHi: "#7BE3D6",
  eye: "#8A522C", eyeD: "#3E2416", white: "#FFFFFF",
  cream: "#FBF3E2", creamS: "#E9DBC0", char: "#4A4E5B", charS: "#393C47",
  pants: "#383B48", shoe: "#2B2932", yellow: "#FFD43B",
};

// ---- 작은 도우미 ----
const n = (v) => Math.round(v * 10) / 10;
function p(d, fill, o = {}) {
  const sw = o.sw ?? 2.6, st = o.stroke ?? (sw ? C.ol : "none");
  return `<path d="${d}" fill="${fill}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${o.op ? ` opacity="${o.op}"` : ""}/>`;
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
const line = (d, color = C.ol, w = 2.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// 팔·막대처럼 굵은 선: 바깥 테두리 + 안쪽 색
const limb = (d, color, w = 13) => line(d, C.ol, w + 5.2) + line(d, color, w);
const pts = (a) => "M" + a.map(([x, y]) => `${n(x)},${n(y)}`).join(" L");
function star(x, y, r, fill, o = {}) {
  const a = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    a.push([x + rr * Math.cos(ang), y + rr * Math.sin(ang)]);
  }
  return p(pts(a) + "Z", fill, { sw: o.sw ?? 1.8 });
}
const sparkle = (x, y, r, fill = C.yellow) =>
  p(`M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r}Z`, fill, { sw: 1.6 });
const hand = (x, y, r = 7.5, col = C.skin, sh = C.skinS) => circ(x, y, r, col) + S(`M${x - r + 2},${y + 1} A${r - 2},${r - 2} 0 0 0 ${x + r - 2},${y + 1} Z`, sh, 0.6);

// ---- 몸의 기본 치수 ----
const SH_L = [72, 156], SH_R = [128, 156];        // 어깨(팔 시작)
const HAND_L = [61, 206], HAND_R = [139, 206];      // 내린 손
const torsoD = (len, flare = 0) =>
  `M76,147 Q63,149 62,164 L${64 - flare},${len} Q100,${len + 7} ${136 + flare},${len} L138,164 Q137,149 124,147 Q100,141 76,147 Z`;

// ---- 1. 뒷머리·올림머리 ----
function backHair(o) {
  let s = "";
  if (o.hoodBack) s += o.hoodBack();
  if (!o.hideBun) {
    // 올림머리에 꽂은 연필
    if (!o.noPencil) {
      s += limb("M66,16 L134,38", C.yellow, 5.5);
      s += line("M66,16 L71,17.6", "#F49AA8", 5.5);
      s += p("M134,38 L143,42.6 L136,32.6 Z", "#F6D9B0", { sw: 1.8 });
    }
    // 헬멧 안에서는 올림머리를 조금 작고 낮게
    const k = o.smallBun ? 0.8 : 1, by = o.smallBun ? 33 : 27;
    s += `<g transform="translate(100 ${by}) scale(${k}) translate(-100 -27)">`;
    s += circ(100, 27, 22, C.hair);
    s += S("M86,16 Q96,8 110,11 Q100,12 92,20 Z", C.hairHi, 0.9);
    s += line("M88,34 Q96,22 112,26", C.hairHi, 2);
    s += line("M92,40 Q104,34 114,38", "#141C29", 1.6);
    s += "</g>";
  }
  s += p("M47,100 C42,58 68,37 100,37 C132,37 158,58 153,100 C152,104 150,106 147,106 L53,106 C50,106 48,104 47,100 Z", C.hair);
  return s;
}

// ---- 2. 몸·의상 ----
const legs = (pantsC = C.pants, shoeC = C.shoe, boot = false) => {
  let s = p("M82,208 L82,240 Q82,244 88,244 L94,244 Q98,244 98,240 L98,208 Z", pantsC);
  s += p("M102,208 L102,240 Q102,244 106,244 L112,244 Q118,244 118,240 L118,208 Z", pantsC);
  if (boot) {
    s += p("M80,226 L80,250 Q80,254 86,254 L100,254 Q102,250 99,246 L99,226 Z", shoeC);
    s += p("M101,226 L101,246 Q98,250 100,254 L114,254 Q120,254 120,250 L120,226 Z", shoeC);
    s += line("M80,232 L99,232 M101,232 L120,232", "#00000030", 2);
  } else {
    s += p("M79,247 Q79,240 89,240 Q99,240 99,247 Q99,252 94,252 L83,252 Q79,252 79,247 Z", shoeC);
    s += p("M101,247 Q101,240 111,240 Q121,240 121,247 Q121,252 117,252 L106,252 Q101,252 101,247 Z", shoeC);
  }
  return s;
};
const neckTurtle = (col = C.cream, sh = C.creamS) =>
  p("M86,134 L114,134 Q117,134 117,138 L117,149 Q100,153 83,149 L83,138 Q83,134 86,134 Z", col) +
  line("M90,138 L90,148 M96,138 L96,150 M104,138 L104,150 M110,138 L110,148", sh, 1.6);
const brooch = (x, y) =>
  line(`M${x - 6},${y + 6} Q${x - 9},${y - 1} ${x - 2},${y - 1} Q${x + 5},${y - 1} ${x + 3},${y - 7}`, C.ol, 5.8) +
  line(`M${x - 6},${y + 6} Q${x - 9},${y - 1} ${x - 2},${y - 1} Q${x + 5},${y - 1} ${x + 3},${y - 7}`, C.teal, 3.4) +
  circ(x + 3, y - 7.5, 2.6, C.yellow, { sw: 1.4 }) + circ(x - 4.4, y + 2, 1.1, C.yellow, { sw: 0 });
const pocketPen = (x, y, col) => p(`M${x},${y} l0,-9 l3,0 l0,9 Z`, col, { sw: 1.6 });

// 체크무늬: 몸통 사다리꼴 안에서만 선을 긋는다(clipPath 없이)
function checks(top, bot, colA, colB) {
  const half = (y) => 37 + ((y - top) / (bot - top)) * 1.5;
  let s = "";
  for (let y = top + 8; y < bot - 2; y += 11) s += line(`M${n(100 - half(y) + 3)},${y} L${n(100 + half(y) - 3)},${y}`, colA, 2);
  for (let x = 70; x <= 130; x += 11) s += line(`M${x},${top + 6} L${x},${bot - 3}`, colB, 2);
  return s;
}

const OUTFITS = {
  basic: {
    sleeve: C.char, cuff: C.cream,
    body() {
      let s = legs();
      s += neckTurtle();
      s += p(torsoD(214), C.char);
      s += S("M124,150 Q136,152 137,164 L135,212 Q128,214 122,214 Z", C.charS, 0.8);
      s += p("M86,148 L100,186 L114,148 Q100,152 86,148 Z", C.cream);
      s += p("M86,148 L77,160 L86,166 L80,172 L100,190 Z", C.charS);
      s += p("M114,148 L123,160 L114,166 L120,172 L100,190 Z", C.charS);
      s += circ(100, 200, 2.6, C.ol, { sw: 0 });
      s += brooch(119, 170);
      return s;
    },
  },
  lab: {
    sleeve: "#F8F8F5", cuff: C.cream,
    body() {
      let s = legs();
      s += neckTurtle();
      s += p(torsoD(230, 4), "#F8F8F5");
      s += S("M124,150 Q136,152 137,164 L139,228 Q132,231 124,232 Z", "#DDE3E8", 0.9);
      s += p("M86,148 L100,186 L114,148 Q100,152 86,148 Z", C.cream);
      s += line("M100,186 L100,233", C.ol, 2.2);
      s += p("M86,148 L76,162 L86,168 L80,174 L100,190 Z", "#ECEFF2");
      s += p("M114,148 L124,162 L114,168 L120,174 L100,190 Z", "#ECEFF2");
      s += p("M108,176 L124,176 L124,188 L108,188 Z", "#ECEFF2", { sw: 2 });
      s += pocketPen(112, 177, C.teal) + pocketPen(117, 177, "#E8584F");
      s += p("M76,210 L90,210 L90,220 L76,220 Z", "#ECEFF2", { sw: 2 });
      s += brooch(88, 172);
      return s;
    },
    prop() {
      // 커피 머그와 김
      let s = line("M150,178 q-4,-6 0,-11 q4,-5 0,-11", "#B9B2AA", 2.2) + line("M158,180 q-4,-6 0,-11 q4,-5 0,-11", "#B9B2AA", 2.2);
      s += p("M157,193 q10,0 10,8 q0,8 -10,8", "none", { sw: 5.6 }) + line("M157,193 q10,0 10,8 q0,8 -10,8", C.cream, 3);
      s += p("M139,186 L159,186 L157,212 Q149,216 141,212 Z", C.teal);
      s += ell(149, 186, 10, 3, "#6B4129", { sw: 1.8 });
      s += line("M144,196 L154,196", C.tealHi, 2.4);
      return s;
    },
    propUnderHand: true,
  },
  detective: {
    hideBun: true,
    sleeve: "#9C6B44", cuff: "#7D5434",
    body() {
      let s = legs();
      s += neckTurtle();
      s += p(torsoD(228, 3), "#9C6B44");
      s += checks(150, 226, "#C4935F", "#7D5434");
      s += S("M124,150 Q136,152 137,164 L139,226 Q132,229 124,230 Z", "#6E4A2E", 0.45);
      s += p("M86,148 L100,180 L114,148 Q100,152 86,148 Z", C.cream);
      // 망토 깃(인버네스 코트)
      s += p("M76,147 Q100,141 124,147 Q140,152 142,170 Q122,182 100,180 Q78,182 58,170 Q60,152 76,147 Z", "#A8774D");
      s += line("M66,166 Q82,174 100,172 Q118,174 134,166", "#7D5434", 2);
      s += p("M88,147 L100,170 L112,147 Q100,151 88,147 Z", C.cream);
      s += circ(100, 190, 2.5, "#3E2A1C", { sw: 0 }) + circ(100, 206, 2.5, "#3E2A1C", { sw: 0 });
      s += brooch(118, 159);
      return s;
    },
    prop() {
      let s = limb("M141,204 L152,186", "#5A3A26", 5);
      s += circ(159, 172, 15, "#D9F1F5", { op: 1, sw: 0 });
      s += circ(159, 172, 15, "none", { sw: 6.8 }) + circ(159, 172, 15, "none", { sw: 4, stroke: "#C9A13E" });
      s += S("M151,166 Q155,160 162,160 Q156,163 154,169 Z", C.white, 0.95);
      return s;
    },
  },
  chef: {
    hideBun: true,
    sleeve: "#FBFBF8", cuff: "#E9EDF0",
    body() {
      let s = legs("#3D3F4D");
      s += p("M86,134 L114,134 Q117,134 117,138 L117,149 Q100,153 83,149 L83,138 Q83,134 86,134 Z", "#FBFBF8");
      s += p(torsoD(214), "#FBFBF8");
      s += S("M124,150 Q136,152 137,164 L135,212 Q128,214 122,214 Z", "#DDE3E8", 0.9);
      // 스카프
      s += p("M88,146 Q100,154 112,146 L110,154 Q100,160 90,154 Z", "#E8584F");
      s += p("M98,156 L94,170 L102,166 L106,172 L104,156 Z", "#E8584F", { sw: 2 });
      // 단추 두 줄
      for (const y of [168, 182, 196]) s += circ(90, y, 2.4, "#C7CCD2", { sw: 1.4 }) + circ(110, y, 2.4, "#C7CCD2", { sw: 1.4 });
      // 앞치마
      s += p("M76,190 L124,190 L128,232 Q100,238 72,232 Z", "#7FB7C9");
      s += line("M78,197 L122,197", "#5E97AA", 2);
      s += p("M92,208 L108,208 L108,220 L92,220 Z", "#6FA6B8", { sw: 1.8 });
      return s;
    },
    prop() {
      // 나무 국자(주걱)
      let s = limb("M140,212 L156,168", "#C9925A", 4.5);
      s += ell(159, 160, 7, 10, "#C9925A", { rot: 20 });
      s += S("M156,154 Q160,152 162,156 Q159,156 157,160 Z", "#E8B984");
      return s;
    },
    propUnderHand: true,
  },
  painter: {
    sleeve: "#F4F0E6", cuff: "#2F4A7A",
    body() {
      let s = legs("#4A5068");
      s += neckTurtle("#F4F0E6", "#2F4A7A");
      s += p(torsoD(214), "#F4F0E6");
      for (let y = 158; y < 212; y += 9) s += line(`M66,${y} L134,${y}`, "#2F4A7A", 3.4);
      s += p(torsoD(214), "none");
      // 물감 묻은 앞치마
      s += p("M84,150 L116,150 L118,170 L128,176 L130,230 Q100,236 70,230 L72,176 L82,170 Z", "#E8D8B6");
      s += line("M84,150 L80,140 M116,150 L120,140", C.ol, 2.2);
      s += circ(88, 186, 4, "#E8584F", { sw: 0 }) + circ(110, 198, 3.4, "#3D8BE0", { sw: 0 }) + circ(96, 214, 4.2, C.yellow, { sw: 0 });
      s += circ(116, 178, 2.6, C.teal, { sw: 0 }) + circ(80, 208, 2.6, "#9B5BD6", { sw: 0 }) + circ(118, 220, 2.2, "#E8584F", { sw: 0 });
      s += p("M92,192 L108,192 L108,204 L92,204 Z", "none", { sw: 1.8 });
      s += pocketPen(96, 193, "#E8584F") + pocketPen(101, 193, "#3D8BE0");
      return s;
    },
    prop() {
      let s = p("M136,182 Q150,170 168,176 Q180,182 176,196 Q172,206 164,202 Q158,198 154,204 Q146,212 136,204 Q128,194 136,182 Z", "#E2B47B");
      s += circ(147, 184, 3.6, "#E8584F", { sw: 1.4 }) + circ(158, 181, 3.6, C.yellow, { sw: 1.4 }) + circ(168, 188, 3.6, "#3D8BE0", { sw: 1.4 }) + circ(166, 197, 3.2, C.teal, { sw: 1.4 });
      s += ell(152, 197, 3.2, 2.6, "#F6E0BE", { sw: 1.6 });
      return s;
    },
  },
  gardener: {
    hideBun: true,
    sleeve: "#F6E7B8", cuff: "#E8D290",
    body() {
      let s = legs("#4C78B0", "#6B4A2E");
      s += p("M86,134 L114,134 Q117,134 117,138 L117,149 Q100,153 83,149 L83,138 Q83,134 86,134 Z", "#F6E7B8");
      s += p(torsoD(214), "#F6E7B8");
      s += line("M66,172 L134,172 M66,192 L134,192 M88,150 L88,214 M112,150 L112,214", "#E8D290", 2);
      s += p("M86,147 L100,158 L114,147 Q100,151 86,147 Z", "#F6E7B8", { sw: 2 });
      // 멜빵바지
      s += p("M80,176 L120,176 L122,200 L132,214 Q100,220 68,214 L78,200 Z", "#4C78B0");
      s += p("M80,176 L76,150 L84,148 L88,176 Z", "#4C78B0", { sw: 2.2 }) + p("M120,176 L124,150 L116,148 L112,176 Z", "#4C78B0", { sw: 2.2 });
      s += circ(84, 178, 2.4, C.yellow, { sw: 1.4 }) + circ(116, 178, 2.4, C.yellow, { sw: 1.4 });
      s += p("M92,184 L108,184 L108,196 L92,196 Z", "#5B88C0", { sw: 1.8 });
      s += line("M93,189 L107,189", "#F6E7B8", 1.4);
      s += p("M97,182 Q92,172 98,170 Q100,176 99,182 Z", "#5CC06A", { sw: 1.4 });
      return s;
    },
    prop() {
      // 물뿌리개: 손잡이를 잡고 옆에 든다
      let s = p("M146,206 L172,206 L170,232 Q159,236 148,232 Z", C.teal);
      s += line("M171,214 L186,198", C.ol, 8) + line("M171,214 L186,198", C.teal, 4.2);
      s += ell(188, 196, 4, 2.6, C.tealHi, { rot: -45, sw: 1.8 });
      s += line("M146,212 Q138,198 150,196 Q164,194 166,206", C.ol, 6.4) + line("M146,212 Q138,198 150,196 Q164,194 166,206", "#178C82", 3);
      s += line("M152,218 L166,218", C.tealHi, 2.4);
      s += line("M190,204 l1,4 M186,206 l0,4 M193,200 l2,3", "#6FB8F0", 2);
      return s;
    },
    propUnderHand: true,
  },
  rain: {
    sleeve: "#FFCF33", cuff: "#F2B70E",
    body() {
      let s = legs(C.pants, "#FFCF33", true);
      s += p(torsoD(228, 4), "#FFCF33");
      s += S("M124,150 Q136,152 137,164 L139,226 Q132,229 124,230 Z", "#F2B70E", 0.9);
      s += line("M100,150 L100,230", C.ol, 2.2);
      for (const y of [168, 186, 204]) s += p(`M104,${y - 2} L112,${y - 2} L112,${y + 2} L104,${y + 2} Z`, "#C98A1E", { sw: 1.6 });
      s += p("M76,206 L92,206 L92,214 L76,214 Z", "#F2B70E", { sw: 1.8 });
      s += p("M86,146 Q100,156 114,146 Q118,150 116,154 Q100,162 84,154 Q82,150 86,146 Z", "#FFCF33");
      s += brooch(118, 178);
      return s;
    },
    hoodBack: () => p("M36,104 C30,48 66,6 100,6 C134,6 170,48 164,104 C162,128 150,142 138,146 L62,146 C50,142 38,128 36,104 Z", "#F2B70E"),
    fx() {
      // 빗방울 몇 개
      const drop = (x, y) => p(`M${x},${y - 7} Q${x + 5},${y} ${x},${y + 4} Q${x - 5},${y} ${x},${y - 7} Z`, "#8FD0F5", { sw: 1.6 });
      return drop(178, 128) + drop(22, 160) + drop(170, 178) + drop(30, 120);
    },
    hideBun: true,
  },
  camping: {
    sleeve: "#FF8A3D", cuff: "#E06A20",
    body() {
      let s = legs("#55603F", "#6B4A2E", true);
      s += p(torsoD(216, 3), "#FF8A3D");
      s += line("M66,168 Q100,173 134,168 M66,186 Q100,191 134,186 M66,204 Q100,209 134,204", "#E06A20", 2.4);
      s += S("M124,150 Q136,152 138,164 L138,214 Q132,217 124,218 Z", "#E06A20", 0.6);
      s += line("M100,150 L100,218", C.ol, 2.2) + p("M98,154 L102,154 L102,162 L98,162 Z", "#C9CDD3", { sw: 1.4 });
      s += p("M84,140 L116,140 Q120,140 120,146 L118,154 Q100,160 82,154 L80,146 Q80,140 84,140 Z", "#FF8A3D");
      s += brooch(117, 176);
      return s;
    },
    prop() {
      let s = limb("M140,208 L178,150", "#8A5A34", 3.2);
      s += p("M171,148 L181,141 L188,151 L178,158 Z", "#FFF5E8", { sw: 2.2 });
      s += S("M179,156 L187,150 L188,151 L178,158 Z", "#D9A066");
      return s;
    },
    propUnderHand: true,
    hideBun: true,
  },
  astronaut: {
    sleeve: "#F1F3F6", cuff: "#9AA5B4",
    body() {
      let s = legs("#F1F3F6", "#9AA5B4", true);
      s += p(torsoD(218, 3), "#F1F3F6");
      s += S("M124,150 Q136,152 138,164 L138,216 Q132,219 124,220 Z", "#D3DAE3", 0.9);
      s += p("M84,166 L116,166 Q118,166 118,168 L118,188 Q118,190 116,190 L84,190 Q82,190 82,188 L82,168 Q82,166 84,166 Z", "#C9D2DE", { sw: 2.2 });
      s += circ(90, 174, 3, "#E8584F", { sw: 1.4 }) + circ(100, 174, 3, C.yellow, { sw: 1.4 }) + circ(110, 174, 3, C.teal, { sw: 1.4 });
      s += line("M88,183 L112,183", "#7F8C9C", 2);
      s += line("M66,204 Q100,212 134,204", "#9AA5B4", 4);
      // 목 고리
      s += p("M78,142 Q100,134 122,142 L124,152 Q100,160 76,152 Z", "#9AA5B4");
      s += star(127, 160, 4.6, C.yellow);
      return s;
    },
    helmet: true,
    noPencil: true,
    smallBun: true,
    glove: "#E4EAF1", gloveS: "#AEB8C6",
  },
};

function arms(o, raisedLeft) {
  let s = "";
  if (!raisedLeft) s += limb(pts([SH_L, [64, 182], [HAND_L[0], HAND_L[1] - 6]]), o.sleeve, 13) + line(`M${HAND_L[0] - 5},${HAND_L[1] - 8} L${HAND_L[0] + 6},${HAND_L[1] - 6}`, o.cuff, 3.4);
  s += limb(pts([SH_R, [136, 182], [HAND_R[0], HAND_R[1] - 6]]), o.sleeve, 13) + line(`M${HAND_R[0] - 6},${HAND_R[1] - 6} L${HAND_R[0] + 5},${HAND_R[1] - 8}`, o.cuff, 3.4);
  return s;
}

// ---- 3. 목·얼굴 ----
const FACE_D = "M52,90 C52,58 74,46 100,46 C126,46 148,58 148,90 C148,118 128,137 100,137 C72,137 52,118 52,90 Z";
function headBase() {
  let s = p("M93,126 L107,126 L107,142 Q100,146 93,142 Z", C.skinS);
  s += ell(52, 100, 7, 9.5, C.skin) + ell(148, 100, 7, 9.5, C.skin);
  s += S("M50,96 Q53,99 51,104", C.skinS) + circ(52, 111, 2.4, C.teal, { sw: 1.2 }) + circ(148, 111, 2.4, C.teal, { sw: 1.2 });
  s += p(FACE_D, C.skin);
  return s;
}

// ---- 4. 표정 ----
const EYE_L = [80, 100], EYE_R = [120, 100];
function eyeOpen([x, y], o = {}) {
  const ry = o.ry ?? 11, rx = o.rx ?? 8.6, lookX = o.lookX ?? 0, side = x < 100 ? -1 : 1;
  let s = ell(x, y, rx, ry, C.white, { sw: 0 });
  s += ell(x + lookX, y + 1, rx - 1.2, ry - 1, C.eye, { sw: 0 });
  s += S(`M${x + lookX - rx + 1.2},${y - 1} A${rx - 1.2},${ry - 2} 0 0 1 ${x + lookX + rx - 1.2},${y - 1} Z`, C.eyeD);
  if (o.star) s += star(x + lookX, y + 2, 6.4, C.yellow, { sw: 1.2 });
  else {
    s += ell(x + lookX, y + 2.5, 3.6, 4.6, C.eyeD, { sw: 0 });
    s += ell(x + lookX - 3, y - 3.5, 3, 3.6, C.white, { sw: 0 }) + circ(x + lookX + 3, y + 5.5, 1.6, C.white, { sw: 0 });
  }
  // 위 속눈썹 선과 바깥 끝 살짝 올림
  s += line(`M${x - rx - 1},${y - ry + 4} Q${x},${y - ry - 3.6} ${x + rx + 1},${y - ry + 4}`, C.ol, 3.4);
  s += line(`M${x + side * (rx + 0.5)},${y - ry + 3.5} l${side * 3.5},-2.6`, C.ol, 2.6);
  s += line(`M${x - rx + 2.5},${y + ry - 0.6} Q${x},${y + ry + 1.4} ${x + rx - 2.5},${y + ry - 0.6}`, C.eyeD, 1.4);
  return s;
}
const eyeClosedHappy = ([x, y]) => line(`M${x - 8.5},${y + 3} Q${x},${y - 8} ${x + 8.5},${y + 3}`, C.ol, 3.4);
const eyeWink = ([x, y]) => line(`M${x - 8.5},${y + 1} Q${x},${y + 6} ${x + 8.5},${y + 1}`, C.ol, 3.4) + line(`M${x + 8.5},${y + 1} l3,-2.4`, C.ol, 2.4);
const blush = (op = 0.55) => ell(70, 116, 9, 5, C.blush, { sw: 0, op }) + ell(130, 116, 9, 5, C.blush, { sw: 0, op });
const nose = () => line("M100,111 l-1.2,2.2", "#E3A588", 2);
const mouthSmile = () => line("M93,120 Q100,126 107,120", C.ol, 2.6);
const mouthOpen = (w = 9, h = 9) =>
  p(`M${100 - w},119 Q100,${119 + h * 2} ${100 + w},119 Z`, "#B4383F", { sw: 2.4 }) +
  S(`M${100 - w * 0.5},${119 + h * 0.75} Q100,${119 + h * 0.3} ${100 + w * 0.5},${119 + h * 0.75} Q100,${119 + h * 1.1} ${100 - w * 0.5},${119 + h * 0.75} Z`, "#F58A8F");
const brow = (x, y, tilt = 0, raise = 0) => line(`M${x - 7},${y - raise + tilt} Q${x},${y - raise - 3} ${x + 7},${y - raise - tilt}`, "#2A2030", 2.6);

// 앞머리 위에 그려야 하는 것(눈썹·손·땀 등)은 top에 담는다
const FACES = {
  smile: () => ({ face: eyeOpen(EYE_L) + eyeOpen(EYE_R) + blush() + nose() + mouthSmile(), top: brow(80, 82, 0) + brow(120, 82, 0) }),
  joy: () => ({
    face: eyeClosedHappy(EYE_L) + eyeClosedHappy(EYE_R) + blush(0.75) + nose() + mouthOpen(10, 9),
    top: brow(80, 81, 0, 2) + brow(120, 81, 0, 2) ,
    fx: sparkle(40, 70, 6, C.tealHi) + sparkle(164, 66, 5, C.yellow),
  }),
  sparkle: () => ({
    face: eyeOpen(EYE_L, { star: true }) + eyeOpen(EYE_R, { star: true }) + blush(0.7) + nose() + mouthOpen(8, 7),
    top: brow(80, 81, 0, 3) + brow(120, 81, 0, 3) ,
    fx: sparkle(30, 84, 8) + sparkle(172, 70, 9) + sparkle(44, 52, 5, C.tealHi) + sparkle(162, 118, 5, C.tealHi),
  }),
  think: (o) => ({
    face: eyeOpen(EYE_L, { lookX: 3, ry: 10 }) + eyeOpen(EYE_R, { lookX: 3, ry: 10 }) + blush(0.4) + nose() + line("M95,122 Q101,119 107,121", C.ol, 2.6),
    arm: limb(pts([SH_L, [60, 178], [80, 140]]), o.sleeve, 13) + line("M73,147 L84,152", o.cuff, 3.4) + hand(84, 137, 8, o.glove, o.gloveS) + line("M80,133 Q84,131 88,133", o.gloveS ?? "#E3A588", 1.6),
    top: brow(80, 83, 2) + brow(120, 80, -1, 4),
    fx: circ(160, 64, 2.6, "#AFC3D6", { sw: 1.4 }) + circ(168, 54, 3.6, "#AFC3D6", { sw: 1.4 }) + p("M176,30 q-2,-10 9,-10 q8,-6 14,2 q-1,8 -10,10 q-10,6 -13,-2 Z", "#E4EDF5", { sw: 1.8 }),
  }),
  surprise: () => ({
    face: eyeOpen(EYE_L, { rx: 9, ry: 11.5 }) + eyeOpen(EYE_R, { rx: 9, ry: 11.5 }) + blush(0.45) + nose() + ell(100, 124, 4.5, 5.5, "#B4383F", { sw: 2.4 }),
    top: brow(80, 80, 0, 5) + brow(120, 80, 0, 5) ,
    fx: p("M166,34 L176,34 L173,62 L169,62 Z", "#FF6B5B", { sw: 2 }) + circ(171, 70, 3.6, "#FF6B5B", { sw: 2 }),
  }),
  worry: () => ({
    face: eyeOpen(EYE_L, { ry: 10 }) + eyeOpen(EYE_R, { ry: 10 }) + blush(0.4) + nose() + line("M91,123 q3,-3 6,0 q3,3 6,0 q3,-3 6,0", C.ol, 2.4),
    top: brow(80, 82, -3) + brow(120, 82, 3) ,
    fx: p("M152,70 Q160,84 156,90 Q150,94 147,88 Q146,82 152,70 Z", "#9FD8F7", { sw: 2 }) + S("M150,84 Q150,80 152,78", C.white),
  }),
  cheer: (o) => ({
    face: eyeOpen(EYE_L, { ry: 10.5 }) + eyeOpen(EYE_R, { ry: 10.5 }) + blush(0.65) + nose() + mouthOpen(9, 8),
    arm: limb(pts([SH_L, [46, 156], [40, 128]]), o.sleeve, 13) + line("M35,135 L46,136", o.cuff, 3.4) +
      circ(40, 121, 9, o.glove ?? C.skin) + line("M33,118 L47,118 M34,123 L46,123", o.gloveS ?? "#E3A588", 1.6),
    top: brow(80, 83, 3) + brow(120, 83, -3),
    fx: line("M24,108 l-6,-5 M28,98 l-3,-8 M38,96 l1,-8", "#FF8A3D", 2.6),
  }),
  wink: () => ({
    face: eyeOpen(EYE_L) + eyeWink(EYE_R) + blush(0.65) + nose() + p("M93,119 Q100,127 107,119 Z", "#B4383F", { sw: 2.2 }) + S("M98,121 L104,121 L103,125 Q100,127 98,124 Z", "#F58A8F"),
    top: brow(80, 82, 0, 1) + brow(120, 83, 0, 0) ,
    fx: star(146, 76, 6, C.yellow) + sparkle(160, 92, 4, C.tealHi),
  }),
};

// ---- 5. 앞머리(청록 브릿지) ----
function frontHair() {
  // 앞머리 아래 이마 그림자
  let s = S("M56,98 Q57,86 62,78 Q70,68 80,62 Q94,68 104,80 Q108,76 108,70 Q124,76 134,90 Q138,84 139,76 Q148,86 148,96 Q146,62 100,54 Q58,60 56,98 Z", C.skinS, 0.7);
  // 옆으로 흘러내린 가닥
  s += p("M53,82 C46,98 46,116 51,128 Q53,134 58,135 Q55,128 56,118 C57,106 59,96 60,90 Z", C.hair);
  s += p("M147,82 C154,98 154,116 149,128 Q147,134 142,135 Q145,128 144,118 C143,106 141,96 140,90 Z", C.hair);
  // 앞머리: 왼쪽 가르마에서 오른쪽으로 쓸어 넘김
  s += p("M47,96 C42,58 66,37 100,37 C134,37 158,58 153,96 Q150,80 138,70 Q138,78 134,84 Q124,70 108,64 Q108,70 104,74 Q94,62 80,56 Q70,62 62,72 Q58,80 56,90 Q52,92 47,96 Z", C.hair);
  s += S("M62,52 Q78,42 98,41 Q84,46 72,56 Z", C.hairHi, 0.95);
  s += line("M84,47 Q98,54 108,62 M100,43 Q118,50 132,66", C.hairHi, 1.8);
  // 청록 브릿지 한 줄
  s += p("M116,40 C134,45 148,58 151,80 Q146,74 140,70 Q132,58 116,40 Z", C.teal, { sw: 1.8 });
  s += line("M124,45 Q138,54 145,68", C.tealHi, 1.6);
  return s;
}

// ---- 6. 모자·소품 ----
const HATS = {
  detective: () => {
    let s = p("M50,74 C48,38 72,24 100,24 C128,24 152,38 150,74 Q100,64 50,74 Z", "#9C6B44");
    s += line("M62,40 Q100,26 138,40 M54,56 Q100,42 146,56 M78,30 L72,72 M100,24 L100,66 M122,30 L128,72", "#7D5434", 1.8);
    s += p("M64,70 Q100,62 136,70 Q132,82 100,80 Q68,82 64,70 Z", "#8A5C38");
    s += p("M90,26 Q100,14 110,26 Q100,30 90,26 Z", "#7D5434", { sw: 2 });
    return s;
  },
  chef: () => {
    let s = p("M60,54 C42,50 40,22 62,20 C66,2 92,-2 100,10 C110,-2 136,2 138,20 C160,22 158,50 140,54 Z", "#FFFFFF");
    s += line("M82,26 Q86,40 84,52 M118,26 Q114,40 116,52", "#D7DDE3", 2);
    s += p("M58,50 L142,50 Q144,50 144,54 L144,66 Q100,62 56,66 L56,54 Q56,50 58,50 Z", "#FFFFFF");
    s += S("M60,60 L140,60 L140,64 Q100,60 60,64 Z", "#DCE2E7");
    return s;
  },
  painter: () => {
    let s = ell(90, 46, 48, 17, "#D9414A", { rot: -14 });
    s += S("M60,52 Q90,36 128,34 Q100,44 66,58 Z", "#F06A72", 0.8);
    s += p("M86,24 L89,16 L93,24 Z", "#D9414A", { sw: 2 });
    return s;
  },
  gardener: () => {
    let s = ell(100, 62, 76, 15, "#F2D48A");
    s += line("M36,62 Q100,82 164,62", "#D9B464", 1.8);
    s += p("M66,62 C64,34 80,22 100,22 C120,22 136,34 134,62 Q100,70 66,62 Z", "#F2D48A");
    s += line("M74,40 Q100,30 126,40 M70,50 Q100,42 130,50", "#D9B464", 1.8);
    s += p("M67,54 Q100,62 133,54 L134,62 Q100,70 66,62 Z", C.teal, { sw: 2 });
    s += p("M118,60 L128,72 L122,74 L114,62 Z", C.teal, { sw: 1.8 });
    return s;
  },
  rain: () =>
    p("M36,104 C30,48 66,6 100,6 C134,6 170,48 164,104 C162,124 154,138 146,144 L140,132 C150,120 154,108 154,96 C154,60 128,30 100,30 C72,30 46,60 46,96 C46,108 50,120 60,132 L54,144 C46,138 38,124 36,104 Z", "#FFCF33") +
    line("M50,60 Q100,10 150,60", "#F2B70E", 2),
  camping: () => {
    let s = p("M52,70 C50,34 72,20 100,20 C128,20 150,34 148,70 Z", "#2E9E8F");
    for (let x = 64; x <= 136; x += 9) s += line(`M${x},${x < 100 ? 30 + (100 - x) * 0.15 : 30 + (x - 100) * 0.15} L${x},64`, "#23857A", 2);
    s += p("M50,62 Q100,54 150,62 L151,76 Q100,68 49,76 Z", "#3FB8A8");
    for (let x = 56; x <= 146; x += 6) s += line(`M${x},${64} L${x},${72}`, "#2E9E8F", 1.6);
    s += circ(100, 17, 10, "#FFF5E8");
    s += S("M94,12 Q98,8 102,10 Q98,12 96,16 Z", C.white);
    return s;
  },
};

function helmet() {
  let s = circ(100, 82, 79, "#DDF0FF", { sw: 0, op: 0.12 });
  s += circ(100, 82, 79, "none", { sw: 7.6 }) + circ(100, 82, 79, "none", { sw: 4, stroke: "#E4EAF1" });
  s += S("M44,62 Q52,26 92,14 Q62,30 52,70 Z", C.white, 0.85);
  s += circ(150, 30, 4, C.white, { sw: 0, op: 0.85 });
  s += line("M150,140 Q160,124 166,108", C.white, 3);
  return s;
}

export const OUTFIT_KO = Object.freeze({
  basic: "기본 재킷", lab: "연구실 가운", detective: "탐정 코트", chef: "요리사 옷", painter: "화가 앞치마",
  gardener: "정원사 옷", rain: "노란 우비", camping: "캠핑 패딩", astronaut: "우주복",
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
  const parts = [
    backHair(o),
    o.body(),
    arms(o, raised),
    o.prop && o.propUnderHand ? o.prop() : "",
    hand(HAND_R[0], HAND_R[1], 7.5, o.glove, o.gloveS),
    raised ? "" : hand(HAND_L[0], HAND_L[1], 7.5, o.glove, o.gloveS),
    o.prop && !o.propUnderHand ? o.prop() : "",
    headBase(),
    ex.face,
    frontHair(),
    ex.top,
    HATS[oid] ? HATS[oid]() : "",
    o.helmet ? helmet() : "",
    ex.arm ?? "",
  ];
  const fx = (o.fx ? o.fx() : "") + (ex.fx ?? "");
  if (fx) parts.push(`<g class="ria-fx">${fx}</g>`);
  const label = `리아 교수, ${FACE_KO[fid]}, ${OUTFIT_KO[oid]}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ria" viewBox="0 0 ${W} ${H}" width="${n(sz)}" height="${n((sz * H) / W)}" role="img" aria-label="${label}"><title>${label}</title><g class="ria-body">${parts.join("")}</g></svg>`;
}
