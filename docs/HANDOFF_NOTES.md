# 핸드오프 노트 - 제품 경험 개선 이어가기

> 로컬 Claude Code 세션에서 진행한 UX/UI 리뷰 + P0 수정 결과입니다.
> 웹/앱(claude.ai/code) 클라우드 세션은 대화 컨텍스트가 이어지지 않으므로, 이 문서를 시작점으로 사용하세요.
> 예: *"docs/HANDOFF_NOTES.md를 읽고 P1 항목부터 이어서 작업해줘."*

서비스 정의/구조는 `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_EXPERIENCE_REDESIGN.md` 참고.
상세 과거 메모는 `docs/archive/PROJECT_CORE.md`, `docs/archive/DATA_AND_PRICES.md`, `docs/archive/OPERATIONS.md`, `docs/archive/TODO.md`에 보존되어 있습니다.
작업별 결정 요약은 `docs/sessions/`에 보존합니다. 전체 대화가 아니라 목적, 결정, 변경, 검증, 다음 작업만 남깁니다.

## 반드시 지킬 제약
- 기존 사용자 데이터·Firestore 사용자별 분리(`storageKeyForUser`) 구조를 깨지 않는다.
- prices.json 기반 KRX/US 평가, CASH/MANUAL 수동평가(amount) 모델을 유지한다.
- Alpha Vantage·환율 수동입력·대량등록은 재추가하지 않는다.
- React/Tailwind 대전환은 단계적 검토 후. 변경은 작은 단위로.
- 수정 후 `npm run check:js` + `npm run test:prices` (가능하면 `npm test`) 실행. `npm test`의 firestore `PERMISSION_DENIED` 로그는 규칙 검증의 정상 출력.

## 방금 완료한 수정 (P0, `app.js`)
1. **대시보드 "최근 투자 기록" 카드가 항상 "자산"으로 표시** — `recentEntry.assetName`/`recentTrade.assetName` → `name`(저장 객체의 실제 필드). app.js 1251/1254. 화면으로 `매수 · 삼성전자` 정상 표시 확인.
2. **자산 화면에서 "일지" 클릭 시 무반응** — `handleAssetAction`의 journal 분기에 `setActiveView("JOURNAL", { scroll: true })` 추가. 숨겨진 JOURNAL 섹션에 폼이 열리던 문제 해결. app.js ~3135.

## 완료한 수정 (P1-3, `app.js`)
- **뷰 상태 URL/History 연동** — 해시 기반 라우팅 도입(GitHub Pages 정적 호스팅이라 path pushState는 새로고침 404 → 해시 선택). `viewHash()`/`viewFromHash()` 헬퍼(app.js ~54), `setActiveView`에 `updateHash` 옵션(같은 뷰면 중복 항목 X, `render()`의 호출은 히스토리 미오염), 유저 네비 2곳에 `updateHash:true`, 부트스트랩에서 해시→activeView 복원 + `replaceState` + `popstate`/`hashchange` 리스너. 검증: 최초 `#dashboard`, 네비 클릭 시 해시/히스토리 갱신, 뒤로가기 복귀, 딥링크 새로고침 복원, 잘못된 해시는 대시보드 폴백. 헤드리스 실측 통과. (커밋 d8c8ffa, 배포됨)

## 완료한 수정 (P1-2)
- **토픽바 과밀 → 운영 액션을 설정으로 실제 이동** — 토픽바는 가격/클라우드 상태 표시 + Login/Logout만 남기고, 가격갱신(`priceRefreshBtn` "최신 가격 확인")·동기화(`cloudSyncBtn` "지금 동기화", 로그인 시 노출)·내보내기(`exportBtn`)·가져오기(`importInput`/import-label)를 설정 패널의 클라우드/가격표/데이터 카드 안 **실제 컨트롤**로 이동. 기존 설정의 프록시 버튼(중복) 제거 + `app.js`의 죽은 `data-focus-control`/`data-trigger-control` 핸들러 삭제. 핸들러가 ID로 바인딩(`els.X = querySelector("#X")`)이라 DOM 이동해도 배선 유지. `styles.css` `.import-label` 스코프를 토픽바 한정에서 전역으로 일반화. 검증: 1440/390 헤드리스 — 토픽바 슬림화, 설정 3카드(로컬 저장/가격표/백업과 복원)에 컨트롤 정상 렌더. `check:js`/`test:prices`/`npm test` 통과.

## 완료한 수정 (P1-1)
- **데스크톱 대시보드 밀도** — 여정카드4 아래에 2모듈 행(`.dashboard-modules`, 3fr 2fr) 추가. 좌측 **포트폴리오 비중 가로막대**(국내/해외/현금/수동: 현재% 막대 + 목표 위치 마커 + "목표 초과/부족 N%p" 라벨, `renderDashboardComposition` app.js ~1281), 우측 **최근 기록 리스트**(매매일지+실현매도 병합·날짜 내림차순 최대 5건, `renderDashboardRecentList`). `index.html` dashboard-panel에 마크업, `styles.css`에 `.dashboard-modules`/`.composition-*`/`.recent-record-list` 추가(720px에서 1열로 collapse). 1440/390 헤드리스 + 빈 상태 검증 통과.

베이스라인: `check:js` / `test:prices` / `npm test` 모두 통과(exit 0).

## 완료한 정리 (AI 작업 구조)
- **AI 작업 문서 구조 개편** — `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DESIGN_REVIEW_GUIDE.md` 추가. 기존 상세 문서는 `docs/archive/`로 이동. 세션 요약 규칙과 첫 기록은 `docs/sessions/2026-06-27-ai-folder-reorg.md`에 추가. 문서 본문은 한국어 중심으로 정리. 검증: 오래된 활성 문서 경로 참조 없음, `npm run check:js` 통과.

## 이어서 할 일 (우선순위)

### P1
- ~~**데스크톱 대시보드 밀도**~~ — 완료(위 "완료한 수정 P1-1" 참고).
- ~~**토픽바 과밀 → 설정으로 실제 이동**~~ — 완료(위 "완료한 수정 P1-2" 참고).
- ~~**뷰 상태 URL/History 연동**~~ — 완료(위 "완료한 수정 P1-3" 참고).

### P2
- ~~카드 radius 토큰 통일~~ — 완료. `--radius-xl: 28px` 추가, 토픽바는 xl(28)로 위계 유지, 나머지 주요 카드(app-nav 20→24, journey/settings 22→24, metric/panel + 24px 카드 9종)는 `--radius-lg`(24)로 통일. 모바일 오버라이드도 토큰화(app-nav 도킹 상단 라운드 lg, topbar lg, journey md). `styles.css` :root + 각 카드.
- ~~히스토리 차트 디자인 토큰화~~ — 완료. `app.js`에 `CHART_FONT`(Pretendard 스택)·`chartPalette()`(--line/--muted/--slate/--green/--red를 `getComputedStyle`으로 읽음)·`hexToRgba()` 헬퍼 추가. drawChart/drawXAxisLabels/drawChartBadge의 하드코딩 `#dbe2dc`/`#65716a`/`#657386`/`rgba(101,113,106,*)`/`#44524a`/녹·적 라인색·`Segoe UI` 폰트를 전부 토큰 기반으로 교체. 시드 스냅샷 12건으로 1280 헤드리스 렌더 검증.
- 뷰 전환 시 포커스 이동/`aria-live` 없음, `aria-current="false"` → 접근성 보완.
- 비-자산 뷰에서 빈 `.workspace`(margin-bottom:20px) 죽은 여백. `index.html` ~114 / `styles.css` ~528
- 포트폴리오 도넛 4개 → 문서 권고인 가로 막대(목표 대비 차이 라벨) 비교 검토. `app.js` renderBreakdown ~1602

### 디자인 검토 방식 (Figma 금지)
시드 데이터 + Chrome 헤드리스 스크린샷으로 PC(1440/1280)/모바일(390/430) 실화면 검토. 큰 변경 전엔 정적 preview HTML로 먼저 시안.
