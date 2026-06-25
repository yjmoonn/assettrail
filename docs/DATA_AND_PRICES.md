# 데이터와 가격표 구조

이 문서는 AssetTrail의 자산 데이터, 가격표 생성, 평가금액 계산 방식을 정리한다.

## 저장 데이터

사용자별 Firestore 문서는 아래 데이터를 가진다.

| 데이터 | 설명 |
|---|---|
| `assets` | 자산 원장 |
| `snapshots` | 사용자가 저장한 자산 조회 스냅샷 |
| `realizedTrades` | 매도 처리로 생성된 실현손익 기록 |
| `tradeJournalEntries` | 매수, 매도, 리밸런싱, 관찰 판단을 남기는 매매일지 |
| `retirement` | 은퇴 시뮬레이터 입력값 |

로그인하지 않은 상태에서는 브라우저 로컬 저장소를 사용하고, 로그인 후에는 Firestore와 동기화한다.

## 자산 원장 핵심 필드

| 필드 | 설명 |
|---|---|
| `type` | `KRX`, `US`, `CASH`, `MANUAL` |
| `account` | 계좌명. 같은 종목을 여러 계좌에 보유할 때 구분 기준이 된다. |
| `ticker` | `KRX`, `US` 자산의 종목코드 |
| `name` | 자산명. 가격표에 이름이 있으면 자동 입력될 수 있다. |
| `quantity` | 시장가격 자산의 수량 |
| `averagePrice` | 시장가격 자산의 평단가. `US`는 달러 기준이다. |
| `amount` | `CASH`, `MANUAL`의 수동 평가금액 |

같은 티커라도 계좌가 다르면 별도 행으로 관리한다. 예를 들어 삼성전자를 일반계좌와 연금저축 계좌에 모두 보유하면 두 개 자산으로 등록한다.

## 매매일지

`tradeJournalEntries`는 투자 판단과 복기를 남기는 기록이다.

| 필드 | 설명 |
|---|---|
| `date` | 작성일 |
| `assetId` | 연결된 자산 ID. 직접 입력한 일지는 비어 있을 수 있다. |
| `realizedTradeId` | 매도 처리와 함께 생성된 경우 연결된 실현손익 기록 ID |
| `action` | `BUY`, `SELL`, `REBALANCE`, `WATCH` |
| `region` | `DOMESTIC`, `OVERSEAS`, `OTHER` |
| `reason` | 투자 이유 |
| `risk` | 틀릴 수 있는 이유와 확인할 변수 |
| `review` | 사후 복기 메모 |
| `status` | `OPEN`, `REVIEW`, `DONE` |

매매일지는 투자 추천이 아니라 사용자의 판단을 기록하고 나중에 복기하기 위한 데이터다.

## `prices.json`

GitHub Actions가 생성하고 앱이 읽는 가격표 파일이다.

주요 구조는 다음과 같다.

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

## 국내 가격

- KRX 전체 가격표를 자동 생성한다.
- 국내 주식, ETF, ETN을 포함한다.
- ETF/ETN 종목코드는 숫자 6자리뿐 아니라 `0092B0`처럼 영문이 섞인 코드도 허용한다.
- 종목명 자동 입력도 가격표의 `name` 또는 심볼 정보에서 가져온다.

## 미국 가격

- 미국 가격은 yfinance 일별 종가를 사용한다.
- 기본 티커는 `tickers.json`에 둘 수 있다.
- 로그인 사용자가 저장한 미국 자산 티커는 Firestore `priceRequests/us`에 누적된다.
- 다음 가격표 생성 시 GitHub Actions가 요청된 미국 티커까지 포함해 가격을 만든다.
- 미국 종목명은 Nasdaq Trader 심볼 목록 또는 yfinance 정보로 채운다.

## 환율

- `prices.json`의 `fx.USDKRW`를 사용한다.
- `US` 자산의 평가금액은 `수량 x 달러 종가 x USD/KRW`다.
- `US` 자산의 매입금액은 `수량 x 달러 평단가 x USD/KRW`다.
- 화면에는 미국 종가와 환율을 함께 보여준다.

## 평가금액 계산

| 유형 | 평가금액 |
|---|---|
| `KRX` | `quantity x currentPrice` |
| `US` | `quantity x currentPrice x USDKRW` |
| `CASH` | `amount` |
| `MANUAL` | `amount` |

`CASH`와 `MANUAL`은 자동 가격 업데이트 대상이 아니다. 사용자가 조회 시점에 직접 평가금액을 수정해야 한다.

## 수동평가 사용 기준

`MANUAL`은 자동 시세를 안정적으로 가져오기 어려운 상품에 사용한다.

예시:

- 적금
- 예금
- 주택청약저축
- 일부 펀드
- 보험성 금융상품
- 비상장/기타 수동 관리 자산

수동평가 자산은 매입금액이 아니라 현재 평가금액을 넣는 방식으로 쓰는 것이 현재 앱 구조에 가장 잘 맞는다.
