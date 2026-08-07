# 투자 기능 4단계 — 정확한 성과 측정

## 목적

거래 원장의 외부 현금흐름과 투자 결과를 분리해 검증 가능한 기간 성과를 계산하고,
대량 거래 내역을 기존 사용자 데이터와 원장을 보존하면서 증분 반영한다.

## 핵심 결정

- 정확한 성과는 v6 `performanceObservations`의 첫 검증 평가점부터 시작한다. 과거의
  단순 `snapshots`는 수익률로 소급 변환하지 않는다.
- 평가점은 장 종료 후 현금흐름(`END_OF_DAY_POST_FLOW`) 기준이다. 현재 원장 prefix와
  평가점 내용 무결성을 다시 계산하고, 생성 당시 가격 evidence의 128-bit digest,
  가격 방법론과 기준일을 확인한다. digest는 과거 시세 원본의 독립 감사 증명이 아니다.
- 입출금일에 완전한 평가점이 없으면 TWR은 계산하지 않는다. XIRR은 평가점 사이의
  실제 입출금 날짜를 사용한다.
- KOSPI와 S&P 500은 모두 배당 제외 가격지수다. S&P 500은 평가일 USD/KRW로 원화
  환산한 비헤지 비교이며 총수익지수와 동일한 기준이라고 표현하지 않는다.
- CSV 가져오기는 원장 전체 교체가 아니라 미리보기→자동 JSON 백업→검증 행 증분
  추가 순서다. 현재 내장 형식은 AssetTrail 표준 거래 CSV v1 하나다.
- CSV 원문과 원본 계좌 참조는 영구 저장하지 않는다. 오류는 제한된 코드·행 번호·
  필드만 노출한다.
- 평가점은 클라우드 주 문서의 900KB 안전 여유를 위해 300개까지 보존한다. 한도에
  도달하면 기존 점은 보존하고 새 날짜 생성을 명시적으로 중단한다. 장기 이력은 별도
  하위 컬렉션이 필요하다.

## 변경

- `performance-engine.js`에 TWR, XIRR, 원화 가치변화 브리지, 벤치마크 비교, 최대
  낙폭·회복과 연환산 변동성 계산을 추가했다.
- `app.js`와 `index.html`에 기간 선택, TWR·XIRR, 순입출금·투자손익, 벤치마크,
  누적 성과 차트, 성과 원인과 위험 패널을 연결했다.
- 저장 스키마를 v6으로 올리고 `performanceObservations`를 로컬·클라우드·JSON
  내보내기/가져오기와 충돌 fingerprint에 포함했다.
- `scripts/generate_prices.py`가 조정 전 종가·배당 제외 방법론과 KOSPI·S&P 500
  가격지수 metadata를 생성하도록 확장했다.
- `broker-csv-engine.js`와 `broker-csv-adapter-standard.js`를 추가했다. 표준 v1의
  매수·매도, 입출금, 배당·이자, 수수료·세금을 기존 자산·CASH에 매핑하고 원본 ID와
  경제 fingerprint로 중복·충돌을 판정한다.
- CSV 미리보기는 유효·중복·오류·기준일 전 제외 건수, 기간·계좌·예상 현금 및
  포지션 변화를 표시한다. 파일은 15MB·50,000행, 전체 원장은 50,000건으로 제한한다.
- 배포 워크플로와 테스트 명령에 새 엔진·어댑터·성과/CSV 테스트를 포함했다.

## 검증

- 순수 엔진 기준값은 `tests/performance-engine.test.mjs`와
  `tests/broker-csv-engine.test.mjs`에서 검증한다.
- 앱 연결은 `tests/app-performance.test.mjs`와 `tests/app-broker-csv.test.mjs`에서
  v6 이전, 현금흐름 경계, 벤치마크 계약, 미리보기·백업·중복·stale 상태와 원문
  비저장을 검증한다.
- 가격 생성 계약은 `tests/generate-prices-requests.test.py`, 기존 저장·클라우드 회귀는
  `tests/app-data-durability.test.mjs`, `tests/app-cloud-sync.test.mjs`와
  `tests/app-cloud-conflict.test.mjs`에서 검증한다.
- 최종 확인 명령은 `npm run check:js`, `npm run test:performance`,
  `npm run test:broker-csv`, `npm run test:prices`, `npm run test:price-requests`,
  `npm test`다. 실제 실행 결과는 이 작업의 최종 보고를 기준으로 한다.

## 다음 작업

- 운영 배포 후 서로 다른 날짜의 완전한 평가점이 실제로 쌓이는지 확인한다. 기존
  조회 스냅샷만으로는 과거 TWR·XIRR이 생기지 않는 것이 의도된 동작이다.
- 실제 사용하는 증권사 형식은 개인정보가 없는 fixture와 명시적 열 의미를 갖춘
  독립 어댑터로 추가한다. 추측 기반 자동 열 매핑은 하지 않는다.
- 5단계에서 ETF 구성종목과 기업 데이터의 출처·기준일·커버리지를 연결하되,
  결정론적 계산과 AI 설명의 경계를 유지한다.
