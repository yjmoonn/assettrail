# 사용자 경로 제한 reader 규칙 검증

## 목적
기본 DB 전체 get/list IAM 대신 특정 사용자 자료만 읽는 무인 identity의 권한 경계를 검수한다.

## 핵심 결정
- scripts/reader_rules.mjs는 현행 rules, 별도 reader UID, 대상 owner UID, UTC 만료일을 받아 제안 규칙을 반환하는 순수 함수다. 운영 firestore.rules나 firebase.json을 변경하지 않는다.
- reader는 대상 primary 단건 get 및 해당 경로의 ledger events/history chunks read만 허용한다. primary 컬렉션 list, backups, analysis 문서, 다른 사용자 경로와 모든 쓰기는 허용하지 않는다.
- reader 자신의 UID 경로도 기존 signedInAs 조건에서 제외한다. 그렇지 않으면 전용 reader가 자신의 primary를 쓸 수 있어 모든 쓰기 금지 조건을 만족하지 못한다.
- 별도 reader UID는 기존 사용자를 재사용하면 안 된다. UID 등록/소유관계 확인은 아직 수행하지 않았다. 만료 이후에도 reader 자신의 쓰기를 허용하지 않는다.
- 생성된 rules는 실제 UID를 포함하므로 승인 전 private 검수물로 취급한다. 생성은 인증 발급이나 운영 배포가 아니다.

## 변경
- renderReaderRules: UID/date 검증, 동일 reader/owner 거절, 편집 기준 문구의 중복·누락 시 BASE_DRIFT 거절.
- tests/reader-rules.test.mjs: synthetic UID 전용 demo 프로젝트에서 허용 read와 권한 부정 경로를 검사한다. test:firestore에 포함했다.

## 검증
- 기본 rules 테스트와 새 reader 에뮬레이터 테스트 exit 0. 지정 primary/원장/이력 읽기 및 하위 목록 조회 허용; 다른 사용자/익명/backup/preferences/analysis/상위 목록/collection-group 조회 거절.
- reader의 기존 문서 덮어쓰기·update·delete와 새 ledger event 쓰기 거절. 기존 소유자의 primary/preferences 쓰기·ledger append는 유지하며 ledger 수정/삭제는 거절한다.
- 과거 만료일 규칙에서는 reader get/list가 모두 거절되고 소유자 쓰기는 유지된다. 미래/과거 날짜로 검사했으며 정확한 만료 경계 초의 시계 주입 검증은 하지 않았다.
- 전체 npm test(JS·Python·Firestore Rules)도 exit 0으로 통과했다. 운영 Auth/Firestore/IAM은 변경하지 않았다.

## 다음 작업
- 검토한 범위의 reader enrollment/갱신·회수 방식을 확정하고 실제 Rules 배포 diff를 별도로 준비한다. refresh token 노출/만료/회수도 검수한다.
- Firebase ID token으로 Rules가 적용되는 요청 경로를 사용한다. IAM/관리자 요청은 이 규칙을 우회하므로 해당 자격증명을 reader에 주지 않는다.
- Rollback은 새 규칙 배포 전 이전 rules를 보존하고 전용 읽기 허용만 회수한다. 원장/과거 결과를 변경하지 않는다.
- 공식 근거: https://firebase.google.com/docs/firestore/security/rules-conditions 및 https://firebase.google.com/docs/rules/unit-tests, REST 인증 구분은 https://firebase.google.com/docs/firestore/use-rest-api (2026-09-11 확인).
