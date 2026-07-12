# AssetTrail 테스트 가이드

이 문서는 변경 후 어떤 검증을 실행할지 고르기 위한 기준이다. 작은 변경에는 가장 좁은 검증을 실행하고, 데이터/동기화/가격/릴리스에 민감한 변경에는 전체 테스트를 실행한다.

## 명령어

| 명령 | 목적 |
|---|---|
| `npm run check:js` | Node로 `app.js` 문법 확인 |
| `npm run test:analysis` | 분석 엔진, AI 스키마·비식별화, 5+2페이지 보고서, 분석 탭 흐름 검증 |
| `npm run test:prices` | 포트폴리오 가격 계산과 가격표 처리 검증 |
| `npm run test:price-fallback` | 가격 데이터가 없거나 오래된 경우의 fallback 상태 검증 |
| `npm run test:cloud` | 클라우드 동기화 상태와 사용자 데이터 동작 검증 |
| `npm run test:cloud-prices` | 로그인 사용자의 클라우드 가격 요청 동작 검증 |
| `npm run test:price-requests` | Python 가격 요청 생성 동작 검증 |
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
JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:exec --only firestore "node tests/firestore-rules.test.mjs"
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
| `analysis-engine.js`, 분석 탭, PDF 템플릿 | `npm run check:js`, `npm run test:analysis` |
| 포트폴리오 계산 또는 가격 표시 | `npm run check:js`, `npm run test:prices`, `npm run test:price-fallback` |
| `scripts/generate_prices.py`, `tickers.json`, `requirements.txt` | `npm run test:price-requests`, `npm run test:prices` |
| Firebase Auth 또는 Firestore 동기화 | `npm run test:cloud`, `npm run test:cloud-prices`, `npm run test:firestore` |
| `firestore.rules` | `npm run test:firestore`, 가능하면 `npm test` |
| GitHub Actions 배포 동작 | `.github/workflows/deploy-pages.yml` 검토 후 변경 입력과 관련된 로컬 테스트 |

## 수동 UI 확인

자동 테스트만으로 레이아웃 품질이 보장되지는 않는다. 화면 변경은 `docs/DESIGN_REVIEW_GUIDE.md`의 뷰포트와 화면별 체크리스트로 실제 렌더링을 확인한다.
