# AI 점검 종목별 평가정보 추가

## 목적

AI 점검 패키지에서 가장 최근에 저장한 조회 기록 기준 종목별 보유수량과 원화 평가액을 직접 확인할 수 있게 한다.

## 핵심 결정

- 계약을 `ASSETTRAIL_AI_REVIEW_V2`와 `ASSETTRAIL_MONTHLY_REVIEW_PROMPT_V2`로 올린다.
- 같은 시장·티커·계좌분류의 여러 자산 행은 하나의 경제적 포지션으로 합산한다.
- `snapshotId`·`snapshotCreatedAt`·`valuationStatus`와 조회 기록 저장일 `asOfDate`, 각 포지션의 `priceAsOf`를 함께 제공한다.
- 과거 조회기록에는 종목별 내역이 없으므로 기존 기록 시점의 수량·평가액을 소급 생성하지 않는다.

## 변경

- 포지션에 `accountClass`, `quantity`, `appliedPrice`, `priceAsOf`, 미국 자산의 `fxRate`·`fxAsOf`, `marketValueKRW`를 추가하고 CASH·MANUAL 저장액도 포함했다.
- 최신 조회 기록에 평가 근거가 없으면 현재 자산·가격으로 대체하지 않고 `MISSING_LEGACY_SNAPSHOT_VALUATION`을 표시한다.
- 개인정보 계약에서 절대 평가액과 수량 포함 사실을 명시하고 계좌명·원거래·메모 제외는 유지했다.
- 화면 안내, 아키텍처, 테스트 계약을 V2 기준으로 갱신했다.

## 검증

- `npm run check:js`: 통과
- `npm run test:ai-review`: 통과
- 월별 실현손익 테스트의 8월 고정 기대를 실행일 기준 연·월로 수정
- `.venv`를 PATH에 포함한 `npm test`: Firestore Rules 테스트 직전까지 모두 통과
- Firestore Rules 테스트: 로컬 Java 런타임이 없어 미실행, PR CI에서 재검증 필요

## 다음 작업

- Firestore Rules 테스트가 필요하면 Java 런타임이 있는 환경에서 재실행한다.
