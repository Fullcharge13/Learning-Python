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
  // 4장 함수
  { id: "call", name: "함수 부르기", chapter: 4 },
  { id: "def", name: "함수 만들기", chapter: 4 },
  { id: "param", name: "매개변수", chapter: 4 },
  { id: "return", name: "반환값", chapter: 4 },
  // 5장 반복문
  { id: "while", name: "while 반복", chapter: 5 },
  { id: "for", name: "for 반복", chapter: 5 },
  { id: "range", name: "range로 범위 만들기", chapter: 5 },
  { id: "accum", name: "누적 패턴", chapter: 5 },
  { id: "break", name: "break·continue로 멈추기·건너뛰기", chapter: 5 },
  // 6장 문자열 다루기
  { id: "index", name: "인덱스", chapter: 6 },
  { id: "slice", name: "슬라이싱", chapter: 6 },
  { id: "strmethod", name: "문자열 메서드", chapter: 6 },
  { id: "strloop", name: "문자열 반복", chapter: 6 },
  // 7장 리스트
  { id: "list", name: "리스트 만들기", chapter: 7 },
  { id: "listmod", name: "리스트 바꾸기", chapter: 7 },
  { id: "listloop", name: "리스트 반복", chapter: 7 },
  { id: "listfunc", name: "리스트와 내장 함수", chapter: 7 },
  // 8장 딕셔너리
  { id: "dict", name: "딕셔너리", chapter: 8 },
  { id: "dictmod", name: "딕셔너리 바꾸기", chapter: 8 },
  { id: "dictget", name: "get으로 안전하게", chapter: 8 },
  { id: "count", name: "세기 패턴", chapter: 8 },
  // 9장 튜플과 집합
  { id: "tuple", name: "튜플", chapter: 9 },
  { id: "unpack", name: "묶고 풀기", chapter: 9 },
  { id: "items", name: "items와 정렬", chapter: 9 },
  { id: "set", name: "집합", chapter: 9 },
  // 10장 예외 처리
  { id: "exc", name: "오류 읽기", chapter: 10 },
  { id: "try", name: "try와 except", chapter: 10 },
  { id: "excmulti", name: "여러 오류 나누기", chapter: 10 },
  { id: "raise", name: "raise로 오류 내기", chapter: 10 },
];
