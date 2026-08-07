# AssetTrail

AssetTrail은 GitHub Pages에 배포되는 정적 개인 자산 관리 앱이다.

라이브 앱: https://yjmoonn.github.io/assettrail/

## 사용 흐름

1. 라이브 앱을 연다.
2. Google로 로그인한다.
   - 로그인 전에는 상태가 `Cloud ready`로 표시된다.
   - 로그인 후에는 `Cloud: 이메일` 상태와 `Logout`/`Sync` 버튼이 표시된다.
3. 자산은 `KRX`, `US`, `CASH`, `MANUAL` 네 가지 유형 중 하나로 추가한다.
   - 같은 시장 티커라도 계좌가 다르면 별도 자산으로 관리할 수 있다.
4. 자산 상세의 `투자 의사결정`에서 역할, 가설, 기대수익 원천, KPI·촉매,
   무효화·감속 조건, 다음 검토일과 7차원 수동 위험 태그를 기록한다.
   - 같은 시장·티커의 여러 계좌 보유는 하나의 종목 프로필을 공유한다.
   - 검토기한이 지나면 대시보드 `오늘 확인할 일`에서 해당 상세 화면을 바로 연다.
5. 자산 화면의 `의사결정 센터`에서 Top 1, Top 5, HHI와 데이터 품질 경고를
   확인하고, 보유 전 종목은 별도 관심종목으로 관리한다.
6. 포트폴리오 화면에서 자산군별 최소·목표·최대 비중과 위험예산을 정한 뒤,
   일회성 또는 월 정기 신규자금의 자산군별 검토 예산과 수동 노출 지도를 확인한다.
   - 배분 결과는 특정 종목의 주문 지시가 아니며 가격·수수료·종목 선택을 반영하지 않는다.
   - 평가금액이 확인되지 않은 시장 자산이 있으면 불완전한 총액으로 배분하지 않는다.
   - 한 포지션이 여러 위험 태그에 포함될 수 있으므로 태그 금액은 서로 합산하지 않는다.
7. 자산 화면에서 매수·매도 시 결제할 CASH 자산을 선택한다. 투자 기록의 `거래 원장`에서는
   입출금·배당·이자·수수료·세금을 기록하고 자산 수량과 원화 현금 잔액의 정합성을 확인한다.
   - 거래 수정·취소는 원본을 삭제하지 않고 정정 또는 취소 이벤트를 추가한다.
   - 기존 보유분은 과거 매수를 추정하지 않고 원장 시작일의 기초잔액으로 기록한다.
   - 기초잔액만 있는 오등록 종목은 원본을 보존한 정정 이벤트로 티커를 바꿀 수 있고,
     잘못 만든 자산은 기초잔액 취소 이력을 남긴 뒤 목록에서 정리할 수 있다.
   - 같은 유형·종목·계좌의 중복 자산과 가져오기 파일의 중복 ID는 반영 전에 거부한다.
   - MANUAL 평가금액 수정도 원장 시작 후에는 평가조정 이벤트로 남는다.
8. 증권사 내역은 `증권사 CSV 가져오기`에서 AssetTrail 표준 거래 CSV v1로 변환해
   미리본 뒤 증분 반영한다.
   - 계좌·결제 CASH 매핑, 중복·오류 행, 기간과 예상 현금·포지션 변화를 적용 전에 확인한다.
   - 적용 직전에 현재 데이터를 JSON으로 자동 백업하며 CSV 원문은 미리보기 동안
     브라우저 메모리에만 둔다.
9. 투자 기록의 `기간 성과`에서 TWR·XIRR, KOSPI·S&P 500 비교, 가치변화 브리지와
   최대 낙폭·회복·변동성을 확인한다.
   - 과거의 단순 조회 스냅샷은 수익률로 소급 변환하지 않는다. 정확한 성과는
     현재 원장 이력, 평가점 내용 무결성과 가격 metadata가 확인된 첫 평가점부터 쌓인다.
   - 입출금일에 완전한 평가점이 없으면 TWR은 표시하지 않는다. XIRR은 실제
     입출금 날짜를 사용해 별도로 계산한다.
10. 분석 화면에서 Butler 재무 표를 직접 붙여넣어 기업 실적 스냅샷을 만들고,
    허용된 ETF 구성종목 카탈로그로 직접·간접 중복노출을 확인한다.
    - Butler 원문은 미리보기 동안만 메모리에 두고 정규화된 사실만 사용자별 로컬
      저장소에 보관한다. 자동 로그인·스크래핑이나 비공개 API는 사용하지 않는다.
    - ETF 투시는 사용자가 제공했거나 재배포가 허용된 실물·롱온리 카탈로그만
      사용하며, 출처·기준일·미매핑 비중을 확인할 수 없으면 계산을 제한한다.
11. 같은 화면에서 상대지표만 담은 근거 묶음과 결정론 보고서를 확인한다. 필요하면
    수동 ChatGPT 전달 JSON을 복사하고, 받은 JSON 보고서를 근거 계약에 맞춰 검증한다.
12. 포트폴리오 스냅샷을 남기고 싶을 때 `조회 기록 저장`을 누른다.
13. 은퇴 시뮬레이터에서 기본값을 선택하거나 가정을 직접 수정한다.

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
- 포트폴리오 화면은 계좌, 상품 유형, 국내/해외 비중을 요약한다.

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

## 외부 데이터, ETF 투시와 AI 경계

- Butler 연동은 공식 화면의 `재무정보 테이블 복사하기` 결과를 사용자가 붙여넣는
  방식이다. 출처는 `BUTLER_MANUAL`·`USER_SUPPLIED`·`SECONDARY_AGGREGATOR`로
  명시하고 확정치와 컨센서스를 분리한다.
- 기업 데이터와 ETF 카탈로그는 주 자산 스키마나 Firestore에 넣지 않고 현재 사용자
  저장 키에 연결된 별도 로컬 저장소에 둔다. 로그인 기기 간 자동 동기화 대상이 아니다.
  분석 화면에서 각각 별도 백업·비우기를 제공한다. 외부 데이터 백업은 다시 가져올 수
  있고 개별 스냅샷 삭제 전에는 자동 백업하며, ETF 구성 교체 전에도 기존 파일을
  백업한다. 손상된 원본과 다른 탭에서 바뀐 데이터는 덮어쓰지 않는다.
- ETF 투시는 `PHYSICAL_LONG_ONLY` 구조와 `ALLOWED` 또는 `USER_SUPPLIED` 재배포
  상태만 허용한다. ETF 포장 자체를 다시 합산하지 않고 직접 보유와 구성종목 노출을
  합치며, 현금·미보고·미매핑·미지원 비중은 별도 버킷으로 보존한다.
- AI 입력은 개인정보, 계좌명, 원거래, 절대 금액과 자유 메모를 제외한 상대지표와
  근거 ID만 포함한다. 개별 Butler 기업 비율은 국내·해외 시장 전체 수치로 오인되지
  않도록 AI 입력에서 제외하고 기업 데이터 가용 상태만 전달한다. 기본 보고서는 규칙
  기반으로 생성되므로 AI 없이도 동작한다.
- 앱에는 API 키, 모델 네트워크 호출과 자동 주문 기능이 없다. ChatGPT Pro 구독을
  커스텀 앱의 API 인증으로 재사용하지 않으며, 별도 API 비용 방식으로 자동 전환하지
  않는다. 자세한 운영 경계는 [외부 데이터와 AI 가이드](docs/EXTERNAL_DATA_AND_AI.md)를
  참고한다.

## 동기화

Firebase Auth와 Firestore가 자산, 거래·현금흐름 이벤트, 의사결정 프로필·위험 태그,
관심종목, 자산군 비중 밴드·위험예산, 신규자금 계획, 히스토리 스냅샷,
`performanceObservations`와 은퇴 설정을 로그인 사용자별로 동기화한다. 현재 저장
스키마는 v6이며 버전이 없거나 v1~v5인 데이터는 검증된 백업을 만든 뒤 현재 구조로
마이그레이션한다. 현재 앱보다 새로운 로컬 또는 클라우드 스키마를 감지하면 원본을
보호하기 위해 자동 동기화 쓰기를 중단한다.

성과 평가점은 원장·가격 방법론·벤치마크·환율의 기준일과 fingerprint를 함께 저장한다.
현재 원장 이력은 다시 계산하고 평가점 내용 무결성도 확인한다. 가격 fingerprint는
생성 당시 근거의 128-bit digest 기록이며 과거 시세 원본을 독립적으로 다시 조회해
감사 증명하는 기능은 아니다.
기존 `snapshots`는 계속 조회 기록으로 보존하지만 `performanceObservations`로 자동
복제하지 않는다. 따라서 업그레이드 직후에는 첫 평가점만 보일 수 있으며, 서로 다른
날짜의 검증 평가점이 쌓여야 기간 성과를 계산할 수 있다.
평가점은 클라우드 주 문서의 900KB 안전 여유를 위해 최대 300개를 보존한다. 한도에
도달하면 기존 평가점과 같은 날짜는 갱신할 수 있지만 새 날짜 평가점은 만들지 않고
화면에 안내한다. 장기 보존은 별도 하위 컬렉션 구조가 필요하다.

원장 이벤트는 사용자 주 문서의 900KB 한도와 분리된 세대별 하위 컬렉션에 저장한다.

```text
users/{uid}/financeData/primary
users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}
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
  `index.html`, `styles.css` 같은 UI·계산 코드만 바뀐 배포는 기존 배포본의
  `prices.json`을 재사용한다.
- 가격 생성이 실패하면 GitHub Actions의 `Deploy GitHub Pages` 워크플로 실행 기록을 확인한다.
- 개인 포트폴리오 데이터는 로그인 사용자 본인만 접근할 수 있어야 한다.

```text
users/{uid}/financeData/primary
users/{uid}/financeData/primary/ledgers/{ledgerId}/events/{eventId}
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

4단계만 좁게 확인할 때:

```sh
npm run test:performance
npm run test:broker-csv
npm run test:price-requests
```

5단계만 좁게 확인할 때:

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
- [투자 기능 TODO](docs/INVESTMENT_FEATURE_TODO.md)
- [외부 데이터와 AI 가이드](docs/EXTERNAL_DATA_AND_AI.md)
- [테스트 가이드](docs/TESTING.md)
- [디자인 리뷰 가이드](docs/DESIGN_REVIEW_GUIDE.md)
- [제품 경험 리디자인](docs/PRODUCT_EXPERIENCE_REDESIGN.md)
- [핸드오프 노트](docs/HANDOFF_NOTES.md)
- [세션 요약 기록](docs/sessions/README.md)

상세 과거 문서는 `docs/archive/`에 보관한다.
