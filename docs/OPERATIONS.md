# 운영 메모

이 문서는 AssetTrail을 배포하고 점검할 때 필요한 운영 기준을 정리한다.

## 배포

- GitHub Pages로 배포한다.
- 배포 워크플로는 `.github/workflows/deploy-pages.yml`이다.
- 라이브 앱은 `https://yjmoonn.github.io/assettrail/`이다.

## 가격표 생성 조건

가격표 생성은 시간이 오래 걸릴 수 있으므로 매번 배포할 때 실행하지 않는다.

`prices.json`을 새로 생성하는 경우:

- 하루 1회 스케줄 실행
- GitHub Actions 수동 실행에서 가격표 생성을 선택한 경우
- `tickers.json`, `requirements.txt`, `scripts/generate_prices.py`가 변경된 경우

가격표를 새로 만들지 않는 경우:

- `app.js`, `index.html`, `styles.css` 등 UI만 바뀐 일반 배포

이 경우 기존에 배포된 `prices.json`을 재사용한다.

## Firebase

Firebase Auth와 Firestore를 사용한다.

필수 Auth 허용 도메인:

```text
yjmoonn.github.io
```

Firestore Rules 핵심:

- `users/{uid}/financeData/primary`는 본인만 읽고 쓸 수 있다.
- `priceRequests/us`는 미국 티커 요청 수집용이다.
- `priceRequests/us`는 공개 읽기를 허용하고, 쓰기는 로그인 사용자만 가능하다.

## 배포 전 점검

공개 저장소와 GitHub Pages 운영 전에는 아래를 확인한다.

- `.env`가 커밋되지 않았는지 확인
- Firebase Admin 인증 정보가 없는지 확인
- 서비스 계정 JSON이 없는지 확인
- private key가 없는지 확인
- Firestore Rules가 본인 데이터만 허용하는지 확인
- Firebase Auth 허용 도메인에 배포 도메인이 들어있는지 확인

## 로컬 점검

전체 테스트:

```sh
npm test
```

가격/포트분석 중심 테스트:

```sh
npm run test:prices
```

자바스크립트 문법 확인:

```sh
npm run check:js
```

Firestore Rules 테스트는 Firebase Emulator와 Java가 필요하다.

## 자주 보는 증상

| 증상 | 확인할 것 |
|---|---|
| 로그인 버튼이 계속 보임 | Firebase Auth 상태 UI가 로그인 이후 갱신되는지 확인 |
| `Cloud ready`에서 멈춤 | 실제 로그인 상태와 Auth authorized domain 확인 |
| `가격 대기` 표시 | 해당 티커가 `prices.json` 생성 대상에 포함됐는지 확인 |
| 미국 티커 가격 대기 | 로그인 후 저장/동기화해서 `priceRequests/us`에 티커가 올라갔는지 확인 |
| KRX ETF 코드 오류 | 영문 포함 6자리 코드가 허용되는지 확인 |
| 미국 자산 평가금액 이상 | `fx.USDKRW`와 달러 평단 입력 여부 확인 |

