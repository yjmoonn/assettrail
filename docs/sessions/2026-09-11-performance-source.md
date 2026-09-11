# 성과 자료 검증과 V3 성과 독립 계산

## 목적
브라우저 상태 없이 원장·성과 평가점 검증과 V3 performance를 재현한다.

## 핵심 결정
- performance-source-engine.js가 기존 정규화·지문·NAV 항등식·입출금일 누락·경계 확인 및 데이터 구성을 담당한다. 수익률 공식은 기존 performance-engine.js를 재사용한다.
- 잘못된 원장을 빈 원장으로 바꾸지 않고 INVALID_PERFORMANCE_LEDGER로 거절한다. 가격 지문 형식 일치는 실제 과거 시세 원문 검증이 아니다.
- todayKey를 명시하고 미래/7일 초과 상태를 보존한다. 자료 품질 불충분 시 숫자를 만들지 않는다. 신규 자산 평가나 원장 변경은 수행하지 않는다.

## 변경
- 앱의 성과 화면·AI 근거·V3 출력은 같은 source API로 위임한다. 기존 앱 함수명을 유지하고 runtime manifest/cache key/테스트 로딩을 함께 연결했다.
- API: normalizePerformanceObservation, buildDataset, buildEvidence, buildReviewPerformance. 원장 검증과 지문은 ledger-engine.js, 수익률은 performance-engine.js에 의존한다.
- source의 사용자 인증·read receipt·top-level 상태 검증은 호출자 책임이다. 이 API는 원격 조회 성공을 증명하지 않는다.

## 검증
- 독립 Node에서 100→110 NAV의 10% TWR, stale/future 상태, 지문 변조·원장 불일치·NAV 항등식·결측·수정가격 정책 거절과 입력 불변을 확인했다.
- 기존 성과/AI/source 테스트 통과. 실제 서버의 원장과 평가점으로 계산한 performance는 native V3와 일치하며 INCOMPLETE를 유지했다.
- 실제 서버 상태에 독립 목표·월간 점검·성과 API를 적용하고 저장 평가를 기존 AI 엔진에 전달했다. 브라우저 없이 조립한 전체 V3가 이전 검증된 V3 전체와 일치했다. digest는 sha256:9a38b9506dc1ee7abd711cfd75ba254a7ff4dc5d98fbae2a047edd4975bbc551, 품질 STALE다.
- 전체 npm test(JS·Python·Firestore Rules)는 exit 0으로 통과했다. 실제 원문은 상위 작업의 private 경로에 보존하며 Git에 복사하지 않는다. PR CI는 후속 확인한다.

## 다음 작업
- 원격 source receipt와 전체 V3 조립을 명시적 worker 진입점으로 연결하고 사용자별 읽기 인증을 검증한다.
- 기존 스키마/비정규화 입력을 지원한다고 확장하지 않는다. 오래된 평가·현재 원장 차이를 유지한다.
- DB migration 없음. rollback은 앱·엔진·manifest/cache key를 함께 이전하며 원장과 과거 결과는 보존한다.
