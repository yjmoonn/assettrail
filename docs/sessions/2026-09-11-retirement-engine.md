# 은퇴 계산과 V3 목표 맥락 분리

## 목적
읽기 전용 exporter가 브라우저·전역 앱 상태 없이 기존 은퇴 계산과 goal 출력을 재현한다.

## 핵심 결정
- 기본값·검증·필요자산·요구수익률 계산을 하나의 순수 엔진으로 옮기고 앱이 위임한다. 계산식과 기본값 차이에 기반한 기존 설정 여부 판정은 유지한다.
- 입력은 생산자에서 정규화한 retirement다. 외부 인증·원장·현재 가격의 유효성을 이 엔진이 증명하지 않는다.
- 날짜 진행으로 사용자가 입력한 나이를 자동 변경하지 않으며, 자체 네트워크·저장·DOM 의존성은 없다.

## 변경
- `retirement-engine.js`의 `buildGoalContext`가 저장 retirement에서 V3 goal을 직접 구성한다.
- 기존 앱 함수명을 유지한 위임과 static manifest·cache key·테스트 모듈 로딩을 함께 변경한다.
- 상위 Assistant에 생산자 코드를 복사하지 않는다. 데이터 migration과 운영 배포는 없다.

## 검증
- 독립 Node/VM에서 기본값 미확인·입력 오류·은퇴 즉시/목표 충족·동일 성장/수익률·무기여 불가능 및 폐쇄형 계산을 검수했다.
- 기존 HEAD의 계산 함수와 48개 조건의 결과가 정확히 일치했다.
- 실제 서버 읽기 입력의 retirement를 독립 엔진으로 계산한 goal이 기존 native V3 goal과 일치했다. 실제 금액·개인 자료는 Git에 넣지 않았다.
- check:js 및 AI 내보내기/입력/source 테스트 통과. 전체 npm test도 exit 0으로 통과했다(JS·Python·Firestore Emulator Rules 포함). 이후 추가한 static script 순서 assertion도 관련 테스트를 다시 실행해 통과했다. PR CI는 별도로 확인한다.

## 다음 작업
- 성과용 검증 데이터 구성과 monthly review 상태 선택을 독립 엔진에 연결한다.
- 최신 저장 평가와 현재 원장을 구분하고 무인 identity 권한 범위·공급 경로를 확인한다.
- rollback은 app/cache key/static manifest와 새 엔진을 함께 이전 상태로 되돌리며 사용자 자료는 변경하지 않는다.
