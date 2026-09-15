# 전용 reader 인증 갱신

## 목적
무인 source 조회에서 만료된 ID token을 계속 쓰거나 사용자 로그인 자격증명을 재활용하지 않도록 전용 갱신 경로를 준비한다.

## 핵심 결정
- createReaderTokenProvider는 명시한 reader UID·프로젝트와 전용 refresh credential 저장소 callback만 받는다. 브라우저/ADC 탐색·계정 생성·signing·권한 등록은 수행하지 않는다.
- securetoken.googleapis.com 고정 HTTPS endpoint의 공식 refresh grant를 사용한다. redirect 금지·20초 timeout·64 KiB 응답 한도·자동 재시도 없음.
- 응답 user_id/project_id와 ID token의 sub/aud/iss/exp를 확인한다. JWT를 해독한 것은 서명 검증이 아니다. 실제 서명/권한은 Firestore가 확인해야 한다.
- 숫자 프로젝트 번호와 문자열 프로젝트 ID를 명시해 공식 문서의 project_id 표현 차이를 처리한다. aud는 정확한 문자열 프로젝트 ID만 허용한다.
- ID token은 메모리에만 캐시하고 만료 60초 전에 갱신한다. 동시 요청은 하나의 refresh로 합친다.
- refresh token이 바뀌면 저장소 compare-and-swap callback이 내구성 있는 저장 후 true를 반환해야 한다. 실패 시 새 ID token을 반환하지 않는다. 외부 저장소 구현·runner 연결은 아직 별도 작업이다.
- invalidate는 로컬 캐시만 비운다. 서버의 refresh token 회수·identity 비활성화·Rules 허용 회수와 혼동하지 않는다.

## 변경
- scripts/firebase_reader_token.mjs와 tests/firebase-reader-token.test.mjs를 추가하고 test:ai-review에 연결했다.
- credential/HTTP 응답 원문을 오류 메시지에 넣지 않는다. 조립은 기존 createFirestoreReadTransport의 getIdToken callback에 연결할 수 있다.

## 검증
- 합성 응답에서 동시 3요청→refresh 1회, 60초 전 재갱신, rotation 저장과 실패, 진행 중 invalidation, 저장 중 만료, 다른 UID/project/issuer/audience 거절을 확인했다.
- 잘못된 응답/크기/HTTP·네트워크·저장소 오류의 토큰 비노출 검사 통과. 사용한 JWT는 합성 입력이며 실제 인증 성공으로 해석하지 않는다.
- 전체 npm test(JS·Python·Firestore Rules) exit 0, 마지막 만료 재검사 변경의 focused 테스트도 통과했다. 실제 발급·클라우드 갱신·회수는 미검증이다.

## 다음 작업
- 전용 identity enrollment와 credential 저장소의 원자적 교체·권한/백업·프로세스 간 동시성 검증 후 source 실행기에 연결한다.
- read-only Rules 활성화 없이 현재 사용자 refresh token을 대신 넣지 않는다. 실제 계정 등록/Rules 배포는 별도 범위 결정이다.
- DB migration 없음. 이전 실행기로 rollback하며 현재 credential은 보존하고 명시적 회수 절차를 적용한다.
- 공식 근거: https://firebase.google.com/docs/reference/rest/auth#section-refresh-token 및 https://firebase.google.com/docs/auth/admin/manage-sessions (2026-09-11 확인).
