# 원장·이력의 읽기 전용 source 조립

## 목적
저장 평가 입력 공통화에 이어, 별도 worker가 동일 세대의 primary·ledger·history를 읽을 수 있는 경로를 구현한다. 인증이 없는 합성 검수와 실제 사용자 자료 인수를 구분한다.

## 핵심 결정
- 기존 원장 엔진에 `fingerprintLedger`를 옮겨 앱과 reader가 같은 정규화·정렬·cyrb128-v1 구현을 쓴다. origin/main 361d7b4의 빈 원장/현금 기초잔액 기준값과 일치한다. 이 호환 지문을 암호학적 서명으로 표시하지 않는다.
- 기존 history repository의 digest·manifest·개수·월별 shard 검증을 그대로 사용한다.
- `scripts/read_only_source.mjs`는 읽기 전후 primary 전체 원문과 서버 updateTime을 비교한다. revision을 올리지 않은 변경과 내용이 돌아오는 ABA 변경도 감지한다. 최대 3회만 다시 읽는다.
- 생성/갱신/삭제 기능은 없다. 원장 구조 검수와 경제적 수량·잔액 대조, 최신 평가 검수를 서로 구분한다.

## 변경
- `readOnlySource({transport, uid, observedAt, ...limits})`: v9의 활성 ledger 및 분리 history 또는 명시된 inline history를 조립한다. 누락·손상·다른 사용자 경로·문서 ID 불일치·페이지 중복/반복·미래 metadata·한도 초과는 결과를 반환하지 않는다.
- 기본 전체 예산은 200개 HTTP 조회, 정규화 응답 20 MiB, 최대 3회 시도다. 페이지 크기는 10개다. 데이터에 따라 예산 초과로 제한될 수 있으며 전 계정 무제한 조회가 아니다.
- receipt는 source/parts/state digest, primary revision/updateTime, 시도·조회·바이트·항목 수를 기록한다. `economicStateValidated=false`, `latestValuationVerified=false`, `writeCount=0`을 유지한다.
- `scripts/firestore_read_transport.mjs`는 공식 Firestore GET 경로만 사용한다. project/UID와 primary·ledger/events·history/chunks 범위를 고정하고 redirect를 차단한다. 토큰은 호출자가 `getIdToken`으로 제공하며 파일 저장·출력·브라우저 자격증명 추출은 없다.
- 기본 HTTP 제한은 20초/응답 4 MiB다. 페이지 토큰 전달, 문서 updateTime, typed JSON을 처리하며 안전 정수 범위 초과·알 수 없는 값 종류·잘못된 응답·권한 오류를 거절한다. 인증 실패를 무한 재시도하지 않는다.

## 인증 경계
[Firebase REST 인증 문서](https://firebase.google.com/docs/firestore/use-rest-api)는 Firebase ID token 요청에 Security Rules, Google service-account OAuth 요청에 IAM이 적용된다고 설명한다. 이 구현은 Firebase ID token 공급 경로를 받도록 설계했으며 **토큰 자체가 읽기 전용 권한이라는 뜻은 아니다**. 코드의 GET 제한과 서버 권한의 최소화는 별도 검수한다. Rules 변경·서비스 계정 생성·유료 자원·운영 스케줄은 활성화하지 않았다. 현재 실제 ID token 발급/갱신·UID 및 권한 확인은 미완료다.

## 검증
- 합성 source 검수: 분리/inline history, 원장·chunk 변조, 경합 재조회, updateTime만 변하는 ABA, 다른 UID·문서 경로·미래 시각, count 누락, 페이지 반복/중복, 예산, 권한 오류, 다중 페이지 인수.
- HTTP 응답 mock → typed JSON → source 조립 통합 검수: GET만 사용, 토큰·페이지 전달, 초과 정수/크기·404/401/403/429/500·비 JSON·다른 project 차단.
- 새 GET transport로 실제 Firestore 사용자 계정 자료를 호출하지 않았다. 두 테스트를 test:ai-review에 포함했다. 마지막 정렬 수정 후 전체 npm test(JS·Python 가격 계약·Firestore Emulator Rules) exit 0을 확인했다. 로그는 상위 작업 work/assettrail-read-only-source-final-tests.log에 보존하며 실제 REST 인증 성공으로 표시하지 않는다.

## V3 정렬 재현성 후속
실제 브라우저 내보내기와 저장 원본을 별도로 대조하는 과정에서 localeCompare의 호스트 언어에 따라 집중도 누산 순서와 마지막 부동소수점 자릿수가 달라지는 문제가 확인됐다. 새 공통 엔진은 코드 포인트 비교로 정렬한다. 한국어·영어·스웨덴어 VM의 전체 V3 digest가 같음을 확인했고, 이전 코드에서 실제 실패하는 합성 회귀 벡터를 추가했다. 기존 운영 V3의 미세한 집중도 값·digest를 소급 변경하지 않는다. 생성 방법 변경으로 기존 digest와 새 digest가 다를 수 있으며 단순히 같은 자료라고 과거 hash를 교체하지 않는다.

## 다음 작업
- 허용된 identity의 등록·갱신·권한을 확인하고 실제 원본을 수신한다.
- 반환된 source의 자산·원장 경제적 대조, snapshot valuation 정상화, 성과·목표 맥락을 공통 V3 입력에 연결한다. source 무결성 성공만으로 V3 발행하지 않는다.
- 같은 실제 원본으로 브라우저 V3와 worker 결과를 비교한 뒤 private Drive create-only 공급과 최신성 판정을 연결한다.
