# 핸드오프 노트 - 제품 경험 개선 이어가기

> 로컬 Claude Code 세션에서 진행한 UX/UI 리뷰 + P0 수정 결과입니다.
> 웹/앱(claude.ai/code) 클라우드 세션은 대화 컨텍스트가 이어지지 않으므로, 이 문서를 시작점으로 사용하세요.
> 예: *"docs/HANDOFF_NOTES.md를 읽고 P1 항목부터 이어서 작업해줘."*

서비스 정의/구조는 `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_EXPERIENCE_REDESIGN.md` 참고.
상세 과거 메모는 `docs/archive/PROJECT_CORE.md`, `docs/archive/DATA_AND_PRICES.md`, `docs/archive/OPERATIONS.md`, `docs/archive/TODO.md`에 보존되어 있습니다.
작업별 결정 요약은 `docs/sessions/`에 보존합니다. 전체 대화가 아니라 목적, 결정, 변경, 검증, 다음 작업만 남깁니다.

## 현재 활성 TODO (2026-08-07)

- 투자 기능 확장 작업은 `docs/INVESTMENT_FEATURE_TODO.md`에서 관리한다.
- 구현 순서는 의사결정 체계 → 행동 지원 → 거래·현금흐름 원장 → 성과 측정 →
  외부 데이터·AI의 5단계다.
- 1~4단계와 5단계의 로컬 안전 기반을 구현했다. Butler 수동 가져오기, 사용자 제공
  ETF 카탈로그 투시, 상대지표 근거·결정론 보고서·수동 ChatGPT 전달이 현재 범위다.
- 운영 OpenDART/SEC 수집 백엔드, 공식 Butler API·라이선스, 라이선스가 확인된 ETF
  공급자와 인증된 자동 AI 호출은 구현하지 않았다. 제품·비용·보안 승인 후의 후속이다.

## 방금 완료한 수정 (2026-08-07 Product Design UX 1단계)

- **첫 사용 흐름** — 자산이 없으면 대시보드의 오늘 기록 패널을 숨기고 `첫 자산 등록`을
  유일한 주 행동으로 올렸다. 상태 확인 목록도 자산 등록부터 시작하도록 바꿨다. 자산이
  생기면 기존 오늘 기록 흐름과 `새 자산 등록` 보조 행동이 다시 나타난다.
- **성과 준비 상태** — 검증 평가점이 2개보다 적을 때 TWR·XIRR·벤치마크 결과와 빈
  차트를 먼저 노출하지 않는다. 자산 등록 → 가격·원장 준비 → 첫 날짜 기록 → 다른 날짜
  기록의 4단계 체크리스트와 현재 필요한 한 가지 행동을 보여주고, 계산 조건은 상세
  펼침으로 분리했다. 계산 공식과 성과 데이터 계약은 변경하지 않았다.
- **빈 상태와 상태 용어** — 기록 이력이 없을 때 빈 차트 대신 오늘 기록 안내를,
  거래가 없을 때 오류처럼 보이지 않는 `검사할 거래 없음` 상태를 표시한다. 동기화 문구는
  `이 기기에 저장됨`, `로그인 필요`, `클라우드와 동기화됨`, `충돌 확인 필요`처럼
  저장 위치와 필요한 행동이 드러나도록 정리했다.
- **클라우드·백업 경계** — Google 로그인과 수동 동기화 행동을 설정의 클라우드 카드로
  모았다. 설정에서 주 데이터 위치, 최근 동기화, 가격 상태를 확인할 수 있다. 기본 JSON에
  포함되는 주 데이터와 별도 백업이 필요한 Butler·ETF, 저장하지 않는 원문·AI 입력을
  4개 상태로 명시했다. 클라우드 충돌 교체 버튼도 교체 방향을 문구에 직접 표시한다.
- **접근성과 반응형** — 의미색의 텍스트 토큰을 짙게 보정하고 공통 `:focus-visible`
  링을 추가했다. 모바일 설정 버튼 중복을 제거하고 주요 조작 높이를 최소 44px로 맞췄다.
  설정 카드는 데스크톱 2열, 모바일 1열로 고정했다. 1440px·1280px·430px·390px에서
  대시보드·설정·기간 성과의 가로 넘침, 계층, 터치 영역을 실화면으로 확인했다.
- **검증과 배포 상태** — `check:js`와 의사결정·행동·원장·성과·CSV·외부 데이터·ETF·AI·
  투자·가격·심볼·클라우드·데이터 내구성 테스트는 통과했다. 전체 `npm test`는 로컬
  Python 가격 테스트 의존성 미설치에서 멈췄고, Firestore 에뮬레이터는 Java 런타임이
  없어 별도 실행이 차단됐다. 이번 변경은 해당 엔진·규칙 파일을 건드리지 않았다.
  커밋·푸시·운영 배포는 하지 않았다.

## 방금 완료한 수정 (2026-08-07 투자 기능 5단계 로컬 안전 기반)

- **Butler 수동 기업 데이터** — Butler 공식 화면의 재무정보 표를 사용자가 직접
  복사해 붙여넣는다. `external-data-engine.js`가 연도·분기·4분기누적과 확정치·
  컨센서스를 구분해 허용된 재무 항목만 정규화한다. 출처는 `BUTLER_MANUAL`,
  `USER_SUPPLIED`, `SECONDARY_AGGREGATOR`로 고정한다. 원문은 미리보기 동안만 메모리에
  두고 자동 로그인·세션 재사용·스크래핑·비공개 API 호출은 하지 않는다. 유효한
  `retrievedAt`을 요구하고 5분을 초과한 미래 조회 시각과 조회일보다 미래인 확정치는
  거부하되 미래 컨센서스는 예상치로 허용한다.
- **로컬 저장 경계** — 기업 스냅샷과 ETF 카탈로그는 현재 사용자 저장 키에 연결된
  별도 로컬 저장소에만 둔다. v6 주 상태, Firestore, 클라우드 충돌 fingerprint와
  JSON 내보내기에는 넣지 않는다. 각각 별도 백업·비우기를 제공하고 손상 원본은 복구
  전까지 덮어쓰지 않는다. 다른 탭의 원문 변경은 저장 직전 차단하고 `storage` 이벤트로
  다시 읽는다. 사용자 전환 시 진행 중인 외부·ETF 파일 읽기를 취소하고 로컬 분석
  저장소와 입력·AI 결과 DOM도 함께 전환·초기화한다. 외부 백업 복원·스냅샷 삭제 전
  백업과 ETF 전체 교체 전 백업을 제공한다.
- **ETF 실질노출** — `etf-exposure-engine.js`는 출처·기준일·재배포 조건이 명시된
  `assettrail.etf-holdings.v1`만 받는다. `PHYSICAL_LONG_ONLY`와 `ALLOWED` 또는
  `USER_SUPPLIED`만 허용하며, 직접 보유와 구성종목을 합치되 ETF 포장 자체는 이중
  계산하지 않는다. 현금·기타·미매핑·미보고·미지원, 중첩·순환과 전체 금액 항등식을
  별도로 검사한다. 카탈로그가 없는 ETF 원금도 미지원에 포함하고 확장 25,000단계와
  입력 상한, 보유 ETF 최저 기준일 14일 오래됨을 적용한다. `instrumentKind`가 명시된
  중첩 펀드의 카탈로그가 없거나 주식·펀드 ID가 충돌하면 임의 확장하지 않고
  `UNSUPPORTED` 또는 `LIMITED`로 낮춘다.
- **보안형 보고서** — `ai-report-engine.js`가 절대 금액·원거래·개인 식별자·자유
  메모를 제거하고 상대 비중·수익률·상태와 불투명 근거 ID만 담은
  `ASSETTRAIL_AI_EVIDENCE_V1`을 만든다. 기본 보고서는 결정론 규칙으로 생성해 AI 없이도
  작동한다. 개별 Butler 비율은 카드에만 두고 기업 데이터 가용 상태만 AI에 전달한다.
  사용자가 원할 때만 수동 ChatGPT 전달 JSON을 복사하고, 반환 JSON은 exact fact ID와
  근거 합집합, 결정론/고정 안전 문구, 불확실성·매매 지시 금지 계약으로 검증한다.
  정확한 경계·완전한 평가점과 현금흐름으로 검증된 성과만 수치로 전달하고 최신 평가점이
  7일을 넘으면 AI 근거를 `STALE`로 낮춘다.
- **비용·인증 경계** — 브라우저와 배포물에 모델 API 키, 네트워크 모델 호출과 자동
  주문을 넣지 않았다. ChatGPT Pro는 커스텀 앱 API 인증으로 재사용하지 않으며 별도
  API 비용 방식으로 조용히 전환하지 않는다. 자동 AI는 Auth·App Check·서버 최신
  revision 재검증·Secret Manager와 비용 승인이 갖춰진 callable 백엔드가 생긴 뒤의
  별도 작업이다.
- **US 티커 운영** — `scripts/manage_us_tickers.mjs`로 등록 여부를 먼저 검토하고,
  사유와 `--apply`를 명시한 경우에만 정렬된 `tickers.json`을 원자적으로 갱신한다.
  브라우저 보유정보나 네트워크 조회를 입력으로 사용하지 않는다.
- **검증 범위** — `npm run test:external-data`, `npm run test:etf`,
  `npm run test:ai`, `npm run test:stage5`, `npm test`와 데스크톱·모바일 분석 화면 확인이
  필수다. 실제 명령 결과, 운영 배포와 실사용 데이터 확인 여부는 해당 작업의 최종
  보고를 기준으로 한다.
- **남은 공급자 작업** — OpenDART/SEC 실시간 백엔드는 캐시·속도 제한·마지막 정상
  데이터·장애 상태와 운영 접근 경계가 필요하다. 공식 Butler 자동 API/재배포 권한과
  ETF 공급자 라이선스는 확인되지 않았다. 컨센서스와 자동 모델 호출도 비용·약관을
  승인하기 전에는 추가하지 않는다.

## 방금 완료한 수정 (2026-08-06 투자 기능 4단계)

- **검증 평가점과 v6** — 저장 스키마를 v6으로 올리고 `performanceObservations`에
  당일 NAV, 미결제 금액, 누적 현금흐름, USD/KRW·벤치마크와 원장·가격 evidence·평가점 내용 fingerprint를
  저장한다. 가격표 로드, 원장 변경과 조회 기록 저장 때 같은 날짜의 평가점을 갱신한다.
  기존 단순 `snapshots`는 가격·원장 경계를 검증할 수 없어 수익률로 소급 변환하지
  않는다. 운영 성과는 앞으로 서로 다른 날짜의 완전한 평가점이 쌓인 뒤부터 계산된다.
  현재 원장 prefix와 평가점 내용은 다시 계산해 확인한다. 가격 evidence는 생성 당시의
  128-bit digest 기록이며 과거 시세 원본의 독립 재조회·감사 증명은 아니다.
- **평가점 보존 한도** — 클라우드 주 문서의 900KB 안전 여유를 위해 최대 300개를
  보존한다. 한도에 도달하면 기존 점은 그대로 두고 같은 날짜만 갱신하며, 새 날짜 점은
  만들지 않고 화면에 안내한다. 장기 이력은 별도 하위 컬렉션 구조가 필요하다.
- **TWR·XIRR** — `performance-engine.js`가 장 종료 후 현금흐름 정책으로 TWR을
  기하연결하고 실제 날짜의 투자자 현금흐름으로 XIRR을 계산한다. 입출금일의 완전한
  평가점이 하나라도 없으면 TWR·차트·위험 지표를 차단하지만 XIRR은 실제 날짜를
  계속 사용한다. XIRR의 복수 근·해 없음·반복 한도 초과는 임의 결과 없이 실패로
  표시한다.
- **성과 설명과 위험** — 시작·종료 NAV 차이를 순입출금, 잔여 투자효과(추정), 환율,
  수동평가, 배당·이자, 수수료·세금의 가치변화 브리지로 표시한다. 잔여 투자효과는
  독립적인 종목별 가격 기여도가 아니라 다른 항목을 차감한 값임을 화면에 명시한다. TWR 누적 지수로 최대
  낙폭과 고점·저점·회복 여부·회복 기간을 계산하며, 변동성은 충분한 정규 관측이
  있을 때만 표시한다.
- **벤치마크 방법론** — 가격 생성기에 KOSPI와 S&P 500 가격지수를 추가하고 가격이
  조정 전 종가·배당 제외임을 metadata로 보존한다. 둘 다 배당 제외 비교이며 S&P 500은
  평가일 USD/KRW로 원화 환산한 비헤지 지수다. 날짜·통화·방법론·환율 날짜를 모두
  검증하지 못하면 비교값을 표시하지 않는다.
- **표준 CSV v1** — `broker-csv-engine.js`와 독립 표준 어댑터가 파일 형식·계좌/CASH
  매핑·중복·충돌·행별 오류와 예상 변화를 미리 보여준다. 잘못된 행은 제외하고 유효한
  행만 증분 후보로 유지하며, 적용 직전 JSON 백업과 후보 원장 전체 투영이 성공해야
  저장한다. 동일 원본 ID 또는 경제 fingerprint는 중복 제외하고 같은 원본 ID의 내용
  변경은 충돌로 차단한다.
- **개인정보·용량 경계** — CSV 원문은 미리보기 동안 브라우저 메모리에만 두고 닫을
  때 제거한다. 계좌 참조는 매핑에만 쓰며 원장·오류 로그에 복사하지 않는다. 파일은
  15MB·50,000행, 기존 이벤트를 포함한 전체 원장은 50,000건으로 제한한다. 현재
  내장 형식은 AssetTrail 표준 거래 CSV v1이며 개별 증권사 원본 형식은 후속 어댑터
  또는 사전 변환이 필요하다.
- **검증 범위** — `npm run test:performance`, `npm run test:broker-csv`,
  `npm run test:prices`, `npm run test:price-requests`, v6 데이터·클라우드 회귀와
  `npm test` 전체가 필수 검증이다. 최종 명령 실행 결과와 운영 적용 여부는 해당
  작업의 최종 보고에서 확인한다.

## 방금 완료한 수정 (2026-08-05 투자 기능 3단계)

- **결정론적 원장** — `ledger-engine.js`가 매수·매도, 입출금·배당·이자·수수료·
  세금, 분할·평가조정·FX와 내부 기초잔액·취소 이벤트를 검증하고 포지션 수량,
  평균원가와 CASH 원화 잔액을 투영한다. 같은 계좌의 원본 ID 중복, 기준일 이전
  거래, 초과 매도·음수 현금과 끊어진 자산·CASH 참조를 차단한다.
- **거래·현금흐름 화면** — 매수·매도 시 결제 CASH를 선택하며 거래 자산과 현금
  변화를 하나의 후보 상태로 저장한다. 원장 탭에서 입금·출금·배당·이자·수수료·
  세금과 MANUAL 평가조정을 기록하고 정합성 상태를 확인한다. 수정·취소는 원본을
  덮어쓰거나 삭제하지 않고 정정·취소 이벤트를 추가한다.
- **오등록 복구와 중복 방어** — 기초잔액만 있는 MARKET 티커는 기초잔액 정정
  이벤트로 수정하고, 잘못 만든 자산은 기초잔액 취소 이력을 남겨 정리한다. 후속
  거래가 있는 자산은 해당 거래가 취소됐더라도 계속 잠근다. UI의 같은 자산 재등록과
  가져오기의 중복 자산 identity·컬렉션 ID는 상태 변경 전에 거부한다. 거래 취소는
  연결 실현손익·매매일지 상태와 `CANCEL`을 같은 후보 상태로 검증한다.
- **통화 경계** — US 거래의 native 가격·통화와 거래 당시 환율은 감사 정보로
  보존하고 수수료·세금과 결제 CASH는 원화로 정산한다. 현재 CASH 자산은 원화 단일
  잔액이다. 기존 US 기초잔액에는 알 수 없는 과거 환율을 넣지 않으므로 이전 구간의
  원화 원가와 성과는 미확정으로 남는다.
- **v5 이전과 내구성** — 저장 스키마를 v5로 올리고 기존 자산마다 매수 이력을
  추정하지 않는 기초잔액을 만들었다. 로컬 원본 백업을 쓰고 다시 읽어 검증하며,
  클라우드 이전·강제 충돌 업로드 전에는 변경 불가능한 주 문서 백업을 남긴다.
  기존 `realizedTrades`는 현재 보유에서 이중 차감되지 않도록 SELL 이벤트로 재생하지
  않는다.
- **클라우드 원장 세대** — 이벤트를
  `users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}`에 저장하고
  주 문서에는 고정 fingerprint와 활성 세대 manifest만 둔다. 주 문서→events→주
  문서를 최대 3회 확인하며, 400건 이하는 자산·CASH·revision과 같은 transaction으로
  저장한다. 400건 초과 교체는 새 세대에 staging한 뒤 manifest를 원자적으로 전환해
  실패한 세대가 활성 원장에 섞이지 않게 한다.
- **검증** — `npm test` 전체와 Firestore Rules 에뮬레이터를 통과했다. Chrome
  1440px·1280px·390px·430px에서 거래 원장, 매수·매도와 현금흐름 폼을 확인해 가로
  오버플로·브라우저 오류가 없고 모바일 주요 컨트롤이 44px 이상임을 확인했다.
- **배포 상태와 다음 작업** — 커밋·푸시·운영 배포는 하지 않았다. 강화한
  `firestore.rules`는 앱보다 먼저 운영 Firebase 프로젝트에 인증 배포하고 접근
  경계를 확인해야 한다. 일상 화면의 SPLIT·FX 직접 입력과 과거 거래 CSV 재구축,
  TWR·XIRR은 4단계 이후 범위다.

## 방금 완료한 수정 (2026-08-05 투자 기능 2단계)

- **신규자금 배분** — `action-engine.js`가 국내·해외·현금·수동 자산군의
  최소·목표·최대 밴드 안에서 최소 부족 → 목표 부족 → 최대 여유 순으로 일회성·월
  정기 신규자금을 원 단위 배분한다. 총액 또는 제약을 충족하지 못하면 부분안을
  만들지 않고 이유를 표시한다. 신규자금은 1원 단위 정수만 허용하고 시장 자산의
  평가금액이 누락되면 불완전 총액으로 계산하지 않는다. 결과는 특정 종목 주문 지시가
  아닌 자산군별 검토 예산이며 가격·수수료·종목 선택을 반영하지 않는다.
- **실질노출·위험 지도** — 자산 상세에 업종·국가·통화·금리·듀레이션·고객·AI
  가치사슬 태그를 추가했다. 같은 시장 티커의 여러 계좌는 공유 프로필과 하나의
  경제적 포지션을 사용한다. 태그에는 포지션 전체 평가금액을 표시하고, 중복 가능한
  비가산 값임을 안내한다. 코어 최소, 위성·AI 구조적 성장·사이클 최대 위험예산과
  태그 누락·오래된 검토·평가 누락 경고를 함께 표시한다.
- **데이터 호환성** — 스키마를 v4로 올리고 `policyProfile.allocationBands`,
  `policyProfile.riskBudgets`, `contributionPlan`, `decisionProfiles.riskTags`를 로컬,
  클라우드, 내보내기·가져오기와 충돌 fingerprint에 포함했다. 버전 없음·v1~v3은
  자동 이전하고 미래 버전 쓰기 차단은 유지한다. 계산 결과는 저장하지 않고 입력과
  정책만 저장한다.
- **검증** — 배분·위험 엔진과 앱 통합 테스트, 기존 의사결정·가격·심볼·클라우드·
  충돌·데이터·Python 가격 품질 테스트를 통과했다. OpenJDK 21을 명시한 Firestore
  Rules 에뮬레이터도 통과했다. Chrome 실화면은 1440/1280/390/430px에서 가로
  오버플로·중복 ID·브라우저 오류가 없고 모바일 제어가 44px 이상임을 확인했다.
  `npm audit --audit-level=high`는 high 이상 0건으로 성공했으며 Firebase CLI
  전이 의존성의 moderate 5건은 강제 하향 설치 없이는 해소되지 않아 남겼다.
- **배포 상태와 다음 작업** — 커밋·푸시·운영 배포는 하지 않았다. 다음 작업은
  `docs/INVESTMENT_FEATURE_TODO.md`의 3단계 거래·현금흐름 원장이다. ETF 구성종목
  자동 투시와 태그별 부분 노출률은 5단계 범위다.

## 방금 완료한 수정 (2026-08-05 투자 기능 1단계)

- **의사결정 모델** — 보유 행 `assetId`, 시장·티커 기반 `instrumentKey`, 공유 판단
  프로필 `subjectKey`, 관심종목 `watchlistItemId`와 향후 원장 `eventId`의 경계를
  분리했다. 같은 시장·티커를 여러 계좌에서 보유하면 하나의 판단 프로필을 공유하고,
  CASH·MANUAL 자산은 개별 자산 ID를 유지한다.
- **데이터 호환성** — 스키마를 v3로 올리고 `decisionProfiles`와 `watchlist`를 로컬,
  클라우드, 가져오기·내보내기, 충돌 fingerprint에 포함했다. v2 자산에 포함된 기존
  의사결정 별칭도 공유 프로필로 자동 이전한다. 동일 종목의 계좌별 기존 판단이
  다르면 모든 원본을 `migrationConflicts`에 보존하고 상세에서 비교하게 한다. v3를
  모르는 구버전 클라이언트와 현재 앱보다 새로운 로컬·원격 스키마는 자동 pull·push를
  중단해 새 컬렉션이나 원본을 조용히 지우지 않는다. 자산 티커를 기존 판단이 있는
  종목으로 변경해도, 이전 판단의 마지막 참조가 사라질 때는 대상 프로필의 비교
  원본으로 보존한다. 다른 계좌가 이전 종목을 계속 보유하면 양쪽 판단은 섞지 않는다.
- **화면과 행동** — 자산 상세에 역할·가설·기대수익 원천·KPI·촉매·무효화·감속
  조건·검토일을 추가했다. 검토기한 초과 항목은 대시보드 최우선 할 일에서 정확한
  자산 판단 폼으로 이동한다. 긴 폼의 미저장 변경은 닫기·다른 작업 전 확인하며,
  저장 후 스크롤·포커스와 드로어 내부 상태 알림을 보존한다.
- **관심종목과 집중도** — 관심종목은 총자산·집중도에서 제외한다. 결정론적
  `decision-engine.js`가 계좌별 동일 종목을 합산해 Top 1, Top 5, HHI, 유효 포지션
  수와 입력 품질 경고를 계산한다. 이미 보유한 종목의 신규 관심종목 등록은 공유
  판단을 실수로 덮지 않도록 차단하고, 전량매도 뒤 남은 판단과 다시 연결할 때는
  기존 내용을 불러올지 선택하게 한다. 새 초안을 유지하면 기존 판단을 나란히
  보여주고 재저장 전까지 어느 쪽도 잃지 않는다. TWR·XIRR·ETF 투시·AI 결론은
  1단계 범위에 포함하지 않았다.
- **검증** — 의사결정 엔진·앱 통합·v2→v3 마이그레이션·클라우드·XSS·중복 티커·
  검토 완료·미저장 이탈 방지 테스트를 통과했다. 기존 전체 JS/Python 테스트와
  Firestore Rules 에뮬레이터 테스트도 통과했고, Chrome 실화면을
  1440/1280/390/430px에서 확인해 가로 오버플로와 런타임 오류가 없었다.
- **배포 상태** — 커밋·푸시·운영 배포는 하지 않았다. 다음 작업은
  `docs/INVESTMENT_FEATURE_TODO.md`의 2단계 신규자금 배분과 수동 실질노출·위험
  태그다.

## 반드시 지킬 제약
- 기존 사용자 데이터·Firestore 사용자별 분리(`storageKeyForUser`) 구조를 깨지 않는다.
- prices.json 기반 KRX/US 평가, CASH/MANUAL 수동평가(amount) 모델을 유지한다.
- Alpha Vantage·환율 수동입력·대량등록은 재추가하지 않는다.
- React/Tailwind 대전환은 단계적 검토 후. 변경은 작은 단위로.
- 수정 후 `npm run check:js` + `npm run test:prices` (가능하면 `npm test`) 실행. `npm test`의 firestore `PERMISSION_DENIED` 로그는 규칙 검증의 정상 출력.

## 방금 완료한 수정 (2026-07-30 안정화 1~5단계)

- **운영 기준선** — 운영 `main`과 대규모 초안 PR #6을 분리해 점검했다. PR #6은
  백엔드 재배포·인증 E2E·보안 검증 전까지 별도로 유지한다.
- **정확성** — 은퇴 프리셋 즉시 저장·재계산, 불완전 가격 스냅샷 차단, US 손익의
  환차손익 제외 표기, 자산·목표 비중·은퇴 입력 범위 검증을 추가했다.
- **데이터 내구성** — `schemaVersion: 2`, compact snapshot, legacy 마이그레이션,
  15MB 가져오기 구조·개수 검증, 교체 전 자동 백업, 저장 실패 노출, 900KB
  클라우드 한도와 revision 충돌 방어를 추가했다. 가져온 데이터를 로컬에 쓰지
  못하면 성공 표시 없이 기존 화면 상태로 되돌린다.
- **동기화 충돌 UX** — 커스텀 대화상자에서 클라우드 가져오기·이 기기 데이터
  올리기·나중에 결정하기를 선택한다. 앞의 두 경로는 로컬 JSON 백업이 성공해야
  진행하고, 나중에 결정한 동안에는 자동 클라우드 쓰기를 멈춘다.
- **가격·배포** — 가격 품질 게이트(7일 이내 KRX 유효 가격 3,000개,
  USD/KRW 범위·실거래일, `tickers.json` US 성공률), 원자적 생성, 재사용 실패 시
  배포 중단을 추가했다. 비신뢰 공유 가격 요청은 앱·생성기에서 제거하고
  `priceRequests/**`를 Rules에서 전면 차단했다.
  `prices.json`과 minified `symbols.json`을 분리해 초기 파일은 운영 데이터 기준
  약 3.18MB→0.76MB로 줄이고 심볼은 자산 입력 때 한 번만 지연 로딩한다.
- **보안·CI** — Firestore 경로를 명시적으로 제한하고 Rules 에뮬레이터 테스트,
  데이터·충돌·심볼 테스트, high 이상 의존성 감사, 최소 Actions 권한, Node 22,
  Dependabot을 CI에 포함했다.
- **접근성·모바일** — 내비·투자기록 roving tabindex, 드로어 포커스 트랩·복귀,
  표 caption/scope, 차트 대체 설명, 모바일 목표 패널 전환, 포트폴리오 분석 접기,
  44px 터치 대상, safe area, 숨김 상태에서 backing store가 커지지 않는 DPR 대응
  히스토리 차트를 반영했다.
- **검증** — JS·Python·Firestore 전체 테스트와 `npm audit --audit-level=high`,
  YAML 파싱, `git diff --check`를 통과했다. Chrome 실화면은 1440/1280/390/430px와
  충돌 대화상자를 확인했고 모든 기준 폭에서 가로 오버플로가 없었다.
- **남은 외부 설정** — 연결된 GitHub 도구가 저장소 ruleset/branch protection
  쓰기 API를 제공하지 않고 로컬 `gh` 인증도 유효하지 않아 `main` required check
  설정은 적용하지 못했다. 로컬 Firebase CLI에도 인증 계정이 없어 강화한 Rules의
  운영 배포는 남아 있다. 코드상 PR·`main` 배포 게이트는 동일한 `test` job이다.

## 방금 완료한 수정 (디자인 3차: 색·크기 토큰 일원화, 커밋 8682441·ed7b402, dev 미푸시)
- **색상 (8682441)** — styles.css의 hex 42곳(20종)을 전부 토큰 참조로 치환, 잔여 hex 0. 흰색 계열 7종→surface 토큰 수렴. 토큰 신설: `--up-200`(#a7f3d0)·`--down-200`(#fecaca)·`--warn-200`(#fde68a)·`--warn-800`(#92400e). 근사 치환(±색조 미세): #fed7aa→warn-200, #f8fbff류→surface-2, #eef2f5/#e5edf7→surface-3, #c7d3df→slate-300. rgba/그라디언트는 범위 제외.
- **크기 (ed7b402)** — font-size 98곳 토큰화. 신설 `--fs-caption-sm`(12px), `--fs-h2` 24→20px(방향 B 기준으로 토큰을 현실에 맞춤). 임의 half값(10.5/11.5/12.5/13.5/14.5)과 10px·16px은 최근접 토큰으로 정규화(최대 1px). **잔여**: 22/24/26/30px 통계 숫자 + hero clamp 2곳 — 통계 스케일 토큰은 추후. font-weight 650/750 비표준 2곳, spacing(--space-*) 일원화도 미착수.
- **캐시 주의**: styles.css의 `@import "./assettrail-tokens.css?v=..."`에 버전 쿼리 추가 — 토큰 파일 갱신 시 이 버전도 같이 올려야 함(index.html의 ?v=와 별개). 현재 `20260710-tokens`.
- **검증**: npm test 전체 통과 + 전 화면 재캡처 육안 비교(시각 회귀 없음).

## 방금 완료한 수정 (디자인 2차: P1 + 데스크톱 밀도 1단계, 커밋 53b6b31~615d0dc, dev 미푸시)
- **모바일 상단바 압축 (53b6b31)** — 720px 이하에서 제목 32→24px, 장식 부제(`.topbar-copy`) 숨김, 상태 표시 세로 쌓기→가로 배치, 버튼 42→38px. 상단바 점유 약 절반으로.
- **조회 기록 날짜 분리 (45091e7)** — `historyDateParts()`로 날짜(YYYY. M. D.)와 시간(HH:MM)을 `.history-when`+`small`로 분리. 데스크톱 한 줄, 모바일은 시간 숨김. 3줄 줄바꿈 해소.
- **일지 삭제 톤 다운 + 문구 (8c4e5e7)** — 일지 카드 삭제 버튼 danger→quiet(확인 창 유지). "포트 분석"→"포트폴리오 분석". 도넛 라벨은 `regionLabel()`(app.js ~1232)이 소스 — "기타"→"현금·수동". **주의: `REGION_LABELS.OTHER`(일지 지역 구분)는 별개라 "기타" 유지.**
- **데스크톱 밀도 1단계 (615d0dc)** — 방향 B 적용: 패널 24→20, 여정카드 18→16, 메트릭 22→18, 히어로 26/28→22/24, h2 23→20px, 표 셀 15/16→12/14. 핵심 숫자(hero-total 등) 크기 유지. 캐시버스터 `20260710-design2`.
- **검증**: 단계별 check:js+관련 테스트, 최종 `npm test` 전체 통과. CDP 헤드리스 재캡처(모바일 대시보드 3,922→3,622px, 데스크톱 자산 표 밀도 확인).
- **다음 라운드 후보(P2)**: 토큰 일원화(하드코딩 색 61개·크기 20종), 접근성 패스(label for·필수 표시·인라인 오류·scope), 파비콘, alert→토스트, 모바일 포트폴리오 도넛 밀도.

## 방금 완료한 수정 (디자인 1차: 모바일 P0 + 결정 2건, 커밋 fb34ba4~449a70c, dev 미푸시)
- **디자인 방향 결정(사용자)**: B(데이터 밀도형) 채택, 다크모드 보류, 가격 상태 줄은 정상 시 회색 유지, 설정은 내비 탭으로.
- **모바일 자산 카드 압축 (fb34ba4)** — `renderAssetCard` 재구성: 값 없는 항목(티커/수량/손익)과 비활성 잠금 버튼 제거, 손익을 평가금액 옆 인라인(`.asset-card-gain`), 메타는 칩 flex, 버튼 4개 가로 1줄(flex). 카드 gap 14→10, padding 16→14. 자산 화면 전체 높이 6,482→4,446px.
- **모바일 조회 기록 표 (d56922f + 449a70c)** — 720px 이하에서 직전 대비·메모 열 숨김(nth-child 3·5), 글자 12.5px. **주의: 전역 `table { min-width: 1120px }`(styles.css ~1077)가 모든 표를 밀어내는 원인이었음** — `.history-table table { min-width: 0 }`으로 해제해야 열이 보임. 남은 다듬기: 날짜가 3줄로 줄바꿈됨(시간 부분을 span으로 분리해 모바일에서 숨기면 해결).
- **빈 상태 목표 모듈 (3df39c8)** — `retirementConfigured()`(기본값과 숫자 비교)가 false면 goal-card에 `.goal-unset` 클래스 + 안내 문구(`#dashboardGoalGuide`) 표시, 진행률·남은 금액 숨김. 기본값과 동일하게 입력한 사용자는 미입력으로 간주되는 한계 있음.
- **설정 탭 추가 (d52866a)** — `.app-nav`에 6번째 버튼(data-nav-view="SETTINGS"). `els.appNavButtons`가 `[data-nav-view]` 전체 수집이라 자동 배선. 상단 톱니는 지름길로 유지.
- **가격 상태 줄 회색화 (c7f5e1d)** — `renderOpsStatus`에 has-issues 판정(오류>0, 가격표/환율 3일 초과, 누락) 추가, `.ops-status` 기본 회색 + `.has-issues`만 앰버. 캐시버스터 `20260710-mobile`.
- **검증**: 단계별 check:js+test:prices, 최종 `npm test` 전체 통과. CDP 헤드리스(390px 모바일 에뮬레이션 + 시드 데이터)로 자산·목표·대시보드 빈 상태 재캡처 육안 확인.
- **디자인 문서**: 전체 진단(P0~P2, 방향 A/B/C)은 이 세션 대화에 있음. 다음 라운드 후보: 모바일 상단바 압축(P1-1), 일지 삭제 버튼 톤 다운(P1-3), "포트 분석" 문구·도넛 "기타" 라벨(P1-4), 방향 B 밀도를 데스크톱에 확장.

## 방금 완료한 수정 (공식 프롬프트 자산 추가)
- `prompts/`를 공식 프로젝트 자산으로 보고, AssetTrail 내보내기 JSON과 함께 쓰는 프롬프트 2개를 추가.
- `prompts/포트폴리오-리뷰.md`: 자산배분, 집중도, 보유 자산 역할, 투자 행동과 성과 연결, 리밸런싱 우선순위 점검.
- `prompts/은퇴가정-점검.md`: FIRE 관점의 은퇴 시점, 월 지출, 기대수익률, 물가, 인출률, 현금흐름 취약점 점검.
- `prompts/README.md` 목록에 두 프롬프트를 공식 항목으로 추가.
- 검증: `npm run check:js` 통과. 앱 코드 변경이 아니라 전체 테스트는 생략.

## 방금 완료한 수정 (성능·Firestore 비용 최적화 8단계, 커밋 e94de0b~2bb0782, 미푸시)
- **키 입력당 클라우드 저장 버그 수정 (e94de0b)** — `addEventListener("input", render)`로 InputEvent가 `syncCloud` 인자에 들어가 은퇴·목표 비중 입력의 키 입력 1회 = setDoc 1회이던 버그. input→`render(false)`, change→`render()`로 분리.
- **pushCloudData dirty-check (46047ee)** — `dataFingerprint` 비교로 동일 데이터면 setDoc 스킵(`upload` 방향은 강제). `syncPriceRequests`도 티커 목록 비교 스킵. 캐시는 `cloud.lastPushedFingerprint`/`lastSyncedPriceTickers`, 로그인 전환 시 리셋·pull 후 세팅.
- **push debounce 2초 + flush (dce302e)** — `render`의 즉시 push → `scheduleCloudPush()`. `window.assetTrailCloudPushDelayMs`로 테스트 오버라이드(cloud-sync 테스트에 0 설정). visibilitychange(hidden)·pagehide·로그아웃·수동 동기화 직전 `flushCloudPush()`, 계정 전환 시 `cancelCloudPush()`. localStorage `persist()`는 즉시 유지.
- **렌더-저장 분리 (aa3a977)** — `renderRetirement`→`saveRetirementInputs`, `renderRebalanceSummary`→`savePortfolioTargets` 호출 제거, 입력 핸들러에서 명시 호출. `syncAssetsBtn`도 값 변경 후 명시 저장. `currentRetirementScenarioInput`은 state만 읽음.
- **필터/검색 뷰 단위 렌더 (85a2fde)** — 자산 검색·필터 7종→`renderAssets()`, historyRange→`renderHistory()`, realizedYear→`renderRealized()`, journalFilter→`renderJournal()`. persist 불필요(uiState는 저장 대상 아님).
- **지연 렌더링 (dab6ddf)** — `VIEW_RENDERERS` 맵 + `dirtyViews` Set. `render()`는 활성 뷰만 즉시, 나머지는 `setActiveView` 진입 시. 부팅은 `renderAllViews()` 전체 1회. **테스트 계약 변경**: 숨겨진 뷰 DOM 검증엔 해당 뷰 전환 클릭 필요 — 4개 jsdom 테스트에 `[data-nav-view="X"].click()` 추가 + `HTMLElement.prototype.scrollIntoView` 목(jsdom 미구현).
- **Intl 포매터 호이스팅 (e07ff7b)** — `money` 등 10곳의 매 호출 `new Intl.*` → 모듈 상수 10종(KRW_FORMATTER 등).
- **중복 통합 (d307196, ac66c00, 2bb0782)** — `bucketTotals()`+`PORTFOLIO_BUCKETS`(합산 3곳→1곳, 순회 12→1회), 날짜 함수 7종의 검사 로직→`toDate`/`formatWithDateFormatter`, 매도·추가매수 폼 리셋→`resetTradeForm`.
- **검증**: 각 단계마다 관련 테스트 + 최종 `npm test` 전체(7종) 통과. 브라우저 육안 검증(1440/1280/390/430)은 미실시 — 다음 확인 권장.
- **스킵**: Phase 9(chartPalette getComputedStyle 캐시) — 지연 렌더링 후 효과 미미로 계획대로 생략.
- **커밋 분리 주의**: 이번 8커밋은 `app.js`+`tests/`만. 기존 미커밋 변경(AGENTS.md·CLAUDE.md·이 문서·prompts/)은 의도적으로 미포함, 푸시도 안 함.

## 방금 완료한 수정 (UI/UX 다듬기 5건, 커밋 4ae7cd2 배포됨)
- **뷰별 상단 제목/부제** — 모든 화면이 "나의 자산 대시보드"로 고정되던 문제. `index.html` H1/부제에 `#pageTitle`/`#pageSubtitle` 부여, `app.js` `VIEW_HEADINGS` 맵 추가 + `setActiveView`에서 갱신. `render()`→`setActiveView` 경로라 초기·딥링크·뒤로가기 모두 반영.
- **히어로 "오늘"→"직전 대비"** — `index.html` `hero-chip-label`. 계산(`renderSummary`, 현재 총액 − 마지막 스냅샷)은 불변, 라벨만 정정(조회 히스토리 표 "직전 대비"와 용어 일치).
- **자산 행/카드 액션 정리** — `renderAssets`(표 행)·`renderAssetCard`에서 수정·삭제 인라인 제거하고 `data-action="detail"` "상세" 버튼으로 통합(상시 노출 빨강 삭제 제거). `handleAssetAction`에 `detail`→`openAssetDetail` 분기 추가(상세 드로어에 추가매수·매도·일지·수정·삭제 5액션 이미 존재). 시장자산=추가매수·매도·일지·상세, 현금/수동=일지·상세.
- **포트폴리오 목표 차이 색 분리** — `renderRebalanceSummary` tone을 `positive/negative`(초록/빨강) → `on-target`/`off-target`로. `styles.css` `.composition-value.off-target`(앰버 `--amber`)/`.on-target`(`--muted`) 추가. 부족/초과 모두 앰버라 손익 색(초록/빨강)과 분리. 대시보드 `renderDashboardComposition`은 원래 무색이라 변경 없음.
- **자산 고급필터 접기** — `index.html` `ledger-toolbar`를 검색+`#ledgerFilterToggle`("필터")+카운트 / `#ledgerAdvancedFilters`(유형·계좌·상태·손익·정렬 5 selects, `hidden`)로 분리. `styles.css` `.ledger-toolbar` 3칸 그리드 + `.ledger-advanced`(auto-fit) + `.filter-toggle`(펼침/적용 시 파란 강조), 중간폭 그리드 오버라이드(1100/900)에서 `.ledger-toolbar` 제외, 모바일(720) flex-wrap + `.ledger-advanced` 2칸. `app.js` els 2개 + 토글 핸들러(hidden/aria-expanded) + `updateLedgerFilterIndicator`("필터 · N", `renderAssets`에서 호출).
- 캐시버스터 `20260628-journal`→`20260628-uxfix`(`styles.css`, `app.js` 두 곳).
- **검증**: `check:js` + `test:prices`/`test:price-fallback`/`test:cloud`/`test:cloud-prices`/`test:price-requests` 통과. 시드 데모 + 헤드리스 Chrome로 데스크톱 1440 / 모바일 390(CDP `Emulation.setDeviceMetricsOverride`) 재캡처 육안 확인 — 자산(제목·액션·필터 접힘/펼침), 포트폴리오(제목·앰버), 대시보드(직전 대비).
- **실행 못한 검증**: `test:firestore` 생략(Rules·데이터 범위 미변경 + 에뮬레이터/Java 필요). 빈 상태·로그인 후 상태는 시드 데모로만 봐서 별도 미검증.
- **커밋 분리 주의**: 이 커밋은 `app.js`/`index.html`/`styles.css`만. 작업 중 `deploy-pages.yml`·`AGENTS.md`·`CLAUDE.md`·`tests/app-cloud-prices`·`tests/app-cloud-sync`·`tests/app-prices`·`prompts/`가 다른 손(동시 도구/이전 세션)으로 미커밋 변경되어 있었고, 의도적으로 미포함.

## 방금 완료한 수정 (투자기록 개편 + 대시보드 박스 넘침, 커밋 7e89616 배포됨)
- **매매일지 카드 개편** — 좌측 색 띠 제거(`.journal-card.review/.done` border-left 규칙 삭제, padding 16px 18px). 상태 배지를 `.journal-badge.status` 단일 → `.status-open`(파랑)/`.status-review`(주황)/`.status-done`(초록)로 분리. `renderJournal`이 `status-${status.toLowerCase()}` 클래스 출력. 매수/매도 배지는 중립(`--surface-3`). 이유·리스크·복기는 `<p><strong>` → `.journal-note > .journal-note-label + p`(키커+본문, 3줄 clamp). 빈 상태는 `.empty-state`(아이콘+안내+작성 유도)로 교체.
- **실현손익 표 11→5열 통합** — `index.html` thead 5개(매도일·종목 / 수량·매도가 / 매도금액 / 실현손익 / 일지), `emptyRealizedTemplate` colspan 11→5. `renderRealizedRows`가 5 `<td>` 출력(종목+`.realized-sub`로 날짜·티커·계좌 묶음, 실현손익 ▲/▼ 부호·색). `styles.css` 끝에 `.journal-note*`/`.realized-sub`/`.realized-date`/`.realized-account`/`.realized-table table{min-width:640px}` 추가.
- **대시보드 "최근 기록" 박스 넘침 해결** — `.dashboard-module`(그리드 아이템이자 그리드 컨테이너)에 `min-width:0`+`grid-template-columns:minmax(0,1fr)`, `.recent-record-list`에 `grid-template-columns:minmax(0,1fr)` 추가. 암시적 auto 트랙이 max-content로 부풀어 텍스트 ellipsis가 안 먹던 문제 해결. 1440px moduleScrollW 526≤528, 390px 가로 스크롤 없음 실측.
- 검증: `npm run check:js` 통과. 프리뷰(1440/390)에서 일지 카드·실현 표 헤더(5열)·최근 기록 클리핑 확인. 배포 성공 후 작업 파일 `app1.js`/`index1.html`/`styles1.css` 삭제. 캐시버스터 `20260628-journal`.

## 방금 완료한 수정 (P0, `app.js`)
1. **대시보드 "최근 투자 기록" 카드가 항상 "자산"으로 표시** — `recentEntry.assetName`/`recentTrade.assetName` → `name`(저장 객체의 실제 필드). app.js 1251/1254. 화면으로 `매수 · 삼성전자` 정상 표시 확인.
2. **자산 화면에서 "일지" 클릭 시 무반응** — `handleAssetAction`의 journal 분기에 `setActiveView("JOURNAL", { scroll: true })` 추가. 숨겨진 JOURNAL 섹션에 폼이 열리던 문제 해결. app.js ~3135.

## 완료한 수정 (P1-3, `app.js`)
- **뷰 상태 URL/History 연동** — 해시 기반 라우팅 도입(GitHub Pages 정적 호스팅이라 path pushState는 새로고침 404 → 해시 선택). `viewHash()`/`viewFromHash()` 헬퍼(app.js ~54), `setActiveView`에 `updateHash` 옵션(같은 뷰면 중복 항목 X, `render()`의 호출은 히스토리 미오염), 유저 네비 2곳에 `updateHash:true`, 부트스트랩에서 해시→activeView 복원 + `replaceState` + `popstate`/`hashchange` 리스너. 검증: 최초 `#dashboard`, 네비 클릭 시 해시/히스토리 갱신, 뒤로가기 복귀, 딥링크 새로고침 복원, 잘못된 해시는 대시보드 폴백. 헤드리스 실측 통과. (커밋 d8c8ffa, 배포됨)

## 완료한 수정 (P1-2)
- **토픽바 과밀 → 운영 액션을 설정으로 실제 이동** — 토픽바는 가격/클라우드 상태 표시 + Login/Logout만 남기고, 가격갱신(`priceRefreshBtn` "최신 가격 확인")·동기화(`cloudSyncBtn` "지금 동기화", 로그인 시 노출)·내보내기(`exportBtn`)·가져오기(`importInput`/import-label)를 설정 패널의 클라우드/가격표/데이터 카드 안 **실제 컨트롤**로 이동. 기존 설정의 프록시 버튼(중복) 제거 + `app.js`의 죽은 `data-focus-control`/`data-trigger-control` 핸들러 삭제. 핸들러가 ID로 바인딩(`els.X = querySelector("#X")`)이라 DOM 이동해도 배선 유지. `styles.css` `.import-label` 스코프를 토픽바 한정에서 전역으로 일반화. 검증: 1440/390 헤드리스 — 토픽바 슬림화, 설정 3카드(로컬 저장/가격표/백업과 복원)에 컨트롤 정상 렌더. `check:js`/`test:prices`/`npm test` 통과.

## 완료한 수정 (P1-1)
- **데스크톱 대시보드 밀도** — 여정카드4 아래에 2모듈 행(`.dashboard-modules`, 3fr 2fr) 추가. 좌측 **포트폴리오 비중 가로막대**(국내/해외/현금/수동: 현재% 막대 + 목표 위치 마커 + "목표 초과/부족 N%p" 라벨, `renderDashboardComposition` app.js ~1281), 우측 **최근 기록 리스트**(매매일지+실현매도 병합·날짜 내림차순 최대 5건, `renderDashboardRecentList`). `index.html` dashboard-panel에 마크업, `styles.css`에 `.dashboard-modules`/`.composition-*`/`.recent-record-list` 추가(720px에서 1열로 collapse). 1440/390 헤드리스 + 빈 상태 검증 통과.

베이스라인: `check:js` / `test:prices` / `npm test` 모두 통과(exit 0).

## 완료한 정리 (AI 작업 구조)
- **AI 작업 문서 구조 개편** — `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DESIGN_REVIEW_GUIDE.md` 추가. 기존 상세 문서는 `docs/archive/`로 이동. 세션 요약 규칙과 첫 기록은 `docs/sessions/2026-06-27-ai-folder-reorg.md`에 추가. 문서 본문은 한국어 중심으로 정리. 검증: 오래된 활성 문서 경로 참조 없음, `npm run check:js` 통과.

## 이어서 할 일 (우선순위)

### P1
- ~~**데스크톱 대시보드 밀도**~~ — 완료(위 "완료한 수정 P1-1" 참고).
- ~~**토픽바 과밀 → 설정으로 실제 이동**~~ — 완료(위 "완료한 수정 P1-2" 참고).
- ~~**뷰 상태 URL/History 연동**~~ — 완료(위 "완료한 수정 P1-3" 참고).

### P2
- ~~카드 radius 토큰 통일~~ — 완료. `--radius-xl: 28px` 추가, 토픽바는 xl(28)로 위계 유지, 나머지 주요 카드(app-nav 20→24, journey/settings 22→24, metric/panel + 24px 카드 9종)는 `--radius-lg`(24)로 통일. 모바일 오버라이드도 토큰화(app-nav 도킹 상단 라운드 lg, topbar lg, journey md). `styles.css` :root + 각 카드.
- ~~히스토리 차트 디자인 토큰화~~ — 완료. `app.js`에 `CHART_FONT`(Pretendard 스택)·`chartPalette()`(--line/--muted/--slate/--green/--red를 `getComputedStyle`으로 읽음)·`hexToRgba()` 헬퍼 추가. drawChart/drawXAxisLabels/drawChartBadge의 하드코딩 `#dbe2dc`/`#65716a`/`#657386`/`rgba(101,113,106,*)`/`#44524a`/녹·적 라인색·`Segoe UI` 폰트를 전부 토큰 기반으로 교체. 시드 스냅샷 12건으로 1280 헤드리스 렌더 검증.
- ~~뷰 전환 접근성 보완~~ — 완료. `setActiveView`: 비활성 네비는 `aria-current="false"` 대신 속성 제거(활성만 `page`). 사용자 네비게이션(네비 클릭/일지 분기/popstate/hashchange)에 `focus:true` 추가 → 활성 뷰의 첫 섹션·헤딩(`h1/h2/h3` 폴백은 섹션)에 `tabindex=-1` 부여 후 `focus({preventScroll:true})`로 포커스 이동, `#viewAnnounce`(`role=status`/`aria-live=polite`, sr-only)로 "{뷰명} 화면" 안내. `render()`의 호출(1222)은 `focus` 미설정이라 매 렌더 포커스 가로채기 없음. `styles.css`에 프로그래매틱 포커스 아웃라인 제거 규칙 + `VIEW_LABELS` 맵 추가. 헤드리스로 aria-current/포커스/announce/뒤로가기 검증.
- ~~비-자산 뷰 빈 `.workspace` 죽은 여백~~ — 완료. `.workspace`는 ASSETS 패널만 감싸는 단일 래퍼인데 `display:grid`라 안쪽 패널만 `hidden`되면 래퍼의 `margin-bottom:20px`가 남았음. `data-app-section="ASSETS"`를 안쪽 `.panel.ledger-panel` → `.workspace` 래퍼로 이동해, 비-자산 뷰에서 전역 `[hidden]{display:none!important}`로 래퍼째 제거. 포커스 타깃은 래퍼 하위 `자산 원장` h2를 그대로 탐색. `index.html` ~124.
- ~~포트폴리오 목표 비중 막대화~~ — 완료(사용자 결정: 목표 비교만 막대로, 도넛 4개는 유지). 검토 결론: PORTFOLIO 도넛 4개는 계좌 분류/계좌별/상품 유형/국내·해외의 **다차원 분석**이라 막대로 통째 교체하면 정보 손실. 문서 권고 "가로 막대+목표 대비 차이"는 목표-실제 비교에 해당하므로, 목표 입력 아래 `renderRebalanceSummary`를 대시보드와 동일한 `.composition-*` 막대(현재%바 + 목표 마커 + 초과/부족 금액 톤 라벨 + "현재%·목표%·평가액" 메타)로 전환. 도넛 4종은 그대로. dead `.rebalance-row` CSS 제거(`.sensitivity-item`와 분리), `.rebalance-summary` gap 14px. 임시 prices.json + 4버킷 시드로 1280 헤드리스 검증(국내 초과/해외 부족 등 톤·마커·너비 확인).

### 시각 부채 (다음에 정리)
- "포트 분석" → "포트폴리오 분석" 카피(`index.html` PORTFOLIO 패널 h2).
- 자산 화면 알림 배너 2개(US 가격 대기 + 가격표 상태)를 한 줄 상태바로 통합.
- 모바일 목표 화면 조회 히스토리 표: 값 열(총자산·직전 대비·변동률)이 가로 스크롤 뒤로 숨어 날짜만 먼저 보임.
- 모바일 자산 카드 길이 압축(종목당 카드가 길어 9종목 리스트가 매우 김).

### 디자인 검토 방식 (Figma 금지)
시드 데이터 + Chrome 헤드리스 스크린샷으로 PC(1440/1280)/모바일(390/430) 실화면 검토. 큰 변경 전엔 정적 preview HTML로 먼저 시안.

**모바일 폭 함정**: 헤드리스 `--window-size 390 ...`은 폭을 **500px로 강제 레이아웃한 뒤 390으로 잘라** 캡처한다 → 가짜 우측 클리핑·"하단 내비 탭 누락"처럼 보인다. 진짜 모바일 폭은 CDP `Emulation.setDeviceMetricsOverride({width:390, mobile:true, deviceScaleFactor:2})` + `Page.captureScreenshot({captureBeyondViewport:true})`로 봐야 정확하다.
