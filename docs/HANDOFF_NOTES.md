# Handoff Notes — Product Experience 개선 이어가기

> 로컬 Claude Code 세션에서 진행한 UX/UI 리뷰 + P0 수정 결과입니다.
> 웹/앱(claude.ai/code) 클라우드 세션은 대화 컨텍스트가 이어지지 않으므로, 이 문서를 시작점으로 사용하세요.
> 예: *"docs/HANDOFF_NOTES.md를 읽고 P1 항목부터 이어서 작업해줘."*

서비스 정의/구조는 `docs/PROJECT_CORE.md`, `docs/PRODUCT_EXPERIENCE_REDESIGN.md`, `docs/DATA_AND_PRICES.md` 참고.

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
- **뷰 상태 URL/History 연동** — 해시 기반 라우팅 도입(GitHub Pages 정적 호스팅이라 path pushState는 새로고침 404 → 해시 선택). `viewHash()`/`viewFromHash()` 헬퍼(app.js ~54), `setActiveView`에 `updateHash` 옵션(같은 뷰면 중복 항목 X, `render()`의 호출은 히스토리 미오염), 유저 네비 2곳에 `updateHash:true`, 부트스트랩에서 해시→activeView 복원 + `replaceState` + `popstate`/`hashchange` 리스너. 검증: 최초 `#dashboard`, 네비 클릭 시 해시/히스토리 갱신, 뒤로가기 복귀, 딥링크 새로고침 복원, 잘못된 해시는 대시보드 폴백. 헤드리스 실측 통과.

베이스라인: `check:js` / `test:prices` / `npm test` 모두 통과(exit 0).

## 이어서 할 일 (우선순위)

### P1
- **데스크톱 대시보드 밀도** — 현재 지표4 + 여정카드4뿐이라 1440에서 상단 ~40%만 채우고 빈 공간이 큼. 문서 권고대로 **포트폴리오 비중 가로 막대 + 최근 기록 리스트** 모듈 추가 검토. (`index.html` dashboard-panel, `app.js` renderDashboard)
- **토픽바 과밀 → 설정으로 실제 이동** — 현재 토픽바에 가격갱신/Login/Logout/Sync/Export/Import가 그대로 있고 설정엔 프록시 버튼만 있음(중복). 문서 P0는 "운영 액션을 설정으로 이동". (`index.html` .topbar / .settings-panel)
- ~~**뷰 상태 URL/History 연동**~~ — 완료(위 "완료한 수정 P1-3" 참고).

### P2
- 카드 radius 토큰 통일 (topbar 28 / metric 24 / journey 22 / app-nav 20 혼재 → 토큰화). `styles.css`
- 히스토리 캔버스 차트가 디자인 토큰 밖(색 `#dbe2dc`/`#65716a`, 폰트 `Segoe UI`) → Pretendard/토큰 색으로. `app.js` drawChart ~2335
- 뷰 전환 시 포커스 이동/`aria-live` 없음, `aria-current="false"` → 접근성 보완.
- 비-자산 뷰에서 빈 `.workspace`(margin-bottom:20px) 죽은 여백. `index.html` ~114 / `styles.css` ~528
- 포트폴리오 도넛 4개 → 문서 권고인 가로 막대(목표 대비 차이 라벨) 비교 검토. `app.js` renderBreakdown ~1602

### 디자인 검토 방식 (Figma 금지)
시드 데이터 + Chrome 헤드리스 스크린샷으로 PC(1440/1280)/모바일(390/430) 실화면 검토. 큰 변경 전엔 정적 preview HTML로 먼저 시안.
