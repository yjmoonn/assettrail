# 예수금 잔액 관리 개선

## 목적

매매와 연결된 예수금도 원장 이력을 훼손하지 않고 실제 잔액에 맞출 수 있게 하고,
추가납입 뒤 매수를 다시 입력해야 했던 흐름을 한 번의 명시적 작업으로 줄인다.

## 핵심 결정

- CASH 금액 직접 덮어쓰기는 계속 막고 차액을 append-only 원장 이벤트로 기록한다.
- 잔액 차이는 가능한 한 입금·출금·배당·이자·수수료·세금으로 분류한다.
- 최초 등록 오류는 활성 기초잔액의 감사 정정으로 처리해 이후 매매를 그대로 유지한다.
- 원인을 모르는 차액은 원화 `CASH_ADJUSTMENT`로만 허용하고 사유를 필수로 받는다.
  잔액에는 반영하지만 활성 조정이 있는 날짜의 성과 평가점은 완전한 값으로 인정하지
  않는다.
- 부족금 자동입금은 `DEPOSIT` 다음 `BUY` 순서를 보장해 한 번에 저장하고, 되돌릴 때도
  두 이벤트를 함께 취소한다.

## 변경

- `index.html`, `styles.css`: CASH 빠른 동작, 수정 잠금 안내, 잔액 대사식, 부족금
  자동입금 선택 UI와 반응형 레이아웃.
- `app.js`: 잔액 차이 원인 검증·이벤트 생성, 기초잔액 연쇄 정정, 원인 미확인 성과
  제한, 복수 이벤트 원자적 취소와 매수 부족금 자동입금.
- `ledger-engine.js`: 서명된 원화 `CASH_ADJUSTMENT` 검증·투영·분류 경고.
- `tests/ledger-engine.test.mjs`, `tests/app-ledger.test.mjs`: 양·음 조정, 필수 사유,
  기초잔액 정정·복원, 빠른 동작, 성과 제한, 자동입금 매수와 묶음 취소 회귀 계약.

## 검증

- `npm run check:js` 통과.
- `npm run test:ledger` 통과.
- `npm run test:performance` 통과.
- `npm run test:broker-csv` 통과.
- `npm run test:data` 통과.
- `npm run test:cloud` 통과.
- 전체 `npm test`의 JS 구간은 데이터 내구성까지 통과했다. 시스템 Python에는 가격
  테스트 의존성이 없어 임시 격리 환경에 `requirements.txt` 버전을 설치한 뒤
  `tests/generate-prices-requests.test.py` 통과를 별도로 확인했다.
- `npm run test:firestore`는 로컬 Java 런타임 부재로 실행하지 못했다. Firestore Rules와
  클라우드 저장 구조는 이번 작업에서 변경하지 않았다.
- Chrome 1440px·1280px·430px·390px에서 문서 가로 넘침 0px와 중복 ID 0건 확인.
- 430px·390px에서 잔액 맞추기와 부족금 자동입금 폼의 입력·버튼 높이 44px 이상 확인.

## 다음 작업

- 사용자 확인 후 PR을 병합하고 GitHub Pages 배포 상태에서 실제 사용자 데이터로
  입금·잔액 맞추기·자동입금 매수 한 건씩 점검한다.
- 원인 미확인 조정을 나중에 올바른 유형으로 재분류하는 전용 도우미는 별도 후속으로
  검토한다. 현재는 조정을 취소한 뒤 정확한 현금흐름으로 다시 기록한다.
