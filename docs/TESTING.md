# AssetTrail 테스트 가이드

이 문서는 변경 후 어떤 검증을 실행할지 고르기 위한 기준이다. 작은 변경에는 가장 좁은 검증을 실행하고, 데이터/동기화/가격/릴리스에 민감한 변경에는 전체 테스트를 실행한다.

## 명령어

| 명령 | 목적 |
|---|---|
| `npm run check:js` | Node로 `decision-engine.js`, `action-engine.js`, `ledger-engine.js`, `app.js` 문법 확인 |
| `npm run test:decision` | 경제적 포지션 합산, Top 1·Top 5·HHI, 검토일과 경고 경계값 검증 |
| `npm run test:action` | 원 단위 신규자금 배분 제약, 불가능 상태, 위험 태그 합산과 위험예산 검증 |
| `npm run test:action-app` | v3→v5 이전 후 행동 지원 UI, 정책·신규자금·위험 태그 저장과 빈 상태 검증 |
| `npm run test:ledger` | 이벤트 스키마·기초잔액·CASH 원화 정산·정정/취소·원장 UI와 참조 정합성 검증 |
| `npm run test:investment` | 기존 데이터→v5 마이그레이션·계좌별 판단 충돌 보존, 의사결정 상세, 대시보드 딥링크, 관심종목 CRUD 검증 |
| `npm run test:prices` | 포트폴리오 가격 계산과 가격표 처리 검증 |
| `npm run test:price-fallback` | 가격 데이터가 없거나 오래된 경우의 fallback 상태 검증 |
| `npm run test:symbols` | 분리된 종목 디렉터리의 지연 로딩과 실패 격리 검증 |
| `npm run test:cloud` | 주 문서와 세대별 원장 이벤트의 일관된 클라우드 동기화 검증 |
| `npm run test:cloud-conflict` | 원장 fingerprint·revision 충돌, 강제 업로드 백업과 미지원 스키마 차단 검증 |
| `npm run test:cloud-prices` | 클라우드 자산에 정적 가격표를 적용하는 동작 검증 |
| `npm run test:data` | v5 저장 스키마, 기초잔액 이전·백업·대량 세대 교체, 가져오기·용량·revision 방어 검증 |
| `npm run test:price-requests` | Python 가격 생성·실거래일 품질 게이트 검증 |
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
| 저장 스키마 변경 | `npm run test:data`, `npm run test:cloud`, `npm run test:cloud-conflict` |
| 포트폴리오 계산 또는 가격 표시 | `npm run check:js`, `npm run test:prices`, `npm run test:price-fallback` |
| `scripts/generate_prices.py`, `tickers.json`, `requirements.txt` | `npm run test:price-requests`, `npm run test:prices` |
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
