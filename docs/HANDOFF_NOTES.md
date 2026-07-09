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

## 방금 완료한 수정 (성능·Firestore 비용 최적화 8단계, 커밋 e94de0b~2bb0782, 미푸시)
- **키 입력당 클라우드 저장 버그 수정 (e94de0b)** — `addEventListener("input", render)`로 InputEvent가 `syncCloud` 인자에 들어가 은퇴·목표 비중 입력의 키 입력 1회 = setDoc 1회이던 버그. input→`render(false)`, change→`render()`로 분리.
- **pushCloudData dirty-check (46047ee)** — `dataFingerprint` 비교로 동일 데이터면 setDoc 스킵(`upload` 방향은 강제). `syncPriceRequests`도 티커 목록 비교 스킵. 캐시는 `cloud.lastPushedFingerprint`/`lastSyncedPriceTickers`, 로그인 전환 시 리셋·pull 후 세팅.
- **push debounce 2초 + flush (dce302e)** — `render`의 즉시 push → `scheduleCloudPush()`. `window.assetTrailCloudPushDelayMs`로 테스트 오버라이드(cloud-sync 테스트에 0 설정). visibilitychange(hidden)·pagehide·로그아웃·수동 동기화 직전 `flushCloudPush()`, 계정 전환 시 `cancelCloudPush()`. localStorage `persist()`는 즉시 유지.
- **렌더-저장 분리 (aa3a977)** — `renderRetirement`→`saveRetirementInputs`, `renderRebalanceSummary`→`savePortfolioTargets` 호출 제거, 입력 핸들러에서 명시 호출. `syncAssetsBtn`도 값 변경 후 명시 저장. `currentRetirementScenarioInput`은 state만 읽음.
- **필터/검색 뷰 단위 렌더 (85a2fde)** — 자산 검색·필터 7종→`renderAssets()`, historyRange→`renderHistory()`, realizedYear→`renderRealized()`, journalFilter→`renderJournal()`. persist 불필요(uiState는 저장 대상 아님).
- **지연 렌더링 (dab6ddf)** — `VIEW_RENDERERS` 맵 + `dirtyViews` Set. `render()`는 활성 뷰만 즉시, 나머지는 `setActiveView` 진입 시. 부팅은 `renderAllViews()` 전체 1회. **테스트 계약 변경**: 숨겨진 뷰 DOM 검증엔 해당 뷰 전환 클릭 필요 — 4개 jsdom 테스트에 `[data-nav-view="X"].click()` 추가 + `HTMLElement.prototype.scrollIntoView` 목(jsdom 미구현).
- **Intl 포매터 호이스팅 (e07ff7b)** — `money` 등 10곳의 매 호출 `new Intl.*` → 모듈 상수 10종(KRW_FORMATTER 등).
- **중복 통합 (d307196, ac66c00, 2bb0782)** — `bucketTotals()`+`PORTFOLIO_BUCKETS`(합산 3곳→1곳, 순회 12→1회), 날짜 함수 7종의 검사 로직→`toDate`/`formatWithDateFormatter`, 매도·추가매수 폼 리셋→`resetTradeForm`.
- **검증**: 각 단계마다 관련 테스트 + 최종 `npm test` 전체(7종) 통과. 브라우저 육안 검증(1440/1280/390/430)은 미실시 — 다음 확인 권장.
- **스킵**: Phase 9(chartPalette getComputedStyle 캐시) — 지연 렌더링 후 효과 미미로 계획대로 생략.
- **커밋 분리 주의**: 이번 8커밋은 `app.js`+`tests/`만. 기존 미커밋 변경(AGENTS.md·CLAUDE.md·이 문서·prompts/)은 의도적으로 미포함, 푸시도 안 함.

## 방금 완료한 수정 (UI/UX 다듬기 5건, 커밋 4ae7cd2 배포됨)
- **뷰별 상단 제목/부제** — 모든 화면이 "나의 자산 대시보드"로 고정되던 문제. `index.html` H1/부제에 `#pageTitle`/`#pageSubtitle` 부여, `app.js` `VIEW_HEADINGS` 맵 추가 + `setActiveView`에서 갱신. `render()`→`setActiveView` 경로라 초기·딥링크·뒤로가기 모두 반영.
- **히어로 "오늘"→"직전 대비"** — `index.html` `hero-chip-label`. 계산(`renderSummary`, 현재 총액 − 마지막 스냅샷)은 불변, 라벨만 정정(조회 히스토리 표 "직전 대비"와 용어 일치).
- **자산 행/카드 액션 정리** — `renderAssets`(표 행)·`renderAssetCard`에서 수정·삭제 인라인 제거하고 `data-action="detail"` "상세" 버튼으로 통합(상시 노출 빨강 삭제 제거). `handleAssetAction`에 `detail`→`openAssetDetail` 분기 추가(상세 드로어에 추가매수·매도·일지·수정·삭제 5액션 이미 존재). 시장자산=추가매수·매도·일지·상세, 현금/수동=일지·상세.
- **포트폴리오 목표 차이 색 분리** — `renderRebalanceSummary` tone을 `positive/negative`(초록/빨강) → `on-target`/`off-target`로. `styles.css` `.composition-value.off-target`(앰버 `--amber`)/`.on-target`(`--muted`) 추가. 부족/초과 모두 앰버라 손익 색(초록/빨강)과 분리. 대시보드 `renderDashboardComposition`은 원래 무색이라 변경 없음.
- **자산 고급필터 접기** — `index.html` `ledger-toolbar`를 검색+`#ledgerFilterToggle`("필터")+카운트 / `#ledgerAdvancedFilters`(유형·계좌·상태·손익·정렬 5 selects, `hidden`)로 분리. `styles.css` `.ledger-toolbar` 3칸 그리드 + `.ledger-advanced`(auto-fit) + `.filter-toggle`(펼침/적용 시 파란 강조), 중간폭 그리드 오버라이드(1100/900)에서 `.ledger-toolbar` 제외, 모바일(720) flex-wrap + `.ledger-advanced` 2칸. `app.js` els 2개 + 토글 핸들러(hidden/aria-expanded) + `updateLedgerFilterIndicator`("필터 · N", `renderAssets`에서 호출).
- 캐시버스터 `20260628-journal`→`20260628-uxfix`(`styles.css`, `app.js` 두 곳).
- **검증**: `check:js` + `test:prices`/`test:price-fallback`/`test:cloud`/`test:cloud-prices`/`test:price-requests` 통과. 시드 데모 + 헤드리스 Chrome로 데스크톱 1440 / 모바일 390(CDP `Emulation.setDeviceMetricsOverride`) 재캡처 육안 확인 — 자산(제목·액션·필터 접힘/펼침), 포트폴리오(제목·앰버), 대시보드(직전 대비).
- **실행 못한 검증**: `test:firestore` 생략(Rules·데이터 범위 미변경 + 에뮬레이터/Java 필요). 빈 상태·로그인 후 상태는 시드 데모로만 봐서 별도 미검증.
- **커밋 분리 주의**: 이 커밋은 `app.js`/`index.html`/`styles.css`만. 작업 중 `deploy-pages.yml`·`AGENTS.md`·`CLAUDE.md`·`tests/app-cloud-prices`·`tests/app-cloud-sync`·`tests/app-prices`·`prompts/`가 다른 손(동시 도구/이전 세션)으로 미커밋 변경되어 있었고, 의도적으로 미포함.

## 방금 완료한 수정 (투자기록 개편 + 대시보드 박스 넘침, 커밋 7e89616 배포됨)
- **매매일지 카드 개편** — 좌측 색 띠 제거(`.journal-card.review/.done` border-left 규칙 삭제, padding 16px 18px). 상태 배지를 `.journal-badge.status` 단일 → `.status-open`(파랑)/`.status-review`(주황)/`.status-done`(초록)로 분리. `renderJournal`이 `status-${status.toLowerCase()}` 클래스 출력. 매수/매도 배지는 중립(`--surface-3`). 이유·리스크·복기는 `<p><strong>` → `.journal-note > .journal-note-label + p`(키커+본문, 3줄 clamp). 빈 상태는 `.empty-state`(아이콘+안내+작성 유도)로 교체.
- **실현손익 표 11→5열 통합** — `index.html` thead 5개(매도일·종목 / 수량·매도가 / 매도금액 / 실현손익 / 일지), `emptyRealizedTemplate` colspan 11→5. `renderRealizedRows`가 5 `<td>` 출력(종목+`.realized-sub`로 날짜·티커·계좌 묶음, 실현손익 ▲/▼ 부호·색). `styles.css` 끝에 `.journal-note*`/`.realized-sub`/`.realized-date`/`.realized-account`/`.realized-table table{min-width:640px}` 추가.
- **대시보드 "최근 기록" 박스 넘침 해결** — `.dashboard-module`(그리드 아이템이자 그리드 컨테이너)에 `min-width:0`+`grid-template-columns:minmax(0,1fr)`, `.recent-record-list`에 `grid-template-columns:minmax(0,1fr)` 추가. 암시적 auto 트랙이 max-content로 부풀어 텍스트 ellipsis가 안 먹던 문제 해결. 1440px moduleScrollW 526≤528, 390px 가로 스크롤 없음 실측.
- 검증: `npm run check:js` 통과. 프리뷰(1440/390)에서 일지 카드·실현 표 헤더(5열)·최근 기록 클리핑 확인. 배포 성공 후 작업 파일 `app1.js`/`index1.html`/`styles1.css` 삭제. 캐시버스터 `20260628-journal`.

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
- ~~뷰 전환 접근성 보완~~ — 완료. `setActiveView`: 비활성 네비는 `aria-current="false"` 대신 속성 제거(활성만 `page`). 사용자 네비게이션(네비 클릭/일지 분기/popstate/hashchange)에 `focus:true` 추가 → 활성 뷰의 첫 섹션·헤딩(`h1/h2/h3` 폴백은 섹션)에 `tabindex=-1` 부여 후 `focus({preventScroll:true})`로 포커스 이동, `#viewAnnounce`(`role=status`/`aria-live=polite`, sr-only)로 "{뷰명} 화면" 안내. `render()`의 호출(1222)은 `focus` 미설정이라 매 렌더 포커스 가로채기 없음. `styles.css`에 프로그래매틱 포커스 아웃라인 제거 규칙 + `VIEW_LABELS` 맵 추가. 헤드리스로 aria-current/포커스/announce/뒤로가기 검증.
- ~~비-자산 뷰 빈 `.workspace` 죽은 여백~~ — 완료. `.workspace`는 ASSETS 패널만 감싸는 단일 래퍼인데 `display:grid`라 안쪽 패널만 `hidden`되면 래퍼의 `margin-bottom:20px`가 남았음. `data-app-section="ASSETS"`를 안쪽 `.panel.ledger-panel` → `.workspace` 래퍼로 이동해, 비-자산 뷰에서 전역 `[hidden]{display:none!important}`로 래퍼째 제거. 포커스 타깃은 래퍼 하위 `자산 원장` h2를 그대로 탐색. `index.html` ~124.
- ~~포트폴리오 목표 비중 막대화~~ — 완료(사용자 결정: 목표 비교만 막대로, 도넛 4개는 유지). 검토 결론: PORTFOLIO 도넛 4개는 계좌 분류/계좌별/상품 유형/국내·해외의 **다차원 분석**이라 막대로 통째 교체하면 정보 손실. 문서 권고 "가로 막대+목표 대비 차이"는 목표-실제 비교에 해당하므로, 목표 입력 아래 `renderRebalanceSummary`를 대시보드와 동일한 `.composition-*` 막대(현재%바 + 목표 마커 + 초과/부족 금액 톤 라벨 + "현재%·목표%·평가액" 메타)로 전환. 도넛 4종은 그대로. dead `.rebalance-row` CSS 제거(`.sensitivity-item`와 분리), `.rebalance-summary` gap 14px. 임시 prices.json + 4버킷 시드로 1280 헤드리스 검증(국내 초과/해외 부족 등 톤·마커·너비 확인).

### 시각 부채 (다음에 정리)
- "포트 분석" → "포트폴리오 분석" 카피(`index.html` PORTFOLIO 패널 h2).
- 자산 화면 알림 배너 2개(US 가격 대기 + 가격표 상태)를 한 줄 상태바로 통합.
- 모바일 목표 화면 조회 히스토리 표: 값 열(총자산·직전 대비·변동률)이 가로 스크롤 뒤로 숨어 날짜만 먼저 보임.
- 모바일 자산 카드 길이 압축(종목당 카드가 길어 9종목 리스트가 매우 김).

### 디자인 검토 방식 (Figma 금지)
시드 데이터 + Chrome 헤드리스 스크린샷으로 PC(1440/1280)/모바일(390/430) 실화면 검토. 큰 변경 전엔 정적 preview HTML로 먼저 시안.

**모바일 폭 함정**: 헤드리스 `--window-size 390 ...`은 폭을 **500px로 강제 레이아웃한 뒤 390으로 잘라** 캡처한다 → 가짜 우측 클리핑·"하단 내비 탭 누락"처럼 보인다. 진짜 모바일 폭은 CDP `Emulation.setDeviceMetricsOverride({width:390, mobile:true, deviceScaleFactor:2})` + `Page.captureScreenshot({captureBeyondViewport:true})`로 봐야 정확하다.
