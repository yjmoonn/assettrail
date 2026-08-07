# AssetTrail 테스트 가이드

이 문서는 변경 후 어떤 검증을 실행할지 고르기 위한 기준이다. 작은 변경에는 가장 좁은 검증을 실행하고, 데이터/동기화/가격/릴리스에 민감한 변경에는 전체 테스트를 실행한다.

## 명령어

| 명령 | 목적 |
|---|---|
| `npm run check:js` | Node로 의사결정·행동·원장·성과·CSV·외부 데이터·ETF·AI 엔진/어댑터와 `app.js` 문법 확인 |
| `npm run test:decision` | 경제적 포지션 합산, Top 1·Top 5·HHI, 검토일과 경고 경계값 검증 |
| `npm run test:action` | 원 단위 신규자금 배분 제약, 불가능 상태, 위험 태그 합산과 위험예산 검증 |
| `npm run test:action-app` | v3→v6 이전 후 행동 지원 UI, 정책·신규자금·위험 태그 저장과 빈 상태 검증 |
| `npm run test:ledger` | 이벤트 스키마·기초잔액·CASH 원화 정산·정정/취소·원장 UI와 참조 정합성 검증 |
| `npm run test:performance` | TWR·XIRR 기준값, 현금흐름 경계, 가치변화 브리지, 벤치마크, 낙폭·변동성과 기간 성과 UI 검증 |
| `npm run test:broker-csv` | 표준 CSV v1 파싱·매핑·중복·부분 오류·크기 한도·백업 후 증분 반영과 원문 비저장 검증 |
| `npm run test:external-data` | Butler TSV 파싱, 확정치/컨센서스 분리, 미래 조회 시각·확정치 거부, 출처·revision·크기 한도와 원문 비저장 검증 |
| `npm run test:etf` | ETF 카탈로그 미래 조회 시각·출처·재배포·구조 검증, `instrumentKind` 중첩·ID 충돌, 직접/간접 중복노출, 순환·미매핑 항등식 검증 |
| `npm run test:ai` | 상대지표 근거 envelope, 결정론 보고서, 수동 handoff와 AI 응답 거부 계약 검증 |
| `npm run test:stage5` | 외부 데이터·ETF·AI 엔진과 분석 화면 연결, 로컬 격리 및 US 티커 운영 CLI를 묶어 검증 |
| `npm run test:investment` | 기존 데이터→v6 마이그레이션·계좌별 판단 충돌 보존, 의사결정 상세, 대시보드 딥링크, 관심종목 CRUD 검증 |
| `npm run test:prices` | 포트폴리오 가격 계산, 가격 방법론과 KOSPI·S&P 500 metadata 처리 검증 |
| `npm run test:price-fallback` | 가격 데이터가 없거나 오래된 경우의 fallback 상태 검증 |
| `npm run test:symbols` | 분리된 종목 디렉터리의 지연 로딩과 실패 격리 검증 |
| `npm run test:cloud` | 주 문서와 세대별 원장 이벤트의 일관된 클라우드 동기화 검증 |
| `npm run test:cloud-conflict` | 원장 fingerprint·revision 충돌, 강제 업로드 백업과 미지원 스키마 차단 검증 |
| `npm run test:cloud-auth-race` | 충돌 선택 중 사용자 전환 시 이전 사용자의 지연된 pull·저장이 새 사용자 상태에 섞이지 않는지 검증 |
| `npm run test:cloud-prices` | 클라우드 자산에 정적 가격표를 적용하는 동작 검증 |
| `npm run test:data` | v6 저장 스키마·성과 평가점, 기초잔액 이전·백업·대량 세대 교체, 가져오기·용량·revision 방어 검증 |
| `npm run test:price-requests` | Python 가격 생성·실거래일 품질 게이트와 벤치마크 방법론 계약 검증 |
| `npm run test:firestore` | Firebase Emulator로 Firestore Rules 검증 |
| `npm test` | 전체 검증을 순서대로 실행 |

## 기본 검증

문서만 변경한 경우:

```sh
npm run check:js
```

UI만 변경한 경우:

```sh
npm run check:js
npm run test:prices
```

가격, 포트폴리오 계산, 동기화, Firestore Rules, 배포에 민감한 변경을 한 경우:

```sh
npm test
```

## Firestore Rules 테스트

Firestore 테스트 명령은 아래와 같다.

```sh
npm run test:firestore
```

`package.json`에는 아래 방식으로 등록되어 있다.

```sh
firebase emulators:exec --only firestore "node tests/firestore-rules.test.mjs"
```

확인할 점:

- 로컬에 Java와 Firebase CLI가 필요하다.
- 테스트 중 `PERMISSION_DENIED` 로그가 나올 수 있다. 접근 거부를 검증하는 과정이면 정상이다.
- 최종 성공 여부는 명령의 종료 코드로 판단한다.

## 변경 유형별 테스트 선택

| 변경 | 필수 검증 |
|---|---|
| Markdown 문서만 변경 | `npm run check:js` |
| `app.js` 렌더링 또는 UI 상태 | `npm run check:js`, 관련 JS 테스트 |
| 의사결정 프로필, 관심종목, 집중도 | `npm run test:decision`, `npm run test:investment`, `npm run test:data`, `npm run test:cloud` |
| 행동 지원 배분·위험 노출 엔진 | `npm run test:action`, `npm run test:action-app` |
| 정책·신규자금·위험 태그 저장 | `npm run test:action-app`, `npm run test:investment`, `npm run test:data`, `npm run test:cloud` |
| 거래 이벤트·CASH 정산·원장 UI | `npm run test:ledger`, `npm run test:data`, `npm run test:cloud` |
| 기초잔액 이전·원장 세대 교체 | `npm run test:ledger`, `npm run test:data`, `npm run test:cloud`, `npm run test:cloud-conflict`, `npm run test:firestore` |
| TWR·XIRR·성과 원인·낙폭·변동성 | `npm run test:performance`, `npm run test:data`, `npm run test:cloud` |
| CSV 어댑터·미리보기·증분 반영 | `npm run test:broker-csv`, `npm run test:ledger`, `npm run test:data` |
| Butler 수동 가져오기·기업 사실 저장 | `npm run test:external-data`, `npm run test:stage5`, `npm run test:data` |
| ETF 카탈로그·실질노출 | `npm run test:etf`, `npm run test:stage5`, `npm run test:prices` |
| AI 근거·결정론 보고서·수동 응답 검증 | `npm run test:ai`, `npm run test:stage5` |
| US 가격 대상 운영 CLI | `npm run test:stage5`, `npm run test:price-requests` |
| 저장 스키마 변경 | `npm run test:data`, `npm run test:cloud`, `npm run test:cloud-conflict` |
| 포트폴리오 계산 또는 가격 표시 | `npm run check:js`, `npm run test:prices`, `npm run test:price-fallback` |
| `scripts/generate_prices.py`, 벤치마크 metadata, `tickers.json`, `requirements.txt` | `npm run test:price-requests`, `npm run test:prices`, `npm run test:performance` |
| Firebase Auth 또는 Firestore 동기화 | `npm run test:cloud`, `npm run test:cloud-prices`, `npm run test:firestore` |
| `firestore.rules` | `npm run test:firestore`, 가능하면 `npm test` |
| GitHub Actions 배포 동작 | `.github/workflows/deploy-pages.yml` 검토 후 변경 입력과 관련된 로컬 테스트 |

## 수동 UI 확인

자동 테스트만으로 레이아웃 품질이 보장되지는 않는다. 화면 변경은 `docs/DESIGN_REVIEW_GUIDE.md`의 뷰포트와 화면별 체크리스트로 실제 렌더링을 확인한다.

의사결정 센터 변경은 아래 상태를 추가로 확인한다.

- 1440px, 1280px, 실제 CDP 모바일 390px·430px에서 가로 오버플로가 없는가
- 같은 티커의 여러 계좌 행이 경제적 포지션 목록에 한 번만 표시되는가
- 긴 가설·KPI·무효화 조건이 상세 드로어와 관심종목 카드 밖으로 넘치지 않는가
- 대시보드의 검토기한 초과 버튼이 정확한 자산의 의사결정 폼을 열고 닫을 때 포커스를 복귀하는가
- 관심종목 추가·수정·삭제가 총자산과 집중도 숫자를 바꾸지 않는가
- 이미 보유한 종목을 새 관심종목으로 등록할 때 보유 프로필을 덮지 않고 안내하는가
- 전량매도 후 남은 판단 프로필을 관심종목으로 복원할 때 기존 내용을 먼저 불러오는가
- 복원 중 기존 판단을 불러오지 않기로 하면 작성 중인 관심종목 초안이 유지되는가
- 자산 티커를 기존 판단이 있는 종목으로 바꿀 때 마지막 이전 종목 행이면 판단 원본을
  보존하고, 다른 계좌가 이전 종목을 계속 보유하면 두 판단을 섞지 않는가
- v2의 동일 종목 계좌별 판단이 다르면 원본 비교 화면이 보이고, 현재값 저장 후에만 해소되는가

행동 지원 화면 변경은 아래 상태도 확인한다.

- 자산군별 최소≤목표≤최대이며 목표 합계 100%, 최소 합계≤100%, 최대 합계≥100%인지 검증하는가
- 일회성·월 정기 모드와 신규자금 금액이 저장되고 배분액 합계가 정확히 일치하는가
- 신규자금이 1원 단위 안전 정수인지 검증하고 소수 금액을 조용히 반올림하지 않는가
- 현재·배분 후 비중과 근거가 보이며, 제약 충돌 때 부분안을 숨기고 이유를 표시하는가
- 결과가 실제 주문이나 특정 종목 매수 지시가 아니라는 문구가 보이는가
- 동일 티커 여러 계좌가 태그 노출에서 경제적 포지션 한 개로 집계되는가
- 태그 금액이 비가산이라는 안내와 위험예산 초과·미달·오래된 검토 경고가 보이는가
- 빈 포트폴리오, 가격 누락, 태그 없음과 잘못된 밴드 경계가 안전하게 표시되며,
  가격 누락 시 불완전 총액으로 배분안을 만들지 않는가
- 1440px, 1280px, 실제 CDP 모바일 390px·430px에서 가로 오버플로가 없고 모바일
  입력·버튼·summary가 44px 이상인가

거래·현금흐름 원장 변경은 아래 상태도 확인한다.

- 기존 v1~v4 데이터가 백업 검증 후 자산별 기초잔액으로 한 번만 이전되는가
- 기존 US 기초잔액의 과거 환율과 원화 원가를 임의로 추정하지 않는가
- 매수·매도 시 CASH를 선택하지 않거나 잔액이 부족하면 주식과 현금 모두 바뀌지 않는가
- US 거래의 native 가격·환율과 원화 CASH 정산액·수수료·세금이 이중 환산되지 않는가
- 매수·매도 저장 후 포지션 수량, 평균단가와 CASH 원화 잔액이 이벤트 투영과 일치하는가
- 입금·출금·배당·이자·수수료·세금과 MANUAL 평가조정이 올바른 분류로 반영되는가
- 정정·취소가 원본 이벤트를 덮어쓰거나 삭제하지 않고 감사일과 사유를 남기는가
- 기초잔액만 있는 종목 티커 정정과 오등록 자산 취소 삭제가 감사 연결을 남기고,
  삭제 직후 투영 및 내보내기→재가져오기에서도 정합성을 유지하는가
- 취소된 BUY·SELL·현금흐름도 과거 의존 이력으로 남아 자산 식별자 변경·삭제를 막고,
  연결 실현손익·매매일지 상태와 `CANCEL`이 한 작업으로 저장되거나 함께 롤백되는가
- UI와 가져오기에서 중복 자산 identity·중복 컬렉션 ID를 원장 반영 전에 거부하는가
- 동일 `eventId`나 같은 계좌의 원본 식별자 중복, 끊어진 자산·CASH·일지 참조를 거부하는가
- 클라우드 주 문서에 `events` 배열이 포함되지 않고 활성 ledger 하위 컬렉션만 읽는가
- 주 문서 → events → 주 문서 재확인이 3회 안에 일치하지 않으면 불완전한 원장을 적용하지 않는가
- 400건 초과 교체 실패 시 staging 세대가 활성 원장에 섞이지 않고 이전 세대를 유지하는가
- 1440px, 1280px, 실제 CDP 모바일 390px·430px에서 원장 표·카드·현금흐름 폼에
  가로 오버플로가 없고 모바일 입력과 버튼이 44px 이상인가

정확한 성과 화면 변경은 아래 상태도 확인한다.

- v5 데이터가 v6으로 이전될 때 `performanceObservations`는 빈 목록으로 시작하고,
  기존 `snapshots`가 수익률 평가점으로 소급 변환되지 않는가
- 서로 다른 날짜의 완전한 평가점이 두 개 미만이면 TWR·XIRR을 성과처럼 표시하지 않는가
- 현재 원장 prefix와 평가점 내용 fingerprint, 가격 evidence digest 형식, 종가 방법론과
  평가일이 모두 맞는 평가점만 계산에 포함하는가
- 가격 evidence digest를 과거 시세 원본의 독립 재조회·감사 증명처럼 표현하지 않는가
- 평가점이 300개일 때 기존 점은 보존되고 같은 날짜 갱신은 가능하지만 새 날짜 생성은
  중단되며 사용자에게 한도와 장기 보존 제약을 알리는가
- 입출금일의 완전한 평가점이 빠지면 TWR·차트·위험 지표를 차단하면서 XIRR은 실제
  입출금 날짜를 계속 사용하는가
- 시작·종료 NAV, 입출금, 가격·환율·수동평가·배당·이자·수수료·세금 분해의 합과
  잔여오차가 기준값 안에서 맞는가
- KOSPI는 KRW 가격지수, S&P 500은 평가일 USD/KRW로 원화 환산한 비헤지 가격지수이며
  둘 다 배당 제외라는 문구가 보이는가
- 벤치마크 날짜·통화·방법론·환율 날짜가 하나라도 다르면 비교값을 숨기고 이유를
  표시하는가
- 낙폭의 고점·저점·회복일과 회복 기간이 맞고, 미회복 상태를 별도로 표시하는가
- 변동성은 최소 관측 수와 불규칙 구간 조건을 충족하지 않으면 `관측 부족`으로 보이는가
- 30일·90일·연초 이후·1년·전체·직접 선택 기간이 평가점 범위를 벗어나거나 뒤집힐 때
  잘못된 수익률을 만들지 않는가
- 1440px, 1280px, 실제 CDP 모바일 390px·430px에서 성과 카드·차트·원인·위험 패널에
  가로 오버플로가 없고 키보드 탭 전환과 차트 대체 설명이 동작하는가

증권사 CSV 변경은 아래 상태도 확인한다.

- 현재 내장 형식이 AssetTrail 표준 거래 CSV v1임을 표시하고, 지원하지 않는 형식을
  임의 해석하지 않는가
- UTF-8 BOM/UTF-8/CP949, 따옴표·쉼표·줄바꿈, 헤더 누락·중복과 열 수 불일치를
  결정론적으로 처리하는가
- 15MB 초과 파일, 50,000행 초과 파일과 반영 후 전체 원장 50,000건 초과를 차단하는가
- 거래 수·기간·계좌·중복·오류·기준일 전 제외 건수와 예상 현금·포지션 변화가 적용 전
  미리보기에 보이는가
- 시장 자산과 결제 CASH의 연결이 모호할 때 사용자가 명시적으로 모두 매핑하기 전에는
  적용할 수 없는가
- 동일 `transaction_id` 또는 경제적 fingerprint의 재가져오기는 중복 제외되고, 같은
  원본 ID의 내용이 바뀌면 충돌로 차단되는가
- 오류 행·원장 투영 거부 행은 제외하되 유효 행의 미리보기와 증분 반영 후보는 유지되는가
- 미리보기 뒤 원장이 바뀌면 stale fingerprint를 감지해 다시 분석하도록 하는가
- 적용 직전 JSON 자동 백업이 실패하면 아무 이벤트도 추가하지 않는가
- CSV 원문과 계좌 참조가 로컬 저장소·Firestore·내보내기 JSON·오류 로그에 남지 않고,
  대화상자를 닫으면 브라우저 메모리와 미리보기 DOM에서도 제거되는가
- 행 값에 HTML이 들어 있어도 미리보기에서 실행되지 않으며, 닫을 때 포커스가 원래
  버튼으로 돌아오는가

외부 데이터·ETF·AI 분석 화면 변경은 아래 상태도 확인한다.

- Butler 공식 표의 연도·분기·4분기누적 형식을 확정치와 컨센서스로 분리하고, 사용자가
  시장·통화·출처를 확인하기 전에는 저장하지 않는가
- 5분을 초과한 미래 `retrievedAt`과 조회일보다 미래인 확정 기간은 파싱·저장 데이터
  재검증에서 거부하고, 미래 컨센서스 기간은 허용하는가
- 붙여넣은 원문, 알 수 없는 행, URL 쿼리와 로그인 토큰이 로컬 저장소·Firestore·
  내보내기·오류 DOM에 남지 않는가
- 같은 기업·같은 내용은 중복되지 않고, 동일 시각의 충돌은 차단하며 새 revision의
  출처·조회일·기준일·커버리지를 표시하는가
- Butler 로그인 자동화, 세션 쿠키 재사용, 스크래핑 또는 비공개 API 호출이 없는가
- ETF 카탈로그가 2MB를 넘거나 출처·기준일·재배포 조건이 없고, HTTPS 출처에
  사용자정보·query·fragment가 있으면 로컬 저장과 투시를 차단하는가
- 합성·레버리지·인버스·숏 ETF와 비중 합계 초과, 중첩 순환 참조를 추정하지 않고
  `UNSUPPORTED` 또는 실패 상태로 표시하는가
- `instrumentKind`로 표시된 중첩 ETF의 카탈로그가 없으면 `UNSUPPORTED`로 보존하고,
  주식·무종류 직접 포지션 또는 `STOCK` 구성종목 ID가 펀드 카탈로그와 충돌해도 펀드로
  자동 확장하지 않는가
- 직접 보유와 ETF 속 동일 종목은 합산하되 ETF 포장을 이중 계산하지 않고, 현금·기타·
  미매핑·미보고·미지원 버킷까지 전체 평가액 항등식이 맞는가
- 카탈로그가 없는 ETF의 직접 금액도 미지원 ETF 원금에 포함되고, 중첩 확장 25,000단계
  도달 시 남은 금액을 `UNSUPPORTED`로 보존하며 기준일 14일 초과를 오래됨으로 표시하는가
- 기업 스냅샷과 ETF 카탈로그가 주 v6 상태·Firestore·클라우드 fingerprint에 섞이지
  않고 활성 사용자별 로컬 키로 격리되는가
- 분석 저장소 손상 시 원문이 자동으로 덮어써지지 않고 백업·비우기가 가능하며, 사용자
  전환 시 Butler 입력·AI 입력·검증 결과 DOM이 지워지는가
- 외부 데이터 백업 복원과 스냅샷 삭제 전 백업, ETF 전체 교체 전 백업이 동작하고,
  다른 탭의 원문 변경 시 쓰기·비우기를 중단한 뒤 `storage` 이벤트로 다시 읽는가
- 외부·ETF 파일을 읽는 중 같은 저장소를 비우면 대기 중 가져오기가 취소되고 삭제한
  카탈로그나 스냅샷이 뒤늦게 다시 저장되지 않는가
- 외부·ETF 파일을 읽는 중 사용자 영역이 바뀌면 가져오기를 취소하고 새 사용자 저장소에
  이전 사용자의 데이터가 기록되지 않는가
- AI 근거 envelope에서 UID·이메일·계좌명·자산/이벤트 ID·원거래·절대 금액·수량·
  자유 메모·URL이 제외되고 상대지표와 불투명 근거 ID만 남는가
- 결정론 보고서가 AI 없이 표시되고, 수동 ChatGPT 응답은 exact fact/evidence 연결과
  허용 템플릿을 지키지 않은 값 바꿔치기·자유 주장·매매 지시·HTML/마크다운/URL·
  프롬프트 삽입을 거부하는가
- 정확한 경계·완전한 평가점·현금흐름과 검증된 TWR만 AI 성과 수치가 되고, 최신 평가점이
  7일을 넘으면 성과 근거가 `STALE`인지 확인하는가
- 일반·전체 테스트가 네트워크나 모델을 호출하지 않아 API 키·ChatGPT 로그인·모델
  사용량이 필요하지 않은가
- 1440px, 1280px, 실제 CDP 모바일 390px·430px에서 붙여넣기·카탈로그 업로드·보고서
  카드가 넘치지 않고 주요 입력과 버튼이 44px 이상인가
