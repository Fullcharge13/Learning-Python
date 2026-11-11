// 겹친 비동기 호출 중 마지막에 시작한 것만 「새것」으로 친다(v0.14.0, v0.13.4 검토 M2).
// 늦게 끝난 옛 호출의 결과는 { stale: true }로 돌려줘 쓰는 쪽이 버리게 한다.
export function latestOnly(fn) {
  let gen = 0;
  return async (...args) => {
    const mine = ++gen;
    const value = await fn(...args);
    return { stale: mine !== gen, value };
  };
}
