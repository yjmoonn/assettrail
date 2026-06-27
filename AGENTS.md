# AssetTrail AI 작업 규칙

AssetTrail은 개인 자산, 포트폴리오 변화, 투자 판단, 히스토리, 은퇴 가정을 기록하는 정적 웹앱이다. GitHub Pages로 배포하고, Firebase Auth/Firestore로 사용자별 데이터를 동기화하며, GitHub Actions가 생성한 시장 가격표를 사용한다.

## 먼저 읽을 문서

변경 전에 아래 순서로 필요한 문서를 읽는다.

1. `docs/HANDOFF_NOTES.md`: 현재 작업 상태와 최근 결정
2. `docs/ARCHITECTURE.md`: 앱 구조, 데이터 경계, 가격표 흐름
3. `docs/PRODUCT_EXPERIENCE_REDESIGN.md`: UX 방향과 우선순위
4. `docs/TESTING.md`: 검증 명령과 테스트 기준
5. `docs/DESIGN_REVIEW_GUIDE.md`: UI, 레이아웃, 내비게이션, 시각 토큰 변경 시 확인 기준

깊은 과거 맥락이 필요하면 `docs/archive/`의 보관 문서를 참고한다.

- `docs/archive/PROJECT_CORE.md`
- `docs/archive/DATA_AND_PRICES.md`
- `docs/archive/OPERATIONS.md`
- `docs/archive/TODO.md`

작업별 결정 배경이 필요하면 `docs/sessions/`의 세션 요약을 참고한다.

## 오래된 문서 보관 규칙

- 새 진입 문서가 기존 상세 문서를 대체하면, 기존 문서는 삭제하지 말고 `docs/archive/`로 옮긴다.
- archive로 옮긴 문서는 원문을 최대한 보존한다.
- 활성 문서에서 archive 문서를 참조할 때는 반드시 `docs/archive/...` 경로를 사용한다.
- 새 작업을 끝낼 때 `docs/HANDOFF_NOTES.md`에 최신 상태와 다음 작업을 남긴다.

## 세션 요약 규칙

- 의미 있는 작업을 완료했거나 중요한 결정 배경이 생겼다면 `docs/sessions/`에 요약을 남긴다.
- 전체 대화 로그를 저장하지 않는다.
- 파일 이름은 `YYYY-MM-DD-짧은-작업명.md` 형식을 사용한다.
- 내용은 목적, 핵심 결정, 변경, 검증, 다음 작업만 짧게 적는다.
- 작성 형식은 `docs/sessions/README.md`를 따른다.

## 반드시 지킬 것

- 사용자 자산 데이터는 `users/{uid}/financeData/primary` 범위에 유지한다.
- Firestore Rules를 약화하거나 사용자별 비공개 데이터를 공개 읽기로 바꾸지 않는다.
- `priceRequests/us`는 공개 읽기, 로그인 사용자 쓰기 모델을 유지한다. 보안 검토 없이 바꾸지 않는다.
- 현재 가격 모델을 유지한다. `KRX`와 `US`는 `prices.json`을 사용하고, `CASH`와 `MANUAL`은 사용자가 입력한 평가금액을 사용한다.
- 제품 결정 없이 Alpha Vantage, 수동 환율 입력, 통화 필드, 대량등록 흐름을 되살리지 않는다.
- `.env`, 서비스 계정 JSON, private key, Firebase Admin 인증 정보, 로컬 백업, 생성 로그, `prices.json`, 의존성 폴더를 커밋하지 않는다.
- 명시적인 마이그레이션 계획 없이 정적 GitHub Pages 구조를 바꾸지 않는다.

## 변경 방식

- 큰 재작성보다 작고 검토 가능한 변경을 우선한다.
- 커밋 메시지는 한국어로 작성한다. 제목은 명령형 한 줄로, 필요하면 본문에 이유와 변경 요약을 덧붙인다. (파일명, 명령어, 코드 식별자는 원문 유지)
- 별도 마이그레이션 계획이 없으면 현재의 HTML, CSS, vanilla JavaScript 구조를 따른다.
- 앱 소스 파일은 루트에 둔다: `index.html`, `app.js`, `styles.css`, Firebase 설정/규칙 파일.
- 가격 생성 로직은 `scripts/generate_prices.py`에 둔다.
- 테스트는 `tests/`에 둔다.
- 배포 자동화는 `.github/workflows/`에 둔다.
- 기존 사용자 데이터는 오래 유지되는 데이터로 본다. 데이터 구조를 바꿀 때는 기본값과 호환 처리를 함께 둔다.

## 필수 검증

변경 후에는 범위에 맞는 가장 좁은 검증을 실행한다.

```sh
npm run check:js
```

관련 기능을 건드렸다면 해당 테스트도 실행한다.

```sh
npm run test:prices
npm run test:price-fallback
npm run test:cloud
npm run test:cloud-prices
npm run test:price-requests
npm run test:firestore
```

데이터, 동기화, 가격, Firestore Rules, 여러 화면에 걸친 UI 동작을 바꿨다면 전체 테스트를 실행한다.

```sh
npm test
```

Firestore Rules 테스트에는 Firebase Emulator와 Java가 필요하다. 이 테스트에서 나오는 `PERMISSION_DENIED` 로그는 거부 규칙을 검증하는 과정일 수 있으므로 최종 종료 코드를 확인한다.

## UI 검토

UI 변경 시 데스크톱과 모바일을 모두 확인한다. 기준은 `docs/DESIGN_REVIEW_GUIDE.md`를 따른다.

- 데스크톱: 1440px, 1280px
- 모바일: 390px, 430px
- 텍스트와 컨트롤이 겹치지 않는지 확인
- 모바일 터치 대상이 충분한지 확인
- 내비게이션 상태와 딥링크가 유지되는지 확인
- 비어 있음, 로딩, 로그아웃, 로그인 상태가 모두 이해 가능한지 확인

## 핸드오프

의미 있는 변경을 끝냈다면 `docs/HANDOFF_NOTES.md`에 아래 내용을 남긴다.

- 변경한 내용
- 검증한 내용
- 실행하지 못한 검증과 이유
- 다음에 이어서 할 만한 작업
