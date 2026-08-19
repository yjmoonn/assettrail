# AssetTrail

AssetTrail은 GitHub Pages에 배포되는 정적 개인 자산 관리 앱이다. 현재 자산과 지난
기록 이후의 변화, 현금흐름과 투자 성과, 은퇴 목표까지의 거리를 한 달에 5분 안에
점검하는 것을 목적으로 한다. 종목 추천이나 자동매매가 아니라 사용자가 직접 관리하는
자산 원장과 월간 점검 기록이 제품의 중심이다.

라이브 앱: https://yjmoonn.github.io/assettrail/

## 사용 흐름

주요 내비게이션은 `홈 / 자산 / 기록 / 목표` 네 화면이며, 동기화·백업·가져오기와
AI 내보내기는 우측 상단 설정에서 관리한다.

1. `자산`에서 `KRX`, `US`, `CASH`, `MANUAL` 중 하나로 현재 보유 자산을 등록한다.
   같은 시장 티커라도 계좌가 다르면 별도 자산으로 관리할 수 있다.
2. `기록`에서 매수·매도와 입출금·배당·이자·수수료·세금을 남기고, 자산 수량과
   원화 현금 잔액의 정합성을 확인한다.
   - 거래 수정·취소는 원본을 삭제하지 않고 정정 또는 취소 이벤트를 추가한다.
   - 기존 보유분은 과거 매수를 추정하지 않고 원장 시작일의 기초잔액으로 기록한다.
   - 기초잔액만 있는 오등록 종목은 원본을 보존한 정정 이벤트로 티커를 바꿀 수 있고,
     잘못 만든 자산은 기초잔액 취소 이력을 남긴 뒤 목록에서 정리할 수 있다.
   - 같은 유형·종목·계좌의 중복 자산과 가져오기 파일의 중복 ID는 반영 전에 거부한다.
   - MANUAL 평가금액 수정도 원장 시작 후에는 평가조정 이벤트로 남는다.
3. 증권사 내역은 설정의 `증권사 CSV`에서 AssetTrail 표준 거래 CSV v1로 변환해
   미리본 뒤 증분 반영한다.
   - 계좌·결제 CASH 매핑, 중복·오류 행, 기간과 예상 현금·포지션 변화를 적용 전에 확인한다.
   - 적용 직전에 현재 데이터를 JSON으로 자동 백업하며 CSV 원문은 미리보기 동안
     브라우저 메모리에만 둔다.
4. `기록`의 `기간 성과`에서 TWR·XIRR, KOSPI·S&P 500 비교, 가치변화 브리지와
   최대 낙폭·회복·변동성을 확인한다.
   - 과거의 단순 조회 스냅샷은 수익률로 소급 변환하지 않는다. 정확한 성과는
     현재 원장 이력, 평가점 내용 무결성과 가격 metadata가 확인된 첫 평가점부터 쌓인다.
   - 입출금일에 완전한 평가점이 없으면 TWR은 표시하지 않는다. XIRR은 실제
     입출금 날짜를 사용해 별도로 계산한다.
5. `홈`에서 현재 총자산, 직전·첫 기록 대비 변화, 자산군 비중, Top 1·Top 5 집중도와
   은퇴 목표 진행률을 확인한다. 이번 달 결론과 다음 점검일을 적고 `이번 달 점검 저장`을
   누르면 같은 달의 월간 점검은 새 행을 늘리지 않고 갱신된다.
6. `목표`에서 은퇴 시점, 월 투자금·지출과 수익률·물가 가정을 조정해 현재 자산과
   필요자산의 거리를 확인한다.
7. 추가 해석이 필요하면 설정에서 `AI 점검 패키지 내보내기`를 누른다. 앱은 고정
   프롬프트와 상대 지표를 담은 `ASSETTRAIL_AI_REVIEW_V1` Markdown 파일만 만들며,
   사용자가 원하는 AI 서비스에 직접 첨부한다. 앱이 AI API를 호출하거나 결과를
   다시 가져와 저장하지 않는다.

기존 포트폴리오·의사결정·Butler·ETF 분석 화면은 현재 핵심 흐름에서 일몰했다. 기존
데이터는 마이그레이션 과정에서 삭제하지 않으며, Butler·ETF 확장 데이터는 설정의
`기존 확장 데이터 백업`에서 별도로 내려받거나 복원할 수 있다.

## 가격표 업데이트

가격표는 GitHub Actions가 하루 한 번 한국 시간 06:30에 생성한다.

- 국내 주식, ETF, ETN: KRX 전체 가격표를 자동 생성한다. ETF/ETN 코드는 `0092B0`처럼 영문이 섞일 수 있다.
- 미국 주식, ETF: 가격을 제공할 티커는 검토 가능한 `tickers.json`에서만 관리한다.
- 워크플로는 가격, 종목명, 상품 유형, `fx.USDKRW`를 포함한 `prices.json`을 만든다.
- 앱은 `prices.json`을 읽어 `KRX`와 `US` 자산의 평가금액과 손익을 계산한다. 미국 가격과 평단가는 달러 기준이며 `fx.USDKRW`로 원화 환산한다.
- 가격표는 조정 전 종가(`unadjusted_close`)이며 분배금·배당을 포함하지 않는다.
  같은 방법론을 평가점에 함께 보존해 성과 데이터의 기준을 검증한다.
- KOSPI와 S&P 500 벤치마크도 배당 제외 가격지수 수준이다. S&P 500은 각 평가일의
  USD/KRW로 원화 환산한 비헤지 비교이며, 포트폴리오 총수익률과 완전히 같은 기준은 아니다.
- `CASH`와 `MANUAL` 자산은 사용자가 입력한 수동 평가금액만 사용한다.
- 홈 화면은 계좌를 합친 국내/해외/현금/수동 비중과 Top 1·Top 5 집중도를 요약한다.

예시:

```json
{
  "KRX": [],
  "US": ["AAPL"]
}
```

미국 자산이 `가격 대기`로 보이면 운영자가 `tickers.json`에 티커를 추가한 뒤
가격표 생성 워크플로를 실행해야 한다. KRX 자산은 자동 생성된 KRX 가격표와
매칭된다. 배포된 앱은 `prices.json`의 가격 생성 오류도 화면에 표시한다.

## 예수금 잔액 관리

- CASH 자산 행에서 입금·출금·잔액 맞추기를 바로 시작할 수 있다.
- 기존 예수금은 금액을 직접 덮어쓰지 않는다. 실제 잔액과의 차이를 추가납입, 출금,
  배당, 이자, 수수료, 세금 또는 최초 등록금액 정정으로 기록해 연결된 매매 이력을
  보존한다.
- 원인을 아직 모르는 차액도 메모와 함께 임시 조정할 수 있지만, 해당 조정이 활성화된
  동안에는 정확한 성과 평가점을 만들지 않는다.
- 매수금액이 선택한 예수금보다 크면 부족금액을 같은 예수금에 입금한 뒤 매수하는 두
  이벤트를 한 번에 저장할 수 있다. 저장 직후 되돌리기도 두 이벤트를 함께 취소한다.

## 정확한 성과 기준

- TWR은 입출금 영향을 제거해 포트폴리오 운용 결과를 비교하는 기간 수익률이다.
- XIRR은 실제 입출금 날짜와 금액을 반영한 투자자 관점 연환산 수익률이다.
- 입출금일의 검증 평가점이 빠지면 TWR은 계산하지 않지만 XIRR은 실제 날짜로 계산한다.
- 최대 낙폭·회복·변동성과 벤치마크 비교는 TWR과 같은 검증 구간에서만 제공한다.
- 과거 `조회 기록`은 단순 자산 변화다. v6 업그레이드 이후 완전한 평가점이 서로 다른
  날짜에 쌓여야 기간 성과가 보인다.

## 표준 거래 CSV v1

설정 또는 거래 원장의 `증권사 CSV 가져오기`에서 `표준 CSV 양식`을 받을 수 있다.
지원 유형은 `BUY`, `SELL`, `DEPOSIT`, `WITHDRAWAL`, `DIVIDEND`, `INTEREST`, `FEE`,
`TAX`다. 주요 열은 아래와 같다.

```text
assettrail_version,transaction_id,type,trade_date,settlement_date,
account,cash_account,market,ticker,quantity,price,currency,fx_rate,
amount,fee_krw,tax_krw
```

`transaction_id`에는 증권사가 제공한 거래 고유 ID만 넣고 고객명·계좌번호·자유
메모는 넣지 않는다. `account`와 `cash_account`는 기존 AssetTrail 자산을 선택하기
위한 참조이며 원장에 저장되지 않는다. 파일은 15MB·50,000행 이하, 반영 후 전체
원장도 50,000건 이하여야 한다. 현재 내장 형식은 AssetTrail 표준 v1뿐이므로 개별
증권사 파일은 열 의미와 통화를 확인해 이 형식으로 변환해야 한다.

## AI 점검과 기존 확장 데이터 경계

- 설정의 AI 점검 내보내기는 `ASSETTRAIL_AI_REVIEW_V1` 데이터와 변경할 수 없는
  `ASSETTRAIL_MONTHLY_REVIEW_PROMPT_V1` 지침을 하나의 Markdown 파일로 만든다.
- 포함 범위는 자산군·포지션 상대 비중, 집중도, 검증된 성과율, 은퇴 목표 비율과 점검
  상태다. 계좌명, 사용자 식별자, 거래 행, 절대 금액, 수량과 자유 메모는 제외한다.
- 생성 과정은 모델 네트워크 요청과 앱 데이터 저장 쓰기를 하지 않는다. digest는
  `generatedAt`을 제외한 안정 콘텐츠의 canonical JSON SHA-256이다. 앱에는 API 키, AI 계정
  연동, 결과 가져오기·저장과 자동 주문 기능이 없다.
- 과거 Butler 기업 스냅샷과 ETF 카탈로그는 주 상태나 Firestore에 합치지 않고 기존
  사용자별 로컬 저장소에 보존한다. 현재 제품 흐름에서는 분석 UI를 제공하지 않으며,
  설정에서 별도 백업·복원만 지원한다.
- 이전 분석 엔진의 세부 계약과 보존 범위는
  [외부 데이터와 AI 가이드](docs/EXTERNAL_DATA_AND_AI.md)를 참고한다.

## 동기화

Firebase Auth와 Firestore가 자산, 거래·현금흐름 이벤트, 기존 의사결정 호환 데이터,
히스토리와 은퇴 설정을 로그인 사용자별로 동기화한다. 현재 저장 스키마는 v7이며 v6
이하 데이터는 검증 가능한 백업을 만든 뒤 현재 구조로 마이그레이션한다. 기존 분석·
의사결정 필드는 UI 일몰과 무관하게 그대로 보존한다. 현재 앱보다 새로운 로컬 또는
클라우드 스키마를 감지하면 원본을 보호하기 위해 자동 동기화 쓰기를 중단한다.

성과 평가점은 원장·가격 방법론·벤치마크·환율의 기준일과 fingerprint를 함께 저장한다.
현재 원장 이력은 다시 계산하고 평가점 내용 무결성도 확인한다. 가격 fingerprint는
생성 당시 근거의 128-bit digest 기록이며 과거 시세 원본을 독립적으로 다시 조회해
감사 증명하는 기능은 아니다.
기존 `snapshots`는 계속 조회 기록으로 보존하지만 `performanceObservations`로 자동
복제하지 않는다. 따라서 업그레이드 직후에는 첫 평가점만 보일 수 있으며, 서로 다른
날짜의 검증 평가점이 쌓여야 기간 성과를 계산할 수 있다.
v7은 조회 스냅샷과 성과 평가점을 최대 각각 10,000개까지 저장하고 가져온다. 로컬에서는
IndexedDB, 클라우드에서는 월별 history chunk 하위 컬렉션에 저장하고 주 상태에는
활성 세대와 fingerprint만 둔다. 성과 chunk는 월 최대 31개, 조회 스냅샷 chunk는 최대
50개·256KiB이며 크면 안정적인 해시 shard로 나눈다. 정상 JSON 전체 백업은 수동
내보내기와 가져오기·CSV·클라우드 충돌 전 자동 백업 모두 같은 공백 없는 portable JSON을
사용하며, 가져오기는 32MiB 이하 파일만 허용한다. JSON 내보내기·가져오기와
분리 세대가 아직 없는 신규·v6 데이터의 IndexedDB 미지원 경로는 평면 배열 호환 형식을
사용한다. 기존 v7 주 상태가 가리키는 IndexedDB 세대를 읽지 못하면 불완전 백업을 만들지
않도록 변경·동기화·전체 내보내기를 중단하고 기존 포인터를 보존한다.

원장 이벤트는 사용자 주 문서의 900KB 한도와 분리된 세대별 하위 컬렉션에 저장한다.

```text
users/{uid}/financeData/primary
users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}
users/{uid}/financeData/primary/histories/{historyId}/chunks/{chunkId}
```

US 거래의 수량·가격·거래통화와 당시 환율은 감사 정보로 보존하지만 현재 CASH 자산은
원화 단일 잔액이다. 따라서 매수·매도와 현금흐름은 명시적인 원화 정산액으로 CASH에
반영된다. 기존 US 기초잔액의 과거 환율은 추정하지 않으며, 이 구간의 원화 원가와
성과는 미확정 상태로 유지한다.

필수 Firebase Auth 허용 도메인:

```text
yjmoonn.github.io
```

## 운영

- GitHub Pages 배포는 `.github/workflows/deploy-pages.yml`에서 처리한다.
- 가격표는 일일 스케줄, 수동 가격 업데이트, 가격 입력/생성기 파일 변경 시에만 새로 생성한다.
- `app.js`, `decision-engine.js`, `action-engine.js`, `ledger-engine.js`,
  `performance-engine.js`, `broker-csv-engine.js`, `broker-csv-adapter-standard.js`,
  `external-data-engine.js`, `etf-exposure-engine.js`, `ai-report-engine.js`,
  `ai-review-export-engine.js`, `history-repository.js`,
  `index.html`, `styles.css` 같은 UI·계산 코드만 바뀐 배포는 기존 배포본의
  `prices.json`을 재사용한다.
- 가격 생성이 실패하면 GitHub Actions의 `Deploy GitHub Pages` 워크플로 실행 기록을 확인한다.
- 개인 포트폴리오 데이터는 로그인 사용자 본인만 접근할 수 있어야 한다.

```text
users/{uid}/financeData/primary
users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}
users/{uid}/financeData/primary/histories/{historyId}/chunks/{chunkId}
```

- 브라우저 보유정보로 가격 생성 입력을 자동 확장하지 않는다. `priceRequests/**`는
  읽기와 쓰기를 모두 차단하며, 가격 생성기는 저장소의 `tickers.json`만 신뢰한다.
- `firestore.rules` 변경은 에뮬레이터 테스트와 별도로 운영 Firebase 프로젝트에
  인증된 배포가 필요하다.
- 원장·성과 스키마를 운영에 올리기 전에는 강화된 `firestore.rules`가 운영
  Firebase 프로젝트에 반영됐는지 먼저 확인해야 한다.

## 보안 체크리스트

- `.env`, 서비스 계정 JSON, private key, Firebase Admin 인증 정보를 커밋하지 않는다.
- Firebase Auth 허용 도메인은 실제 배포에 필요한 도메인으로 제한한다.
- 앱 도메인이 안정되면 Google Cloud에서 Firebase 웹 API 키의 HTTP referrer 제한을 검토한다.
- 브라우저 앱에서 Firebase 웹 설정값이 공개되는 것은 정상이다. 실제 데이터 보호 경계는 Firestore Rules다.

## 검증

전체 로컬 검증:

```sh
npm test
```

월간 점검·AI 내보내기·장기 히스토리만 좁게 확인할 때:

```sh
npm run test:product
npm run test:ai-review
npm run test:history
```

레거시 외부 데이터·ETF·기존 AI 저장 호환만 좁게 확인할 때:

```sh
npm run test:external-data
npm run test:etf
npm run test:ai
npm run test:stage5
```

변경 유형별 검증 기준은 [테스트 가이드](docs/TESTING.md)를 참고한다.

## 프로젝트 문서

- [AI 공통 작업 규칙](AGENTS.md)
- [Claude Code 작업 규칙](CLAUDE.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [과거 투자 기능 로드맵](docs/INVESTMENT_FEATURE_TODO.md)
- [외부 데이터와 AI 가이드](docs/EXTERNAL_DATA_AND_AI.md)
- [테스트 가이드](docs/TESTING.md)
- [디자인 리뷰 가이드](docs/DESIGN_REVIEW_GUIDE.md)
- [제품 경험 리디자인](docs/PRODUCT_EXPERIENCE_REDESIGN.md)
- [핸드오프 노트](docs/HANDOFF_NOTES.md)
- [세션 요약 기록](docs/sessions/README.md)

상세 과거 문서는 `docs/archive/`에 보관한다.
