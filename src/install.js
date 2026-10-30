// 「홈 화면에 추가」 안내를 보일지 정하는 순수 함수 (판정 C29, 설계서 7장 아이폰 대응)
// 사파리 웹사이트 상태로는 7일 동안 열지 않으면 저장이 지워질 수 있어서, 아이폰·아이패드에서만 안내한다.
// - 사파리: 홈 화면에 추가하는 3단계 안내("safari")
// - 앱 안 브라우저(카카오톡·네이버·인스타그램·페이스북·라인): 사파리로 열라는 짧은 안내("inapp")
// - iOS용 크롬·파이어폭스·엣지와 그 밖의 기기: 안내 없음

export const INSTALL_HINT_KEY = "ria-python.installHint";

const IN_APP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|\bLine\//;
const OTHER_BROWSER = /CriOS|FxiOS|EdgiOS/;

/** 아이폰·아이패드인지. iPadOS 사파리는 Macintosh UA를 쓰므로 터치 지점 수로 가린다 */
export function isIOS(ua, maxTouchPoints = 0) {
  const s = String(ua || "");
  return /iP(hone|ad|od)/.test(s) || (/Macintosh/.test(s) && Number(maxTouchPoints) > 1);
}

export function isInAppBrowser(ua) {
  return IN_APP.test(String(ua || ""));
}

/** 아이폰·아이패드의 사파리인지 (iOS용 다른 브라우저·앱 안 브라우저 제외) */
export function isIOSSafari(ua, maxTouchPoints = 0) {
  const s = String(ua || "");
  return isIOS(s, maxTouchPoints) && !OTHER_BROWSER.test(s) && !isInAppBrowser(s);
}

/** @returns {"safari" | "inapp" | null} */
export function installHintKind({ ua, maxTouchPoints = 0, standalone, shown }) {
  if (standalone || shown) return null;
  if (!isIOS(ua, maxTouchPoints)) return null;
  if (isInAppBrowser(ua)) return "inapp";
  return isIOSSafari(ua, maxTouchPoints) ? "safari" : null;
}

/** 예전 이름: 안내를 보일지(종류와 관계없이) */
export function shouldShowInstallHint(o) {
  return installHintKind(o) !== null;
}

// 홈 화면 앱은 사파리와 저장 공간이 따로라서, 처음 한 번은 인터넷이 될 때 열어야 파일을 받아 둔다(판정 C32)
export const INSTALL_AFTER_TEXT = "추가한 뒤, 인터넷이 될 때 아이콘으로 한 번 열어 주세요. 그래야 비행기 모드에서도 열려요.";
