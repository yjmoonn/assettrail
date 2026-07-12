# AssetTrail 분석 API

결정론적 포트폴리오 계산 결과를 구조화된 AI 판단으로 확장하고, 기관형 5개 핵심 페이지와 최대 2개 선택 페이지 PDF를 생성·보관하는 Cloud Run 서비스다.

## 경계

- Firebase ID token을 검증한 요청만 처리한다.
- 분석 이력은 `users/{uid}/analysisRuns/{runId}`에 최대 12회 저장한다.
- 브라우저는 분석 이력을 직접 쓸 수 없다. Firestore Admin SDK를 사용하는 이 서비스만 쓴다.
- 원장 계좌명과 사용자 식별자는 AI 제공자에게 보내지 않으며 Responses API의 저장 기능도 끈다.
- AI 보고서 월 기본 한도는 사용자당 2회이며 서버 전용 entitlement로 조정한다.
- PDF는 사용자별 비공개 Firebase Storage 경로에 보관하고 인증된 다운로드만 허용한다.
- 시장 맥락 모드의 외부 근거 URL은 실제 웹검색 출처와 일치해야 한다.
- 허용 Origin은 AssetTrail GitHub Pages와 로컬 프리뷰 주소로 제한한다.

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| `GET` | `/healthz` | 상태 확인 |
| `GET` | `/v1/analysis-runs` | 로그인 사용자의 최근 분석 12회 조회 |
| `POST` | `/v1/analysis-runs` | 분석 결과 저장 |
| `GET` | `/v1/ai-quota` | 로그인 사용자의 이번 달 AI 보고서 한도 조회 |
| `POST` | `/v1/ai-reports` | 구조화된 AI 판단·PDF 생성 및 분석 이력 저장 |
| `GET` | `/v1/ai-reports/:analysisId/pdf` | 저장된 비공개 PDF 다운로드 |

`POST /v1/reports/portfolio-analysis`는 종료되어 `410`을 반환한다.

인증이 필요한 요청은 `Authorization: Bearer <Firebase ID token>` 헤더를 사용한다.

## 배포 전 확인

1. Firebase 프로젝트와 같은 Google Cloud 프로젝트에 배포한다.
2. 런타임 서비스 계정에 필요한 최소 Firestore 접근 권한만 부여한다.
3. 브라우저가 서비스에 접근할 수 있도록 Cloud Run 호출은 허용하되, 애플리케이션 계층의 Firebase token 검증을 제거하지 않는다.
4. 배포 URL을 `firebase-config.js`의 `analysisApiBaseUrl`에 입력한다.
5. `firestore.rules`를 함께 배포해 클라이언트의 `analysisRuns` 쓰기를 차단한다.

Cloud Run 배포는 과금과 외부 리소스 변경을 수반하므로 저장소 PR 병합과 별도로 수행한다.
