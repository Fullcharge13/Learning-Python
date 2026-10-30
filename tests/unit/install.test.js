import { test } from "node:test";
import assert from "node:assert/strict";
import { isIOSSafari, isInAppBrowser, installHintKind, shouldShowInstallHint } from "../../src/install.js";

const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const SAFARI = IOS + " Version/26.6 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const CRIOS = IOS + " CriOS/130.0 Mobile/15E148 Safari/604.1";
const FXIOS = IOS + " FxiOS/131.0 Mobile/15E148 Safari/605.1.15";
const EDGIOS = IOS + " EdgiOS/130.0 Mobile/15E148 Safari/605.1.15";
const KAKAO = IOS + " Mobile/15E148 KAKAOTALK 10.8.5";
const NAVER = IOS + " Mobile/15E148 Safari/605.1 NAVER(inapp; search; 2000; 12.10.3; 15)";
const INSTA = IOS + " Mobile/15E148 Instagram 350.0.0.0 (iPhone16,2; iOS 18_7; ko_KR)";
const FB = IOS + " Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0;FBBV/1]";
const LINE = IOS + " Mobile/15E148 Safari Line/14.10.0";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ANDROID_KAKAO = ANDROID + " KAKAOTALK 10.8.5";

test("ios_safari_ua: 아이폰·아이패드 사파리만", () => {
  assert.equal(isIOSSafari(SAFARI), true);
  assert.equal(isIOSSafari(IPAD), true);
  for (const ua of [CRIOS, FXIOS, EDGIOS, KAKAO, NAVER, INSTA, FB, LINE, ANDROID, MAC, "", undefined]) {
    assert.equal(isIOSSafari(ua), false, String(ua));
  }
});

test("ipados_desktop_ua: Macintosh UA + 터치 지점 2개 이상이면 아이패드 사파리", () => {
  assert.equal(isIOSSafari(MAC, 5), true);
  assert.equal(isIOSSafari(MAC, 0), false);
  assert.equal(isIOSSafari(MAC, 1), false);
  assert.equal(installHintKind({ ua: MAC, maxTouchPoints: 5, standalone: false, shown: false }), "safari");
  assert.equal(installHintKind({ ua: MAC, maxTouchPoints: 0, standalone: false, shown: false }), null);
});

test("in_app_ua: 카카오톡·네이버·인스타그램·페이스북·라인", () => {
  for (const ua of [KAKAO, NAVER, INSTA, FB, LINE]) assert.equal(isInAppBrowser(ua), true, ua);
  for (const ua of [SAFARI, IPAD, CRIOS, ANDROID]) assert.equal(isInAppBrowser(ua), false, ua);
});

test("hint_kind: 사파리는 safari, iOS 인앱은 inapp, 그 밖은 null", () => {
  const k = (ua, o = {}) => installHintKind({ ua, maxTouchPoints: 5, standalone: false, shown: false, ...o });
  assert.equal(k(SAFARI), "safari");
  assert.equal(k(IPAD), "safari");
  for (const ua of [KAKAO, NAVER, INSTA, FB, LINE]) assert.equal(k(ua), "inapp", ua);
  for (const ua of [CRIOS, FXIOS, EDGIOS, ANDROID, ANDROID_KAKAO, ""]) assert.equal(k(ua), null, ua);
  // 한 번만, 설치됐으면 없음
  assert.equal(k(SAFARI, { shown: true }), null);
  assert.equal(k(KAKAO, { shown: true }), null);
  assert.equal(k(SAFARI, { standalone: true }), null);
});

test("install_hint_show: 예전 이름도 같은 판정", () => {
  assert.equal(shouldShowInstallHint({ ua: SAFARI, standalone: false, shown: false }), true);
  assert.equal(shouldShowInstallHint({ ua: KAKAO, standalone: false, shown: false }), true);
  assert.equal(shouldShowInstallHint({ ua: SAFARI, standalone: false, shown: true }), false);
  assert.equal(shouldShowInstallHint({ ua: ANDROID, standalone: false, shown: false }), false);
});
