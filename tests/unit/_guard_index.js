// 시험 준비(판정 G2-C3): 앱처럼 저장을 읽기 전에 경비실 색인을 넣는다.
// 저장(migrate)·배지(checkBadges)를 거치는 시험 파일은 맨 위에서 이 파일을 import한다.
import { setGuardIndex } from "../../src/guard/state.js";
import { buildGuardIndex } from "../../src/guard/catalog.js";
import { INCIDENTS } from "../../data/guard.js";

export const GUARD_INDEX = buildGuardIndex(INCIDENTS);
setGuardIndex(GUARD_INDEX);
