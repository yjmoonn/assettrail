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
| `firebase-config.js` | 브라우저용 Firebase 클라이언트 설정 |
| `firebase.json` | Firebase 프로젝트 설정 |
| `firestore.rules` | Firestore 접근 제어 경계 |
| `analysis-engine.js` | 원장 JSON을 입력받는 결정론적 포트폴리오 분석 엔진 |
| `services/analysis-api/` | 분석 이력 저장과 서버 PDF 생성을 담당하는 Cloud Run 서비스 |

GitHub Pages 배포는 `.github/workflows/deploy-pages.yml`에서 처리한다. 워크플로는 CI 중 `_site/`를 만들지만, `_site/`는 생성물이라 커밋하지 않는다.

## 사용자 데이터 경계

AssetTrail은 로그아웃 상태의 로컬 사용과 로그인 상태의 클라우드 동기화를 모두 지원한다.

| 상태 | 저장 위치 |
|---|---|
| 로그아웃 | 브라우저 로컬 저장소 |
| 로그인 | Firestore 문서 `users/{uid}/financeData/primary` |

분석 원본과 파생 결과는 분리한다.

| 데이터 | 저장 위치 | 쓰기 주체 |
|---|---|---|
| 자산 원장 | `users/{uid}/financeData/primary` | 해당 사용자 |
| 분석 기본설정 | `users/{uid}/analysisPreferences/{documentId}` | 해당 사용자 |
| 분석 결과 | `users/{uid}/analysisRuns/{runId}` | 분석 API 서버 |

브라우저는 분석 결과를 로컬에 최대 12회 캐시한다. 분석 API가 설정된 로그인 사용자는 서버 이력과 병합한다. 다른 사용자의 원장이나 분석 결과는 읽거나 비교 자료로 사용하지 않는다.

사용자 문서는 아래 데이터를 가진다.

| 필드 | 설명 |
|---|---|
| `assets` | 자산 원장 |
| `snapshots` | 저장된 포트폴리오 히스토리 스냅샷 |
| `realizedTrades` | 매도 처리로 생성된 실현손익 기록 |
| `tradeJournalEntries` | 매수, 매도, 리밸런싱, 관찰 판단 매매일지 |
| `retirement` | 은퇴 시뮬레이터 설정 |

사용자별 Firestore 경계는 제품 요구사항이다. 포트폴리오 데이터는 해당 로그인 사용자만 읽고 쓸 수 있어야 한다.

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

## 가격표 흐름

`prices.json`은 GitHub Actions가 생성하고 브라우저 앱이 읽는다.

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
  "symbols": {
    "KRX": {},
    "US": {}
  },
  "errors": []
}
```

국내 가격은 KRX 전체 가격표를 만든다. 주식, ETF, ETN을 포함하며, ETF/ETN 코드는 `0092B0`처럼 영문이 섞일 수 있다.

미국 가격은 yfinance 일별 종가를 사용한다. 기본 미국 티커는 `tickers.json`에 둘 수 있고, 로그인 사용자가 미국 자산을 저장하면 공유 Firestore 요청 문서에 티커가 누적되어 다음 가격표 생성에 반영된다.

## 공유 가격 요청

`priceRequests/us`는 GitHub Actions가 미국 티커 요청을 모으기 위해 사용하는 공유 Firestore 문서다.

규칙 기대값:

- 워크플로가 요청을 수집할 수 있도록 공개 읽기를 허용한다.
- 쓰기는 로그인 사용자만 가능하다.
- 이 문서에는 개인 포트폴리오 데이터를 넣지 않는다.

## 제품 및 보안 제약

- Firebase 웹 설정값은 브라우저 앱에서 공개될 수 있다.
- 실제 데이터 보호 경계는 Firestore Rules다.
- `.env`, 서비스 계정 JSON, private key, Firebase Admin 인증 정보, 생성 로그, 로컬 백업은 커밋하지 않는다.
- 제품 결정 없이 Alpha Vantage, 수동 환율 입력, 대량등록 흐름을 되살리지 않는다.
- `CASH`와 `MANUAL` 자산의 수동 평가 방식을 유지한다.
- 명시적인 마이그레이션 계획 없이 GitHub Pages 정적 호스팅을 바꾸지 않는다.

## 포트폴리오 분석 흐름

1. 사용자가 현재 원장 또는 내보낸 JSON을 분석 대상으로 선택한다.
2. `analysis-engine.js`가 가격표와 원장을 이용해 평가금액, 경제적 포지션, 자산·지역·통화·계좌 노출, 집중도와 조회 기록 기반 관측치를 계산한다.
3. 현금흐름, ETF 구성종목 또는 벤치마크 시계열이 없으면 TWR·XIRR·ETF 투시·위험조정 성과를 추정하지 않고 `unavailable` 사유를 반환한다.
4. 브라우저는 결과를 최대 12회 로컬 캐시하고, 분석 API가 설정된 로그인 사용자는 서버에도 저장한다.
5. PDF 요청 시 Firebase ID token을 검증한 분석 API가 Noto CJK 글꼴과 Chromium으로 8페이지 PDF를 생성한다.

분석 API 주소는 `firebase-config.js`의 `analysisApiBaseUrl`에 둔다. 비어 있으면 수치 분석과 로컬 이력은 작동하지만 서버 이력과 PDF 생성은 비활성 상태다.

## 보관 문서

아래 문서는 상세 과거 맥락 보존용이다.

- `docs/archive/PROJECT_CORE.md`
- `docs/archive/DATA_AND_PRICES.md`
- `docs/archive/OPERATIONS.md`
- `docs/archive/TODO.md`
