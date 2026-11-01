// 영구 저장 요청 (v0.6.2 나, 판정 C44): 브라우저가 공간이 모자랄 때 저장을 지우지 않도록 부탁한다.
// 앱을 열 때와 처음 진도를 저장한 뒤(계기마다 한 번) 부른다. 이미 영구 저장이거나 받아들여졌거나
// 지원하지 않으면 그 뒤로는 다시 묻지 않는다(거절·실패만 다음 계기에 한 번 더 묻는다).
// 결과는 어디에도 꼭 남기지 않는다. 막혀도·지원 안 해도 던지지 않고 앱을 멈추지 않는다.

/**
 * @param getNav () => navigator 같은 것 (시험에서 가짜를 넣음)
 * @returns () => Promise<"granted" | "denied" | "already" | "unsupported" | "error">
 */
export function createPersist(getNav = () => (typeof navigator !== "undefined" ? navigator : undefined)) {
  let once = null;
  async function ask() {
    let st;
    try { st = getNav()?.storage; } catch { return "unsupported"; }
    if (!st || typeof st.persist !== "function") return "unsupported";
    try {
      if (typeof st.persisted === "function" && (await st.persisted())) return "already";
    } catch { /* 모르면 그냥 요청해 본다 */ }
    try {
      return (await st.persist()) ? "granted" : "denied";
    } catch {
      return "error";
    }
  }
  return () => {
    if (!once) {
      once = ask().catch(() => "error");
      once.then((r) => { if (r === "denied" || r === "error") once = null; });
    }
    return once;
  };
}
