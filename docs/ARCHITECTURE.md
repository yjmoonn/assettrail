# AssetTrail 아키텍처

AssetTrail은 GitHub Pages로 배포되는 정적 개인 자산 관리 앱이다. 루트의 HTML, CSS, JavaScript 파일이 앱을 구성하고, Firebase가 로그인 및 사용자별 저장을 담당하며, GitHub Actions가 시장 가격표를 생성한다.

라이브 앱: https://yjmoonn.github.io/assettrail/

## 앱 구조

배포되는 앱은 루트의 정적 파일을 기준으로 한다.

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 마크업과 화면 컨테이너 |
| `styles.css` | 시각 시스템, 레이아웃, 반응형 스타일 |
| `app.js` | 상태, 렌더링, 포트폴리오 계산, 동기화, 가격표, 상호작용 |
| `decision-engine.js` | 계좌 통합 경제적 포지션, Top 1·Top 5·HHI, 검토일과 데이터 품질을 계산하는 순수 엔진 |
| `action-engine.js` | 신규자금 제약 배분과 수동 태그 노출·위험예산을 계산하는 순수 엔진 |
| `ledger-engine.js` | 거래·현금흐름 이벤트 검증, 기초잔액, 수량·원가·CASH 투영, 정정·취소 감사를 계산하는 순수 엔진 |
| `performance-engine.js` | 검증 평가점의 TWR·XIRR, 원화 가치변화 브리지, 벤치마크, 낙폭·회복·변동성을 계산하는 순수 엔진 |
| `broker-csv-engine.js` | CSV 파싱·형식 감지·매핑 요청·중복 판별과 행별 처리 결과를 만드는 순수 엔진 |
| `broker-csv-adapter-standard.js` | AssetTrail 표준 거래 CSV v1을 원장 이벤트 후보로 바꾸는 독립 어댑터 |
| `external-data-engine.js` | 사용자가 붙여넣은 Butler 표를 출처·기준일·확정/컨센서스가 분리된 기업 사실 스냅샷으로 정규화하는 순수 엔진 |
| `etf-exposure-engine.js` | 허용된 ETF 카탈로그를 검증하고 직접·간접 중복노출, 현금·미매핑·미보고 비중을 계산하는 순수 엔진 |
| `ai-report-engine.js` | 상대지표 근거 envelope, 결정론 보고서, 수동 ChatGPT handoff와 응답 계약을 만드는 순수 엔진 |
| `firebase-config.js` | 브라우저용 Firebase 클라이언트 설정 |
| `firebase.json` | Firebase 프로젝트 설정 |
| `firestore.rules` | Firestore 접근 제어 경계 |

GitHub Pages 배포는 `.github/workflows/deploy-pages.yml`에서 처리한다. 워크플로는 CI 중 `_site/`를 만들지만, `_site/`는 생성물이라 커밋하지 않는다.

## 사용자 데이터 경계

AssetTrail은 로그아웃 상태의 로컬 사용과 로그인 상태의 클라우드 동기화를 모두 지원한다.

| 상태 | 저장 위치 |
|---|---|
| 로그아웃 | 브라우저 로컬 저장소 |
| 로그인 주 상태 | Firestore 문서 `users/{uid}/financeData/primary` |
| 로그인 원장 이벤트 | `users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}` |

사용자 문서는 아래 데이터를 가진다.

| 필드 | 설명 |
|---|---|
| `assets` | 자산 원장 |
| `ledgerMeta` | 활성 원장 세대, 기준일, 이벤트 개수와 고정 fingerprint |
| `decisionProfiles` | 종목 또는 비시장 자산 단위 투자 가설·역할·검토 기준과 7차원 `riskTags` |
| `watchlist` | 보유 자산과 분리된 관심종목 목록 |
| `snapshots` | 저장된 포트폴리오 히스토리 스냅샷 |
| `performanceObservations` | 검증된 날짜별 NAV·누적 현금흐름·원장/가격 evidence·내용 무결성·벤치마크 평가점 |
| `realizedTrades` | 매도 처리로 생성된 실현손익 기록 |
| `tradeJournalEntries` | 매수, 매도, 리밸런싱, 관찰 판단 매매일지 |
| `retirement` | 은퇴 시뮬레이터 설정 |
| `retirementScenarios` | 저장한 은퇴 시나리오 |
| `portfolioTargets` | 밴드 목표값과 호환되는 기존 국내·해외·현금·수동 목표 비중 |
| `policyProfile` | 네 자산군의 최소·목표·최대 비중 밴드와 역할·오버레이 위험예산 |
| `contributionPlan` | 일회성·월 정기 신규자금 모드와 금액 |

로컬 저장과 JSON 내보내기에는 `events` 배열도 포함되지만 로그인 사용자의 클라우드
주 문서에는 이벤트 배열을 넣지 않는다. 클라우드에서는 `ledgerMeta.activeLedgerId`가
가리키는 세대의 하위 컬렉션에서 이벤트를 읽는다. 이 구조는 이벤트 증가가 주 문서의
900KB 안전 한도를 소진하지 않게 한다.

저장 데이터는 현재 `schemaVersion: 6`을 사용한다. 버전이 없거나
`schemaVersion: 1~5`인 기존 데이터는 검증 가능한 원본 백업을 먼저 만든 뒤 v6으로
마이그레이션한다. 기존 자산마다 원장 기준일의 `OPENING_BALANCE`를 만들며 매수 시점과
과거 환율을 추정하지 않는다. v5→v6은 빈 `performanceObservations`를 추가할 뿐 과거
`snapshots`를 수익률 평가점으로 복제하지 않는다. 로컬 마이그레이션 백업은 별도 키에 쓴 뒤 다시 읽어
일치 여부를 확인하고, 클라우드 스키마 이전 또는 강제 충돌 업로드 전에는 변경 불가능한
`primary/backups/{backupId}` 사본을 남긴다. 이전에 실패하면 원래 상태를 유지한다.

기존 `portfolioTargets`는 각 목표값을 중심으로 기본 ±10%p 범위의
`allocationBands`로 이전한다. v4에서 도입한 `policyProfile`, `contributionPlan`과
`decisionProfiles.riskTags`도 그대로 유지한다. 같은 종목의 이전 계좌 행에 서로 다른
판단이 있으면 첫 값을 임의로
덮어쓰지 않고 `migrationConflicts`에 계좌별 원본을 보존해 상세 화면에서 비교하게
한다. 사용자가 현재 판단을 명시적으로 저장한 뒤에만 충돌 기록을 해소한다.
자산의 시장·티커를 이미 다른 프로필이 있는 종목으로 바꾸면 대상 판단을 유지하고
티커 변경으로 이전 `subjectKey`의 마지막 참조가 사라질 때만 이전 판단과 그 충돌
원본을 대상의 `migrationConflicts`로 옮겨 비교 가능하게 한다. 다른 계좌나 관심종목이
이전 `subjectKey`를 계속 사용하면 두 종목의 판단을 그대로 분리해 둔다.
구버전 앱이 v6 데이터를 읽고 새 필드나 원장 하위 컬렉션을 제거한 채 다시 쓰지 못하도록
미지원 미래 버전 보호를 유지하며, 로컬 또는 원격 문서가 현재 앱보다 새 버전이면 자동 pull과
push를 모두 중단한다. 클라우드 문서는 단조 증가하는
`revision`을 함께 저장하며, 다른 기기에서 더 최신 revision을 발견하면 자동
덮어쓰기를 멈춘다. 사용자는 클라우드 가져오기, 이 기기 데이터 올리기, 나중에
결정하기 중 하나를 선택하고, 앞의 두 작업 전에 현재 기기 JSON 백업을 받는다.

조회 히스토리 스냅샷은 자산 전체를 복제하지 않고 `id`, `createdAt`, `total`,
`note`, `typeTotals`만 저장한다.

성과 평가점은 조회 스냅샷과 별개다. `performanceObservations`는 날짜별 NAV, 시장·현금·
수동평가·미결제 금액, 누적 입출금·배당·이자·비용, USD/KRW와 벤치마크 수준,
`ledgerAsOfFingerprint`, `priceFingerprint`, `markFingerprint`, 방법론과 완전성
상태를 저장한다. 최대 300개만 허용하며, 로컬·클라우드·JSON 내보내기/가져오기와
충돌 fingerprint에 포함한다. 같은 날짜의 평가점은 최신 검증 상태로 갱신한다. 300개
한도에 도달하면 기존 날짜 평가점은 보존·갱신할 수 있지만 새 날짜 평가점은 생성하지
않고 화면에 이유를 알린다. 이 상한은 사용자 주 문서의 900KB 한도에 안전 여유를
남기기 위한 현재 정책이며 장기 보존에는 별도 하위 컬렉션 또는 chunk 구조가 필요하다.

사용자별 Firestore 경계는 제품 요구사항이다. 포트폴리오 데이터는 해당 로그인 사용자만 읽고 쓸 수 있어야 한다.

5단계의 기업 스냅샷과 ETF 카탈로그는 v6 사용자 주 문서와 분리한다. 현재
`activeStorageKey`에 각각 `:external-data-v1`, `:etf-catalog-v1` 접미사를 붙인
브라우저 로컬 저장소를 사용하므로 로그인 사용자가 바뀌면 저장 경계도 함께 전환된다.
기업 저장소는 정규화 스냅샷 최대 60개·약 750KB, ETF 카탈로그는 약 2MB로 제한한다.
둘 다 Firestore, 클라우드 충돌 fingerprint, 주 JSON 내보내기와 기기 간 동기화 대상이
아니다. 별도 백업·비우기 흐름을 제공하며 검증 실패 원본은 사용자가 백업하거나 명시적으로
비우기 전까지 쓰기를 차단한다. 마지막으로 읽은 원문과 저장 직전 원문이 다르면 쓰기와
비우기를 중단하고, 다른 탭의 `storage` 이벤트는 최신 저장소를 다시 읽는다. 사용자 전환은
진행 중인 외부·ETF 파일 읽기 토큰을 무효화하고 입력·결과 DOM을 초기화한다. 외부 데이터는
백업을 다시 가져올 수 있고 개별 스냅샷 삭제 전에도 백업하며, ETF 전체 교체 전에는 기존
카탈로그를 백업한다. Butler 원문과 AI 보고서 입력·응답도 영구 저장하지 않는다.

## 자산 모델

자산은 네 가지 주요 유형을 사용한다.

| 유형 | 사용 대상 | 평가 방식 |
|---|---|---|
| `KRX` | 국내 주식, ETF, ETN | `수량 x 현재 원화 가격` |
| `US` | 미국 주식, ETF | `수량 x 현재 달러 가격 x USD/KRW` |
| `CASH` | 현금성 자산 | 사용자가 입력한 `amount` |
| `MANUAL` | 예금, 적금, 펀드, 보험성 상품, 기타 수동 관리 자산 | 사용자가 입력한 `amount` |

주요 원장 필드는 아래와 같다.

| 필드 | 설명 |
|---|---|
| `type` | `KRX`, `US`, `CASH`, `MANUAL` 중 하나 |
| `account` | 계좌명. 같은 티커를 여러 계좌에 보유할 때 구분 기준 |
| `ticker` | `KRX`, `US` 자산의 종목코드 |
| `name` | 표시용 자산명. 가격표 심볼 데이터로 채워질 수 있음 |
| `quantity` | 시장가격 자산의 수량 |
| `averagePrice` | 평단가. `US` 값은 달러 기준 |
| `amount` | `CASH`, `MANUAL`의 수동 평가금액 |

같은 티커라도 계좌가 다르면 별도 자산 행으로 관리한다.

## 의사결정 모델과 식별자 경계

보유 수량과 거래 처리는 계좌별 자산 행을 기준으로 하지만, 시장 종목의 투자 가설은
계좌와 무관한 종목 단위로 공유한다.

| 식별자 | 의미 | 예시 |
|---|---|---|
| `assetId` | 계좌별 보유 행의 안정적인 ID | `mabc123-x1y2z3` |
| `instrumentKey` | 시장·정규화 티커로 만든 경제적 종목 키 | `INSTRUMENT:KRX:005930` |
| `decisionProfile.subjectKey` | 시장 자산은 `instrumentKey`, CASH/MANUAL은 `ASSET:{assetId}` | `ASSET:cash-1` |
| `watchlistItemId` | 보유 여부와 독립적인 관심종목 목록 ID | `watch-mabc123-x1y2z3` |
| `eventId` | 거래·현금흐름 이벤트 자체의 ID | 자산 ID와 별도 생성 |
| `ledgerId` | 가져오기·대량 교체를 격리하는 원장 세대 ID | `ledger-mabc123-x1y2z3` |

`decisionProfiles`에는 `investmentRole`, `thesis`, `returnSource`, `horizon`,
`conviction`, `kpis`, `catalysts`, `invalidation`, `deceleration`, `nextReviewAt`,
`lastReviewedAt`, `reviewStatus`와 `riskTags`를 저장한다. 위험 태그 차원은 업종,
국가, 통화, 금리, 듀레이션, 고객·매출처, AI 가치사슬이다. 역할은 `CORE`,
`STRUCTURAL_GROWTH`, `CYCLE`, `TACTICAL`, `SURVIVAL` 중 하나이며, 기존 데이터에는
`UNASSIGNED` 기본값을 적용한다. `watchlist`는 이름·시장·티커와 목록 ID만 갖고 같은
`instrumentKey`의 의사결정 프로필을 참조한다. 새 관심종목이 이미 보유 중인 종목과
겹치면 공유 프로필을 실수로 덮지 않도록 등록을 막고 자산 상세에서 판단을 관리하게
안내한다. 전량매도 뒤 남은 미참조 프로필과 다시 연결할 때는 기존 판단을 폼에 먼저
불러올지 묻고, 사용자가 새 초안을 유지하면 기존 판단과 원본을 나란히 보여준 뒤
두 번째 저장에서만 갱신한다. 과거 데이터에 중복 항목이 있더라도 총자산과
집중도에는 보유 자산만 반영된다. 시장 종목의 위험 태그는 판단과 마찬가지로 같은
시장·정규화 티커의 모든 계좌가 공유하고, CASH·MANUAL 태그는 자산별로 유지한다.

거래 이벤트는 `eventId`를 새로 만들고 `assetId` 또는 `instrumentKey`를 참조한다.
이벤트 ID를 자산 ID로 재사용하거나 계좌별 자산 행을 경제적 종목 ID로 간주하지
않는다. 결제 현금은 별도 `cashAssetId`와 `cashAccountId`로 참조해 거래 자산의 계좌와
다른 CASH를 선택해도 두 계좌를 섞지 않는다.

## 거래·현금흐름 원장

`ledger-engine.js`는 `BUY`, `SELL`, `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND`, `INTEREST`,
`FEE`, `TAX`, `SPLIT`, `VALUATION`, `FX`와 내부 `OPENING_BALANCE`, `CANCEL` 이벤트를
검증하고 기준일 현재의 포지션 수량·평균원가·CASH 잔액을 결정론적으로 투영한다.
거래일과 결제일을 분리하며 수량, 가격, 거래통화, 거래 당시 환율, 원화 수수료·세금,
계좌, 원본 식별자를 보존한다. 같은 계좌의 `sourceSystem`·`sourceId` 중복, 중복
`eventId`, 잘못된 자산 참조, 원장 기준일 이전 거래와 음수 수량·현금을 거부한다.

현재 앱 화면은 KRX·US 매수와 매도, 입금·출금·배당·이자·수수료·세금, MANUAL
평가조정을 생성한다. 엔진은 SPLIT·FX도 지원하지만 이 둘을 직접 입력하는 일상 화면은
아직 제공하지 않는다. 매수·매도는 선택한 CASH의 원화 잔액과 주식 수량을 하나의
후보 상태에서 계산하고, 어느 쪽이든 유효하지 않으면 전체 작업을 저장하지 않는다.
US의 거래가격과 거래통화·환율은 감사용 원본으로 유지하되 CASH는 현재 자산 모델에
맞춰 원화 `amount`로 정산한다. v4 이전부터 있던 US 기초잔액은 역사적 환율을 알 수
없으므로 원화 원가와 그 구간의 실현손익을 미확정으로 둔다.

정정과 취소는 원본 이벤트를 수정하거나 삭제하지 않는다. 정정 이벤트는
`correctsEventId`, 취소 이벤트는 `targetEventId`와 처리일·사유를 추가하며, 과거 기준
투영에서는 감사 처리일 이후에만 효력이 생긴다. 기존 `realizedTrades`는 기초잔액 이전
기간의 참고 기록으로 보존할 뿐 SELL 이벤트로 재생하지 않아 현재 보유를 이중 차감하지
않는다. 새 매도와 매매일지는 `ledgerEventId`로 원장 이벤트와 연결한다.

기초잔액 외 활성 이벤트가 없는 MARKET 자산의 티커 오등록은 기존 기초잔액을 직접
바꾸지 않고 같은 유형의 `OPENING_BALANCE` 정정 이벤트를 추가한다. 같은 조건의 잘못
등록한 자산은 활성 기초잔액을 `CANCEL`한 뒤 화면 자산 목록에서 제거하되 원본과 취소
이벤트는 남긴다. BUY·SELL·현금흐름 등 후속 이력이 하나라도 있으면 티커 변경과 삭제를
막으며, 해당 후속 이벤트가 나중에 취소됐더라도 과거 참조는 그대로 보호한다. 거래
취소 시 연결 실현손익·매매일지를 먼저 같은 후보 상태로 갱신한 뒤 `CANCEL`까지 함께
검증하고, 어느 하나라도 실패하면 전체 상태를 되돌린다. UI 등록과 가져오기 모두 자산
identity 및 컬렉션 ID 중복을 원장 투영 전에 검사한다.

클라우드 읽기는 주 문서 → 활성 ledger 이벤트 → 주 문서를 최대 3회까지 다시 읽어
revision, 이벤트 개수와 고정 fingerprint가 모두 같은 경우에만 완료한다. 400건 이하의
새 이벤트는 주 문서의 자산·CASH·revision과 같은 Firestore transaction으로 저장한다.
400건을 넘는 가져오기·교체는 새 ledger 세대에 먼저 staging하고 전체 이벤트와
manifest를 검증한 뒤 마지막 transaction에서 `activeLedgerId`를 원자적으로 교체한다.
실패한 staging 세대는 현재 활성 원장 조회에 섞이지 않는다.

JSON 가져오기는 이벤트 자체뿐 아니라 자산·CASH·실현손익·매매일지의 양방향 참조와
최종 잔액을 검증한 뒤에만 현재 상태를 교체한다. 강제 충돌 업로드는 원격 주 문서를
변경 불가능한 백업으로 남긴 뒤 진행한다. 스키마 v6과 원장·성과 필드를 모르는 이전 앱은
v6 주 문서를 감지하면 읽기·쓰기를 중단한다.

## 증권사 CSV 증분 가져오기

CSV 처리는 원장 전체를 교체하지 않고 검증을 통과한 이벤트만 추가한다.
`broker-csv-engine.js`는 RFC 4180 형식, UTF-8 BOM/UTF-8/CP949 디코딩, 형식 감지,
계좌·CASH 매핑 요청, 원본 ID와 경제적 fingerprint 중복 판정을 담당한다. 형식별
해석은 어댑터 경계로 분리한다. 현재 내장 어댑터는
`broker-csv-adapter-standard.js`의 AssetTrail 표준 거래 CSV v1 하나이며, 개별
증권사 원본 양식은 이 표준으로 변환하거나 후속 어댑터를 추가해야 한다.

표준 v1은 `BUY`, `SELL`, `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND`, `INTEREST`, `FEE`,
`TAX`를 지원한다. 거래 고유 ID, 거래일·결제일, 원본 계좌 참조, 시장·티커,
수량·체결가·통화·환율·원화 비용을 받아 기존 자산과 CASH에 연결한다. 원본 계좌
문자열은 매핑에만 사용하고 원장 이벤트에는 복사하지 않는다. 오류 객체도 행 번호,
필드와 제한된 오류 코드만 가지므로 고객명·계좌번호·자유 메모 같은 원문을 로그에
노출하지 않는다.

미리보기는 전체 행 수·기간·계좌 수, 반영·중복·오류·기준일 전 제외 건수, 예상
현금 변화와 포지션 수를 보여준다. 잘못된 행은 제외하고 유효한 행은 유지하되, 같은
원본 거래 ID의 경제적 내용이 달라진 충돌, 미완료 매핑, 원장 투영 실패가 하나라도
남으면 적용을 막는다. 미리보기 후 원장이 바뀌어 fingerprint가 달라져도 다시
분석해야 한다. 적용 직전 현재 상태의 JSON 백업이 성공해야 하며, 이후 원장
transaction 경로로 후보 이벤트를 한 번에 저장한다.

CSV 파일은 15MB(15×1024×1024바이트), 데이터 50,000행으로 제한한다. 기존 원장을 포함한 전체 이벤트도
50,000건을 넘을 수 없다. 원문 문자열은 열린 미리보기의 브라우저 메모리에만 있고
대화상자를 닫으면 제거하며, 로컬 저장소·Firestore·JSON 백업에는 넣지 않는다.

## 검증 평가점과 정확한 성과

`performance-engine.js`는 상태를 바꾸지 않는 순수 계산 모듈이다. 앱은 가격표를
불러오거나 원장을 변경하거나 사용자가 조회 기록을 저장할 때 당일 평가점을 만든다.
평가점에는 `END_OF_DAY_POST_FLOW` 컷오프, 당일 NAV와 미결제 매수채무·매도미수금,
누적 현금흐름, 원장/가격 evidence fingerprint, 평가점 내용 fingerprint와 방법론을 함께 기록한다. 보유 가격의 날짜가
섞이거나 조정 전 종가·배당 제외 정책을 검증할 수 없거나 원장 투영이 실패하면 완전한
평가점을 저장하지 않는다. 수동자산의 평가일이 같지 않은 경우는 제한 상태로 남겨
정확한 계산에서 제외한다.

정확한 계산 직전에는 `ledgerAsOfFingerprint`를 현재 활성 이벤트의 해당 날짜 prefix로
다시 계산하고, `markFingerprint`를 정규화한 평가점 내용에서 다시 계산해 저장 후 변조를
확인한다. `priceFingerprint`는 생성 당시 보유가격·환율·벤치마크·방법론을 묶은 128-bit
evidence digest로 기록하고 형식을 확인한다. 다만 과거 시세 원본 전체를 평가점에
보관하거나 외부 공급자를 다시 조회하지 않으므로, 이 digest가 과거 가격의 독립적인
재조회나 감사 증명을 대신하지는 않는다. 날짜·통화·방법론 검증과 평가점 변조 방어의
범위를 넘어서는 증빙은 별도 가격 이력 저장소가 필요하다.

완전한 평가점은 fingerprint뿐 아니라 내부 회계 항등식도 확인한다. 순입출금은 누적
입금-출금과 같아야 하고, 시장가치는 KRX+US, NAV는 시장+수동평가+CASH+미결제,
US 원화가치는 native 가치×USD/KRW와 허용오차 안에서 일치해야 한다. 정규화 과정에서
필수 날짜·숫자·컷오프를 보정한 평가점은 `INCOMPLETE`로 내려 계산에서 제외한다.

TWR은 각 구간 종료 NAV에서 같은 날의 외부 입출금을 제거한 뒤 구간수익률을
기하연결한다. 시작·종료 사이에 `DEPOSIT` 또는 `WITHDRAWAL`이 있는데 해당 날짜의
완전한 평가점이 없으면 현금흐름의 장중 시점을 임의로 가정하지 않고 TWR·차트·위험
지표·벤치마크 비교를 차단한다. XIRR은 시작 NAV를 투자자 유출, 실제 날짜의 입출금을
투자자 관점 부호로 반영하고 종료 NAV를 회수액으로 사용한다. 복수 근·해 없음·반복
한도 초과를 감지하면 임의 값을 선택하지 않는다.

원화 가치변화 브리지는 시작·종료 NAV 차이를 아래처럼 나눈다.

```text
총 변화 = 순입출금 + 잔여 투자효과(추정) + 환율 + 수동평가 + 배당·이자 - 수수료·세금
```

잔여 투자효과는 종목별 가격 기여도를 독립적으로 재계산한 값이 아니라 총 변화에서
원장으로 식별한 나머지 항목을 뺀 잔여값이다. 따라서 브리지 합계는 가치변화 항등식을
확인하지만 가격 attribution의 독립 검증을 뜻하지 않는다. 종목별 기여도에는 과거
보유수량·가격 이력과 기업행동을 보존하는 별도 계산 경로가 필요하다.

누적 TWR wealth series에서 최대 낙폭, 고점·저점, 회복 여부와 회복 일수를 계산한다.
변동성은 구간 로그수익률의 표본표준편차를 연환산하지만, 구간이 불규칙하거나 관측치가
20개 미만이면 숫자를 확정적으로 표시하지 않는다.

벤치마크는 KOSPI와 S&P 500의 가격지수 수준을 사용하며 배당을 포함하지 않는다.
KOSPI는 KRW 가격지수, S&P 500은 평가일 USD/KRW를 곱한 원화 비헤지 가격지수다.
벤치마크 날짜, 통화, `PRICE_ONLY`, `PRICE_INDEX_LEVEL`, 분배금 제외, 지수 단위와
S&P 500 환율 날짜가 포트폴리오 평가점과 모두 일치할 때만 비교한다. 이 비교는
배당을 포함한 포트폴리오 총수익과 방법론이 완전히 같은 총수익지수 비교가 아니므로
화면에도 `배당 미포함`을 표시한다.

기존 `snapshots`는 당시 총자산의 단순 조회 기록일 뿐 가격·원장 방법론과 입출금
경계를 검증할 수 없다. 따라서 v6 이전 기록을 `performanceObservations`로 소급
변환하지 않는다. 운영 데이터의 수익률 구간은 v6 앱에서 서로 다른 날짜의 완전한
평가점이 실제로 쌓인 뒤부터 시작한다.

## 결정론적 집중도 계산

브라우저 앱은 기존 `assetValue()`로 평가한 원화 금액만 `decision-engine.js`에
전달한다. 엔진은 KRX/US 자산을 `시장:정규화 티커`로 합산하고 CASH/MANUAL과 빈
티커 행은 `assetId`별로 분리한다. 이 결과로 Top 1, Top 5, HHI와 유효 포지션 수를
계산한다.

평가금액이 없는 시장 자산은 값 0으로 조용히 분산 효과를 만들지 않으며, 별도 데이터
품질 경고를 표시한다. 역할·가설·검토일 누락도 계산 결과와 분리된 경고다. 집중도
임계값은 확인을 돕는 일반 정보이며 자동 매수·매도 또는 개인 투자정책이 아니다.
성과율, ETF 투시, 국가·통화 실질노출과 AI 해석은 1단계 엔진 범위에 포함하지 않는다.

## 행동 지원 계산

`action-engine.js`의 신규자금 계산은 국내·해외·현금·수동 네 자산군의 현재 원화
평가금액과 최소·목표·최대 비중을 입력받는다. 먼저 최소 비중 부족분을 채우고, 남은
금액을 목표 부족분에 비례해 배분한 다음, 그래도 남으면 최대 비중까지의 여유에
비례해 배분한다. 신규자금과 결과는 원 단위 안전 정수이며 배분 합계가 입력 금액과
정확히 일치해야 한다. 목표 합계에는 표시용 소수 입력의 ±0.01%p 오차만 허용하고,
최소 합계≤100%·최대 합계≥100%는 수학적 제약이므로 부동소수점 미세 오차 외에는
엄격히 검사한다. 매도 없이 최소·최대 제약을 충족할 수 없거나 시장 자산의
평가금액이 하나라도 누락되면 부분 배분안을 만들지 않고 실패 이유를 반환한다.
계산 결과는 저장하지 않고 `policyProfile`과 `contributionPlan` 입력만 저장해 현재
평가금액으로 매번 다시 계산한다.

위험 분석은 KRX/US의 같은 티커·여러 계좌를 하나의 경제적 포지션으로 합산하고,
각 태그에는 연결된 포지션의 전체 평가금액을 반영한다. 한 포지션이 같은 차원 또는
다른 차원의 여러 태그에 포함될 수 있으므로 태그 노출은 비가산이며 서로 더하지
않는다. `CORE`는 최소 위험예산, `STRUCTURAL_GROWTH`·`CYCLE`·`TACTICAL`은 위성 최대
위험예산으로 본다. `SURVIVAL`은 위성에 포함하지 않고 별도 역할로 유지한다. AI
구조적 성장은 `STRUCTURAL_GROWTH`와 AI 가치사슬 태그의 교집합, 사이클은 `CYCLE`
역할로 계산하며 두 값은 위성과 중복 가능한 오버레이다.

2단계는 자산군별 검토 예산만 제공한다. 특정 종목 선택·주문, 가격·수수료 반영,
ETF 구성종목 자동 투시와 태그별 부분 노출률은 지원하지 않는다. ETF 자동 투시는
출처·기준일·커버리지 모델을 갖추는 5단계 범위다.

## 외부 기업 데이터

`external-data-engine.js`의 현재 운영 입력은 Butler 공식 화면에서 사용자가 직접 복사한
재무정보 TSV다. 앱은 자산, 시장, 통화와 `butler.works` 출처 URL을 사용자가 확인한 뒤
로컬에서 파싱한다. 자동 로그인, 세션 쿠키 재사용, 페이지 스크래핑과 비공개 내부 API
호출은 하지 않는다.

정규화 스냅샷은 `BUTLER_MANUAL`, `USER_SUPPLIED`, `SECONDARY_AGGREGATOR` 출처
속성과 조회 시각, 연도·분기·4분기누적 기간, 통화, 사실별 확정치/컨센서스 구분,
커버리지·진단과 내용 digest를 가진다. 매출, 영업이익, 순이익, 자산·부채·자본,
영업현금흐름, CAPEX와 FCF처럼 허용된 항목만 저장한다. 붙여넣은 원문, 알 수 없는
행과 URL 쿼리는 결과에 포함하지 않는다. 같은 내용은 중복 저장하지 않고, 동일 시각의
다른 내용은 충돌로 막으며, 더 늦은 새 내용은 revision 이력으로 합친다.
유효한 ISO `retrievedAt`을 요구하고 5분을 초과한 미래 조회 시각은 거부한다. 확정치의
기간 종료일이 UTC 조회일보다 미래이면 파싱과 저장 데이터 재검증 모두 거부한다.
미래 컨센서스 기간은 예상치로 허용한다.
Butler URL은 HTTPS 허용 호스트·경로만 받고 사용자정보·비표준 포트를 거부하며 query와
fragment를 정규화 전에 제거한다. 60개 초과 스냅샷은 조용히 절단하지 않고 저장을 막는다.

Butler는 보조 집계 출처다. 현재 구현은 공식 개발자 API나 자동 재배포 권한을
가정하지 않는다. 국내 확정 재무의 OpenDART, 미국 확정 재무의 SEC Company Facts
우선순위는 검토했지만 실시간 백엔드 수집기는 아직 없다. 이를 추가하려면 공급자 약관,
서버 캐시, 속도 제한, 마지막 정상 데이터와 장애 상태, 사용자별 접근 경계를 별도로
설계하고 승인해야 한다. 컨센서스 데이터도 제품·비용·라이선스 결정 전에는 자동
수집하지 않는다.

## ETF 실질노출

`etf-exposure-engine.js`는 `assettrail.etf-holdings.v1` 카탈로그만 받아 표준
`KRX:005930`, `US:AAPL` 형태로 종목을 연결한다. 카탈로그와 각 펀드는 출처 URL,
기준일, 생성 시각, 조회 시각 `retrievedAt`, 재배포 상태와 구조를 선언해야 한다.
`retrievedAt`이 현재 시각보다 5분을 초과해 미래이면 카탈로그를 거부한다.
`PHYSICAL_LONG_ONLY`이며 재배포가 `ALLOWED` 또는 사용자가 직접 제공한
`USER_SUPPLIED`인 데이터만 계산에 사용한다. 합성·레버리지·인버스·숏, 출처 없는
데이터, 비중 합계가 잘못된 데이터는 추정 보정하지 않고 실패 상태로 내린다.

직접 보유와 ETF 속 동일 종목은 하나의 경제적 노출로 합산하지만 ETF 포장 자체를
다시 더하지 않는다. 중첩 ETF는 순환 참조·최대 깊이와 전체 25,000 확장 단계를 제한하고,
남은 가치는 `UNSUPPORTED`로 보존한다. 구성종목 안의
현금과 `OTHER`, `UNMAPPED`, `UNREPORTED`, `UNSUPPORTED`는 별도 버킷으로 유지해
전체 원화 평가액 항등식이 맞는지 확인한다. 따라서 카탈로그가 없거나 오래됐거나
재배포 조건을 확인할 수 없으면 수동 태그를 자동 구성종목처럼 가장하지 않고 기능을
제한한다. 앱에 번들된 상용·공용 ETF 보유목록은 없으며 사용자가 권리를 확인한
카탈로그만 로컬에 보관한다.

직접 보유는 종류가 `ETF`·`FUND`·`ETN`일 때만 펀드로 확장한다. 주식·무종류 포지션과
카탈로그 ID가 충돌하면 직접 종목으로 보존하고 품질을 제한한다. 구성종목도
`instrumentKind`를 보존해, 명시된 중첩 펀드의 카탈로그가 없으면 금액을
`UNSUPPORTED`에 두고 주식으로 추정하지 않는다. 반대로 명시된 `STOCK` ID가 펀드
행과 겹치면 주식으로 유지한다. 종류가 없는 v1 구성종목은 실제 하위 펀드 행이 있을
때만 이전 중첩 호환 동작을 사용한다.

## 근거 envelope와 AI 보고서

`ai-report-engine.js`는 포트폴리오 비중, 검증 성과율, ETF 커버리지와 데이터 상태처럼
허용된 상대지표만 `ASSETTRAIL_AI_EVIDENCE_V1`로 정규화한다. 개별 Butler 기업 비율은
분석 화면에서 결정론적으로 표시하되 명시적 기업 범위·익명화 정책이 생기기 전에는 AI
envelope에 넣지 않는다. UID,
이메일, 계좌·자산·거래 ID, 원거래, 절대 금액·수량, 자유 메모, URL과 은퇴 입력은
제외한다. 근거 ID는 불투명 ID로 바꾸고 envelope와 각 사실의 digest를 검증해 입력
변조와 알려지지 않은 근거 참조를 막는다.

기본 `ASSETTRAIL_AI_REPORT_V1`은 `DETERMINISTIC_RULES`가 만들며 계산과 데이터 품질을
근거 ID에 연결한다. 외부 AI가 없어도 이 보고서와 위험 경고는 동작한다. 사용자가
원할 때만 `ASSETTRAIL_CHATGPT_HANDOFF_V1` JSON을 복사해 ChatGPT에 수동 전달할 수
있다. 돌아온 JSON은 기존 근거만 인용하는지, 계산값을 새로 만들어내지 않는지,
불확실성과 누락을 숨기지 않는지 검증한다. 각 항목은 exact `factIds`와 그 사실들의 exact
근거 합집합을 요구하며, 계산 문장은 결정론 템플릿과 완전 일치하고 해석·불확실성은
고정 안전 문구만 허용한다. 자동 매매 지시·HTML·마크다운·URL·프롬프트 삽입도 거부한다.
성과 수치는 정확한 기간 경계, 완전한 평가점과 현금흐름, 검증된 TWR을 모두 만족할 때만
근거로 제공하고 최신 평가점이 7일을 넘으면 해당 AI 근거를 `STALE`로 표시한다.

브라우저와 배포물에는 모델 API 키나 자동 네트워크 호출이 없다. ChatGPT Pro 인증은
커스텀 앱의 API 인증이나 사용량으로 전환할 수 없으므로 재사용하지 않는다. 인증된
callable 백엔드, App Check, 서버측 최신 revision 재검증, Secret Manager와 별도 모델
비용을 포함한 자동 호출은 제품·비용·보안 승인을 받기 전까지 미구현 상태다.

## 가격표 흐름

`prices.json`과 `symbols.json`은 GitHub Actions가 생성하고 브라우저 앱이 읽는다.
가격·환율은 앱 시작 시 즉시 필요하지만 종목명 디렉터리는 자산 입력 시에만 필요하므로
두 파일을 분리한다.

가격표 생성기는 아래 파일이다.

```text
scripts/generate_prices.py
```

가격표를 새로 생성하는 경우:

- 하루 1회 스케줄 실행
- 수동 워크플로 실행에서 가격표 생성을 선택한 경우
- 가격 입력 또는 생성기 파일이 바뀐 경우: `tickers.json`, `requirements.txt`, `scripts/generate_prices.py`

UI만 바뀐 배포에서는 기존에 배포된 `prices.json`을 재사용한다. 이렇게 해서 배포가 가격 수집 때문에 불필요하게 느려지지 않게 한다.

가격표 구조 예시는 아래와 같다.

```json
{
  "generatedAt": "2026-05-23T00:00:00Z",
  "methodology": {
    "priceBasis": "unadjusted_close",
    "distributionTreatment": "excluded",
    "totalReturn": false,
    "benchmarkBasis": "price_index_level",
    "quoteCurrencyByMarket": { "KRX": "KRW", "US": "USD" }
  },
  "fx": {
    "USDKRW": {
      "date": "2026-05-22",
      "rate": 1360.5,
      "source": "yfinance KRW=X"
    }
  },
  "prices": {
    "KRX": {},
    "US": {}
  },
  "benchmarks": {
    "KOSPI": {
      "name": "KOSPI",
      "symbol": "1001",
      "level": 3123.45,
      "levelUnit": "index_points",
      "quoteCurrency": "KRW",
      "date": "2026-05-22",
      "source": "pykrx KRX index 1001",
      "priceBasis": "price_index_level",
      "distributionTreatment": "excluded",
      "totalReturn": false
    },
    "SP500": {
      "name": "S&P 500",
      "symbol": "^GSPC",
      "level": 6123.45,
      "levelUnit": "index_points",
      "quoteCurrency": "USD",
      "date": "2026-05-22",
      "source": "yfinance ^GSPC",
      "priceBasis": "price_index_level",
      "distributionTreatment": "excluded",
      "totalReturn": false
    }
  },
  "errors": [],
  "symbolFile": "symbols.json",
  "symbolsGeneratedAt": "2026-05-23T00:00:00Z"
}
```

종목 디렉터리는 별도 파일이며 공백 없이 압축해 배포한다.

```json
{
  "generatedAt": "2026-05-23T00:00:00Z",
  "symbols": {
    "KRX": {},
    "US": {}
  }
}
```

앱은 `prices.json`을 먼저 적용해 평가금액을 표시하고, 사용자가 자산 입력 폼을 처음
열 때 `symbols.json`을 한 번만 지연 로딩한다. 심볼 로딩 실패는 가격 상태나 기존
평가금액을 실패 상태로 바꾸지 않는다. 이전 배포의 inline `symbols` 형식도 계속
읽을 수 있다.

국내 가격은 KRX 전체 가격표를 만든다. 주식, ETF, ETN을 포함하며, ETF/ETN 코드는 `0092B0`처럼 영문이 섞일 수 있다.

미국 가격은 yfinance 일별 종가를 사용한다. 가격 생성 대상은 코드 리뷰와 변경
이력이 남는 `tickers.json`에서만 관리한다. 브라우저가 보유 티커를 공유 문서로
전송하거나 가격 생성기가 Firestore 요청을 읽는 경로는 사용하지 않는다.
`priceRequests/**`는 Firestore Rules에서 읽기와 쓰기를 모두 차단한다.

생성 결과는 배포 전에 실제 거래일을 검증한다. 7일 이내의 KRX 종가가 3,000개
이상이어야 하고, `tickers.json`의 미국 티커는 75%(최소 3개), USD/KRW도 7일
이내여야 한다. 미래 2일 이상 또는 존재하지 않는 달력 날짜는 거부한다. 거래정지
종목처럼 오래된 개별 KRX 항목은 유효 개수에서 제외하되 전체 생성을 막지는 않는다.

가격 생성기는 KOSPI(`1001`)와 S&P 500(`^GSPC`) 가격지수 수준도 수집한다. 개별
벤치마크 수집 실패는 구조화된 `errors`에 남기며 종목 가격표 전체를 실패시키지는
않는다. 앱은 날짜·통화·가격지수·배당 제외 metadata가 모두 맞는 평가점만 성과 비교에
사용하므로, 이전 형식이나 불완전한 벤치마크를 조용히 섞지 않는다.

## 제품 및 보안 제약

- Firebase 웹 설정값은 브라우저 앱에서 공개될 수 있다.
- 실제 데이터 보호 경계는 Firestore Rules다.
- 저장소의 Rules 변경은 테스트만으로 운영에 반영되지 않는다. 인증된
  `firebase deploy --only firestore:rules` 실행과 운영 확인이 별도로 필요하다.
- `.env`, 서비스 계정 JSON, private key, Firebase Admin 인증 정보, 생성 로그, 로컬 백업은 커밋하지 않는다.
- Butler 세션 쿠키·토큰을 저장하거나 자동화에 사용하지 않고, 비공개 API나 무단
  스크래핑으로 현재 수동 입력 경계를 우회하지 않는다.
- ETF 구성종목은 출처·기준일·재배포 권한을 확인할 수 있는 데이터만 사용한다.
- ChatGPT Pro를 앱 API 인증으로 간주하지 않으며 승인 없이 유료 모델 API로 전환하지 않는다.
- 제품 결정 없이 Alpha Vantage, 수동 환율 입력, 대량등록 흐름을 되살리지 않는다.
- `CASH`와 `MANUAL` 자산의 수동 평가 방식을 유지한다.
- 검증되지 않은 과거 `snapshots`를 투자수익률 평가점으로 소급 변환하지 않는다.
- 명시적인 마이그레이션 계획 없이 GitHub Pages 정적 호스팅을 바꾸지 않는다.

## 보관 문서

아래 문서는 상세 과거 맥락 보존용이다.

- `docs/archive/PROJECT_CORE.md`
- `docs/archive/DATA_AND_PRICES.md`
- `docs/archive/OPERATIONS.md`
- `docs/archive/TODO.md`
