// 작은 Web Audio 합성음 (설계서 6-6). 첫 사용자 손짓에서 AudioContext를 만든다.
// 사파리 16.4+는 audioSession.type = "ambient"로 아이폰 무음 스위치를 따른다.

const SONGS = {
  correct: [[988, 0, 0.12], [784, 0.11, 0.2]],          // 딩동
  combo: [[784, 0, 0.08], [988, 0.07, 0.08], [1319, 0.14, 0.18]],
  wrong: [[262, 0, 0.14, "triangle"], [220, 0.12, 0.2, "triangle"]],
  done: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]],
  buy: [[1319, 0, 0.07], [1760, 0.07, 0.2]],
  error: [[392, 0, 0.1, "triangle"], [330, 0.1, 0.16, "triangle"]],
  levelup: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.12], [1319, 0.38, 0.12], [1568, 0.5, 0.4]],
};

export function createSound(isOn) {
  let ctx = null;
  try {
    if (typeof navigator !== "undefined" && navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch { /* 지원 안 함 */ }

  // 소리가 꺼져 있으면 AudioContext를 만들지 않는다
  function unlock() {
    if (!isOn()) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch { ctx = null; }
  }
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  function play(name) {
    if (!isOn()) return;
    if (!ctx) unlock(); // 손짓 안에서 소리를 켠 직후(설정 스위치)
    if (!ctx || ctx.state !== "running") return;
    const notes = SONGS[name];
    if (!notes) return;
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, at, dur, type = "sine"] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.02);
    }
  }
  return { play, unlock };
}
