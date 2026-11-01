// 시험용 심화 레슨(v0.7 작업 1). 실제 심화 내용(data/lessons/chN.js의 ADVANCED)이 생기기 전에도
// 엔진·빌드·화면 시험을 돌리려고 쓴다. 앱에는 들어가지 않는다(build_test·flow가 임시 장 폴더에 끼워 넣음).
// 모양은 실제 장 파일과 같다: export const ADVANCED = [ { id: "N-A1", chapter: N, isAdvanced: true, ... } × 3 ]
export function advancedFixture(n) {
  return [1, 2, 3].map((k) => ({
    id: `${n}-A${k}`, chapter: n, isAdvanced: true,
    title: `시험 심화 ${k}`,
    goal: `시험용 심화 레슨 ${k}을 끝낼 수 있다`,
    summary: ["시험 요약 하나", "시험 요약 둘", "시험 요약 셋"],
    cards: [{ say: `심화 시험 카드 ${n}-A${k}: print로 두 줄을 찍어 봐요.`, code: 'print("가")\nprint("나")', out: "가\n나" }],
    items: [
      {
        type: "choice", concept: "print", q: `심화 시험 문제 ${n}-A${k}: 화면에 무엇이 나올까요?`,
        code: 'print("별")', options: ["별", '"별"'], answer: 0, explain: "따옴표는 나오지 않아요.",
      },
      {
        type: "write", concept: "print",
        task: `심화 시험 작성 ${n}-A${k}: 아래 두 줄을 그대로 출력해 보세요.\n심화\n완료`,
        starter: "",
        tests: [{ stdin: "", expect: "심화\n완료", public: true }],
        require: [],
        hints: ["두 줄이에요.", "print를 두 번 써요.", "한 줄에 print 하나씩.", 'print("___")\nprint("___")'],
        solution: 'print("심화")\nprint("완료")',
        explain: "print 두 개가 두 줄을 찍었어요.",
      },
      {
        type: "check", concept: "print", q: `심화 시험 확인 ${n}-A${k}: print()는 무엇을 찍을까요?`,
        options: ["빈 줄", "오류"], answer: 0, explain: "괄호가 비면 빈 줄이에요.",
      },
    ],
  }));
}
