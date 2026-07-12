# AssetTrail 분석 API

포트폴리오 분석 이력을 사용자별 Firestore 경로에 저장하고, 동일한 레이아웃의 8페이지 PDF를 서버에서 생성하는 Cloud Run용 서비스다.

## 경계

- Firebase ID token을 검증한 요청만 처리한다.
- 분석 이력은 `users/{uid}/analysisRuns/{runId}`에 최대 12회 저장한다.
- 브라우저는 분석 이력을 직접 쓸 수 없다. Firestore Admin SDK를 사용하는 이 서비스만 쓴다.
- PDF 응답은 `Cache-Control: no-store`로 반환하고 서버 파일시스템에 보존하지 않는다.
- 허용 Origin은 AssetTrail GitHub Pages와 로컬 프리뷰 주소로 제한한다.

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| `GET` | `/healthz` | 상태 확인 |
| `GET` | `/v1/analysis-runs` | 로그인 사용자의 최근 분석 12회 조회 |
| `POST` | `/v1/analysis-runs` | 분석 결과 저장 |
| `POST` | `/v1/reports/portfolio-analysis` | 분석 저장 후 8페이지 PDF 반환 |

인증이 필요한 요청은 `Authorization: Bearer <Firebase ID token>` 헤더를 사용한다.

## 배포 전 확인

1. Firebase 프로젝트와 같은 Google Cloud 프로젝트에 배포한다.
2. 런타임 서비스 계정에 필요한 최소 Firestore 접근 권한만 부여한다.
3. 브라우저가 서비스에 접근할 수 있도록 Cloud Run 호출은 허용하되, 애플리케이션 계층의 Firebase token 검증을 제거하지 않는다.
4. 배포 URL을 `firebase-config.js`의 `analysisApiBaseUrl`에 입력한다.
5. `firestore.rules`를 함께 배포해 클라이언트의 `analysisRuns` 쓰기를 차단한다.

Cloud Run 배포는 과금과 외부 리소스 변경을 수반하므로 저장소 PR 병합과 별도로 수행한다.
