# Claude Code 작업 지침

먼저 `AGENTS.md`를 읽는다. 이 문서는 Claude Code에서만 필요한 추가 작업 방식을 정리한다.

## 로컬 앱 실행

프로젝트에는 `.claude/launch.json` 로컬 실행 설정이 있다.

정적 앱은 아래 명령으로 실행한다.

```sh
python3 -m http.server 4178
```

시각 검토에는 아래 주소를 사용한다.

```text
http://localhost:4178/
```

현재 구조는 프레임워크 개발 서버가 아니라 정적 파일 서버를 기준으로 한다. 의도적인 마이그레이션 전에는 다른 개발 서버를 전제로 작업하지 않는다.

## 세션 진행 순서

1. `docs/HANDOFF_NOTES.md`에서 현재 상태를 확인한다.
2. 데이터, 동기화, 가격표, Firebase, 배포를 바꿀 때는 `docs/ARCHITECTURE.md`를 확인한다.
3. UI나 내비게이션을 바꿀 때는 `docs/PRODUCT_EXPERIENCE_REDESIGN.md`와 `docs/DESIGN_REVIEW_GUIDE.md`를 확인한다.
4. 작은 단위로 변경하고 `docs/TESTING.md`의 기준에 따라 검증한다.
5. 작업 방향이 바뀌거나 우선순위 항목을 완료했거나 다음 작업자에게 도움이 되는 맥락이 생기면 `docs/HANDOFF_NOTES.md`를 갱신한다.

## Claude Code 전용 주의사항

- `.claude/`는 로컬 전용 폴더이며 git에서 제외한다.
- 비밀값, Firebase Admin 인증 정보, 서비스 계정 파일, private key를 저장하지 않는다.
- `prices.json`, 로그, 로컬 백업, 의존성 폴더 같은 생성물은 커밋하지 않는다.
- 브라우저 확인이 필요하면 위 정적 서버를 사용하고, 데스크톱/모바일 폭에서 실제 렌더링을 확인한다.
- 오래된 문서가 새 문서로 대체되면 삭제하지 말고 `docs/archive/`로 옮긴다.

## 권장 검증

문서만 바꾼 경우:

```sh
npm run check:js
```

UI나 앱 동작을 바꾼 경우:

```sh
npm run check:js
npm run test:prices
```

데이터, 동기화, 가격 생성, Firestore Rules, 릴리스에 민감한 변경을 한 경우:

```sh
npm test
```
