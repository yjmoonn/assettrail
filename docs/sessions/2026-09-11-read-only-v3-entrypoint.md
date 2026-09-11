# 읽기 전용 V3 실행 진입점

## 목적
검증된 서버 source를 브라우저 없이 V3로 변환하고 조회·생성 근거를 묶는다.

## 핵심 결정
- source receipt의 상태 해시·개수·schema 9·조회 시각·원장 구조와 지문을 확인한다. 자체 해시는 인증 증명이 아니다.
- 최신 저장 snapshot을 선택하고 기존 목표·성과·월간 점검 엔진으로 V3를 조립한다. 현재 가격 재평가나 원장 쓰기를 하지 않는다.
- currentAllocationEligible/authenticationVerifiedByBuilder/latestValuationVerified는 false다. STALE/불완전 성과를 정상으로 승격하지 않는다.

## 변경
- scripts/export_review.mjs: buildSourceReview, GET transport를 받는 readOnlyReview, offline CLI.
- CLI: `node scripts/export_review.mjs --source PRIVATE_SOURCE --output NEW_PRIVATE_OUTPUT --generated-at ISO_MILLISECONDS_Z --producer-commit FULL_SHA`.
- 기본 시간대 Asia/Seoul, 입력 20 MiB 한도, 생성 시각 이후 snapshot 거절, 출력 0600·배타적 생성·fsync. 오류는 원문/경로/자격증명 대신 고정 코드만 출력한다.
- provenance receipt는 producer commit, source state/receipt digest, review digest와 시각을 기록한다. CLI의 commit 인자는 호출자가 실제 실행 revision과 대조해야 한다.

## 검증
- source 해시/개수/원장 변조, 미래 시각, 미지원 schema, 잘못된 시간대·commit의 조회 전 거절, 파일 권한과 덮어쓰기 거절 테스트 통과.
- 전체 npm test(JS·Python·Firestore Rules)는 exit 0으로 통과했다. 실제 source 대조는 후속 기록한다. 이 테스트는 무인 인증·클라우드 실행 증명이 아니다.

## 다음 작업
- 사용자 경로로 제한된 읽기 identity와 실제 cloud runner를 연결한다. DB 전체 IAM 허용은 별도 범위 결정 전 적용하지 않는다.
- 저장 평가의 오래된 가격, 실제 현재 원장/경제적 평가, PC-off 실행은 별도 검증한다.
- 데이터 migration 없음. 이전 commit으로 실행기를 되돌리되 private 결과와 receipt는 보존한다.
