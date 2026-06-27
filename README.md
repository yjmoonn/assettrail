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
4. 포트폴리오 스냅샷을 남기고 싶을 때 `조회 기록 저장`을 누른다.
5. 은퇴 시뮬레이터에서 기본값을 선택하거나 가정을 직접 수정한다.

## 가격표 업데이트

가격표는 GitHub Actions가 하루 한 번 한국 시간 06:30에 생성한다.

- 국내 주식, ETF, ETN: KRX 전체 가격표를 자동 생성한다. ETF/ETN 코드는 `0092B0`처럼 영문이 섞일 수 있다.
- 미국 주식, ETF: 기본 심볼은 `tickers.json`에 둘 수 있다. 로그인 사용자가 미국 자산을 저장하면 Firestore의 공유 가격 요청 목록에 새 미국 티커가 자동으로 쌓인다.
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

미국 자산이 `가격 대기`로 보이면 로그인 후 자산을 저장/동기화한 뒤 워크플로를 다시 실행하거나 다음 일일 생성까지 기다린다. KRX 자산은 자동 생성된 KRX 가격표와 매칭된다. 배포된 앱은 `prices.json`의 가격 생성 오류도 화면에 표시한다.

## 동기화

Firebase Auth와 Firestore가 자산, 히스토리 스냅샷, 은퇴 설정을 로그인 사용자별 문서에 동기화한다.

필수 Firebase Auth 허용 도메인:

```text
yjmoonn.github.io
```

## 운영

- GitHub Pages 배포는 `.github/workflows/deploy-pages.yml`에서 처리한다.
- 가격표는 일일 스케줄, 수동 가격 업데이트, 가격 입력/생성기 파일 변경 시에만 새로 생성한다.
- `app.js`, `index.html`, `styles.css` 같은 UI만 바뀐 배포는 기존 배포본의 `prices.json`을 재사용한다.
- 가격 생성이 실패하면 GitHub Actions의 `Deploy GitHub Pages` 워크플로 실행 기록을 확인한다.
- 개인 포트폴리오 데이터는 로그인 사용자 본인만 접근할 수 있어야 한다.

```text
users/{uid}/financeData/primary
```

- 공유 문서 `priceRequests/us`는 GitHub Actions가 미국 티커 요청을 수집할 수 있도록 공개 읽기를 허용한다. 쓰기는 로그인 사용자만 가능하다.

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
- [테스트 가이드](docs/TESTING.md)
- [디자인 리뷰 가이드](docs/DESIGN_REVIEW_GUIDE.md)
- [제품 경험 리디자인](docs/PRODUCT_EXPERIENCE_REDESIGN.md)
- [핸드오프 노트](docs/HANDOFF_NOTES.md)
- [세션 요약 기록](docs/sessions/README.md)

상세 과거 문서는 `docs/archive/`에 보관한다.
