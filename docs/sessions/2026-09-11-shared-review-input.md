# 저장 평가 기반 V3 입력 구성 공유

## 목적
AssetTrail 앱과 향후 읽기 전용 exporter가 같은 저장 평가 → V3 입력 구성 코드를 사용하도록 브라우저 의존성을 분리한다.

## 핵심 결정
- `buildSnapshotReviewInput`을 기존 `ai-review-export-engine.js`에 추가한다. 상위 Assistant 저장소에는 코드를 복사하지 않는다.
- 입력은 **이미 정상화·검증한 하나의 저장 snapshot**과 별도 검증한 performance/goal/reviewStatus다. Firestore primary/chunk를 읽거나 원장 일관성을 검사하는 API가 아니다.
- `generatedAt`과 `timeZone`을 명시해 가격의 평일 경과일을 재현한다. 기본 시간대는 Asia/Seoul이며 앱은 사용자 브라우저 시간대를 전달한다. 거래소 휴장일 인증을 새로 수행하는 것은 아니다.
- 평가 기준일은 snapshot.createdAt에서 파생한다. 호출자가 별도 asOfDate를 넣어 저장 평가를 최신으로 바꿀 수 없다. 현재 자산·계좌명·가격을 소급 결합하지 않는다.
- 동일 계좌·종목을 합칠 때 종가·가격일·환율·상품종류 등 평가 기준이 다르면 차단한다.

## 변경
- 앱은 최신 snapshot 선택과 성과·목표·점검 상태 계산을 담당한다. 평가 포지션·집중도·자산군 비중·품질 입력 구성은 공통 엔진에 위임한다.
- v1 계좌명 누락, 평가 없는 legacy 기록, 저장 가격의 STALE/UNAVAILABLE 상태를 보존한다. V3 schema와 기존 고정 프롬프트·digest 계약은 그대로다.
- 정적 파일 cache key를 함께 변경해 새로운 앱과 엔진이 연결되게 한다. 신규 런타임 파일·네트워크·인증·자동 발행·스케줄은 추가하지 않는다.

## 검증
- 기존 V3 엔진/앱 내보내기 테스트 통과.
- Node와 독립 VM에서 동일 합성 입력 결과 일치. 계좌별 합산·ISA 분리·기초자산 집중도, 입력 불변, 안정 digest, 날짜·시간대·주말·stale 경계, legacy·누락, 충돌 차단 검수.
- 전체 `npm test` exit 0: JavaScript, Python 가격 생성 계약, Firestore Emulator Rules 포함. Python 3.14의 기존 검수 환경과 Java 21을 사용했다. 로그는 상위 작업의 work/assettrail-shared-input-tests.log에 보존한다. PR CI는 후속 결과로 기록한다. 실제 보유자산 최신 조회·무인 인증·운영 배포 완료를 뜻하지 않는다.

## 다음 작업
- 현재 검증된 source revision과 원장·history manifest/chunk를 일관되게 읽는 producer adapter 및 제한된 읽기 identity를 연결한다.
- 같은 실제 원본으로 브라우저 V3와 worker V3를 대조하고, 평가 저장일과 현재 원장의 간격을 source receipt에 명시한다.
- private Drive create-only 발행과 consumer 인수 이후에도 저장 평가가 오래됐다면 최신 자산 배분을 제한한다.
