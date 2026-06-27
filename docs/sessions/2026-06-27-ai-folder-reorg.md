# AI 작업 구조 개편

## 목적

AssetTrail을 여러 AI 세션에서 이어서 작업하기 쉽게 문서 진입점, 보관 문서, 세션 요약 구조를 정리했다.

## 핵심 결정

- 앱 소스 파일은 루트에 유지한다.
- AI 공통 규칙은 `AGENTS.md`, Claude Code 전용 규칙은 `CLAUDE.md`에 둔다.
- 현재 기준 문서는 `docs/` 바로 아래에 두고, 오래된 상세 문서는 `docs/archive/`에 보관한다.
- 작업 세션 기록은 전체 대화가 아니라 핵심 요약만 `docs/sessions/`에 남긴다.
- 사람이 읽는 문서는 한국어 중심으로 유지한다. 파일명, 명령어, 코드 식별자, 서비스명은 원문을 유지한다.

## 변경

- `AGENTS.md`와 `CLAUDE.md`를 추가했다.
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DESIGN_REVIEW_GUIDE.md`를 추가했다.
- `README.md`와 `docs/PRODUCT_EXPERIENCE_REDESIGN.md`를 한국어 중심으로 정리했다.
- 기존 상세 문서 `PROJECT_CORE.md`, `DATA_AND_PRICES.md`, `OPERATIONS.md`, `TODO.md`를 `docs/archive/`로 이동했다.
- `docs/sessions/README.md`로 세션 요약 작성 규칙을 추가했다.

## 검증

- 오래된 활성 문서 경로 참조가 남아 있지 않은지 확인했다.
- `npm run check:js`가 통과했다.

## 다음 작업

- 기능 작업을 마칠 때 `docs/HANDOFF_NOTES.md`에는 최신 상태만 짧게 남긴다.
- 결정 배경이 필요한 작업은 `docs/sessions/YYYY-MM-DD-작업명.md`에 별도 요약을 남긴다.
- 오래된 문서가 새 진입 문서로 대체되면 삭제하지 말고 `docs/archive/`로 옮긴다.
