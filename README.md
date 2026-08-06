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
8. 포트폴리오 스냅샷을 남기고 싶을 때 `조회 기록 저장`을 누른다.
9. 은퇴 시뮬레이터에서 기본값을 선택하거나 가정을 직접 수정한다.

## 가격표 업데이트

가격표는 GitHub Actions가 하루 한 번 한국 시간 06:30에 생성한다.

- 국내 주식, ETF, ETN: KRX 전체 가격표를 자동 생성한다. ETF/ETN 코드는 `0092B0`처럼 영문이 섞일 수 있다.
- 미국 주식, ETF: 가격을 제공할 티커는 검토 가능한 `tickers.json`에서만 관리한다.
- 워크플로는 가격, 종목명, 상품 유형, `fx.USDKRW`를 포함한 `prices.json`을 만든다.
- 앱은 `prices.json`을 읽어 `KRX`와 `US` 자산의 평가금액과 손익을 계산한다. 미국 가격과 평단가는 달러 기준이며 `fx.USDKRW`로 원화 환산한다.
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

## 동기화

Firebase Auth와 Firestore가 자산, 거래·현금흐름 이벤트, 의사결정 프로필·위험 태그,
관심종목, 자산군 비중 밴드·위험예산, 신규자금 계획, 히스토리 스냅샷과 은퇴 설정을
로그인 사용자별로 동기화한다. 현재 저장 스키마는 v5이며 버전이 없거나 v1~v4인
데이터는 검증된 백업을 만든 뒤 기초잔액 원장으로 마이그레이션한다. 현재 앱보다
새로운 로컬 또는 클라우드 스키마를 감지하면 원본을 보호하기 위해 자동 동기화
쓰기를 중단한다.

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
- `app.js`, `decision-engine.js`, `action-engine.js`, `ledger-engine.js`, `index.html`, `styles.css` 같은 UI·계산 코드만 바뀐 배포는 기존 배포본의 `prices.json`을 재사용한다.
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
- 3단계 원장 코드와 Rules는 아직 운영에 배포하지 않았다. 앱 배포 전에 강화된
  `firestore.rules`를 운영 프로젝트에 먼저 반영하고 접근 경계를 확인해야 한다.

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

변경 유형별 검증 기준은 [테스트 가이드](docs/TESTING.md)를 참고한다.

## 프로젝트 문서

- [AI 공통 작업 규칙](AGENTS.md)
- [Claude Code 작업 규칙](CLAUDE.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [투자 기능 TODO](docs/INVESTMENT_FEATURE_TODO.md)
- [테스트 가이드](docs/TESTING.md)
- [디자인 리뷰 가이드](docs/DESIGN_REVIEW_GUIDE.md)
- [제품 경험 리디자인](docs/PRODUCT_EXPERIENCE_REDESIGN.md)
- [핸드오프 노트](docs/HANDOFF_NOTES.md)
- [세션 요약 기록](docs/sessions/README.md)

상세 과거 문서는 `docs/archive/`에 보관한다.
