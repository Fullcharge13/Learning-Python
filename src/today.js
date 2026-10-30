// 기기 현지 날짜 (ledger 작업 2 메모: toLocaleDateString을 쓰지 않는다)
const pad = (n) => String(n).padStart(2, "0");

/** 현지 날짜 "YYYY-MM-DD" */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayIndex(d) {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** ISO 시각 문자열부터 지금까지 지난 현지 날짜 수. 값이 없거나 잘못되면 null */
export function daysSince(iso, now = new Date()) {
  if (typeof iso !== "string" || !iso) return null;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return null;
  return dayIndex(now) - dayIndex(t);
}
