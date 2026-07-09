# Claude Code 작업 지침 (Claude 전용 오버레이)

@AGENTS.md

위 `AGENTS.md`가 이 프로젝트의 공통 작업 규칙이다 — 읽을 문서 순서, 하드 제약(데이터·Firestore·가격 모델), 변경 방식, 검증 명령, UI 검토, 핸드오프 규칙이 모두 거기 있다. 이 파일은 **Claude Code에서만 추가로 필요한 것**만 담는다. 같은 규칙을 여기에 다시 적지 않는다.

## 로컬 앱 실행

정적 앱이다. 프레임워크 개발 서버가 아니라 정적 파일 서버를 기준으로 하며(`.claude/launch.json` 참고), 의도적인 마이그레이션 전에는 다른 개발 서버를 전제로 작업하지 않는다.

```sh
python3 -m http.server 4178
```

시각 검토·브라우저 확인은 이 서버를 사용한다: `http://localhost:4178/`
(확인할 화면 폭과 기준은 AGENTS.md "UI 검토" 섹션을 따른다.)

## Claude Code 전용 주의사항

- `.claude/`는 로컬 전용 폴더이며 git에서 제외한다.
- 커밋 메시지에 `Co-Authored-By: Claude …` 트레일러를 넣지 않는다. (작업자에 Claude가 공동 작성자로 표시되지 않게 한다.)
