// 개념 목록 (설계서 4-1). 문제의 concept 칸과 취약 개념 집계(weak_concepts, review_queue)에 쓴다.
// chapter: 그 개념을 처음 배우는 장. id는 바꾸지 않는다(저장 파일에 남음).
export const CONCEPTS = [
  // 1장 첫 코드
  { id: "print", name: "print로 출력하기", chapter: 1 },
  { id: "string", name: "문자열", chapter: 1 },
  { id: "arith", name: "숫자 계산", chapter: 1 },
  { id: "comment", name: "주석", chapter: 1 },
  // 2장 변수와 표현식
  { id: "assign", name: "변수와 대입", chapter: 2 },
  { id: "expr", name: "표현식", chapter: 2 },
  { id: "type", name: "자료형", chapter: 2 },
  { id: "input", name: "input으로 입력받기", chapter: 2 },
  { id: "convert", name: "형 변환", chapter: 2 },
  // 3장 조건문
  { id: "if", name: "if 조건문", chapter: 3 },
  { id: "else", name: "else로 그 밖의 경우", chapter: 3 },
  { id: "elif", name: "elif로 여러 갈래", chapter: 3 },
  { id: "compare", name: "비교 연산", chapter: 3 },
  { id: "logic", name: "and·or·not 논리 연산", chapter: 3 },
];
