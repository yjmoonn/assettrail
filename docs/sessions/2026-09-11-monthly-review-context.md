# 월간 점검 상태 독립 계산

## 목적
V3 reviewStatus를 명시한 기준시각과 시간대로 재현해 무인 exporter에 연결한다.

## 핵심 결정
- 정규화된 snapshots에서 당월 MONTHLY_REVIEW 중 가장 최근 기록을 선택하는 기존 정책을 유지한다. 이전 달 미완료 기록을 새 overdue로 소급 집계하지 않는다.
- 기준시각보다 미래인 월간 기록과 잘못된 createdAt은 차단한다. nextReviewAt 누락/잘못된 날짜는 unscheduled로 보존한다.
- 생성 시각을 새 Date 호출로 바꾸지 않고 V3 generatedAt을 그대로 전달한다.

## 변경
- 기존 순수 엔진에 buildMonthlyReviewStatus를 추가하고 앱이 사용한다. 새 네트워크·스토리지·운영 예약은 없다.
- 앱/엔진 cache key를 함께 갱신한다. DB migration은 없다.

## 검증
- 당일·7일/8일·기한 초과, 월 경계의 KST/UTC 차이, 누락·잘못된 날짜·미래 기록·잘못된 시간대·최신 기록 우선·입력 불변 테스트 통과.
- 실제 서버 snapshots와 native generatedAt으로 계산한 reviewStatus가 기존 native V3와 일치했다.
- 최초 전체 테스트는 공개 API 목록에 새 함수가 누락돼 실패했다. API 계약 테스트를 갱신한 후 관련 AI/source 테스트와 전체 npm test(JS·Python·Firestore Rules, exit 0)를 통과했다. PR CI는 별도 확인한다.

## 다음 작업
- 성과용 검증 dataset과 전체 source 정규화를 브라우저에서 분리한다. 무인 인증 및 최신 평가 인수는 별도다.
- rollback은 앱/엔진/cache key를 함께 되돌리며 과거 평가와 원장은 보존한다.
