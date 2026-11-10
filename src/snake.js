// 뱀 친구 「파이」 그림 (텃밭 판 위). #리아_이미지_세트1(art/ria_set1/ria_set1.js)에서 뱀만 옮겨 온 것 — v0.12.4
// 이미지 파일 없이 SVG 문자열로 그린다. 같은 입력이면 언제나 같은 문자열.
const C = {
  ol: "#3B2C35", white: "#FFFFFF", blush: "#FF8E94", mouth: "#A8323F", pupil: "#2E170B",
  green: "#78C95A", greenS: "#56A23C", greenB: "#CDEE98", yellow: "#FFD43B", gold: "#E2B04A", purple: "#7656C6",
};
const n = (v) => Math.round(v * 10) / 10;
function p(d, fill, o = {}) {
  const sw = o.sw ?? 2.6, st = o.stroke ?? (sw ? C.ol : "none");
  return `<path d="${d}" fill="${fill}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${o.op ? ` opacity="${o.op}"` : ""}/>`;
}
const S = (d, fill, op) => p(d, fill, { sw: 0, op });
function circ(x, y, r, fill, o = {}) {
  const sw = o.sw ?? 2.6;
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" stroke="${sw ? (o.stroke ?? C.ol) : "none"}" stroke-width="${sw}"${o.op ? ` opacity="${o.op}"` : ""}/>`;
}
function ell(x, y, rx, ry, fill, o = {}) {
  const sw = o.sw ?? 2.6;
  return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="${sw ? (o.stroke ?? C.ol) : "none"}" stroke-width="${sw}"${o.op ? ` opacity="${o.op}"` : ""}/>`;
}
const line = (d, color = C.ol, w = 2.6, op) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op ? ` opacity="${op}"` : ""}/>`;
const pts = (a) => "M" + a.map(([x, y]) => `${n(x)},${n(y)}`).join(" L");
function star(x, y, r, fill, o = {}) {
  const a = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    a.push([x + rr * Math.cos(ang), y + rr * Math.sin(ang)]);
  }
  return p(pts(a) + "Z", fill, { sw: o.sw ?? 1.8 });
}

export function snake(x, y, s = 1, hat = false) {
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
