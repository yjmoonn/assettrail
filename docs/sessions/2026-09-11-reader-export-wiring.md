# reader 실행 경로 연결

- 목적: 개별 검증한 인증 갱신/Firestore GET/자료 조립/V3 생성 API 연결.
- 결정: reader UID와 owner UID를 분리하고 동일 UID 사용 거절. 기존 로그인 토큰 탐색 없음.
- 변경: createReaderExporter. 세 번/200회/20MiB source 상한, 인스턴스 동시 실행 거절,
  provider의 갱신 캐시/내구성 저장 callback·invalidation 재사용. 원격 write 기능 없음.
- 검증: 합성 token→owner GET 연결, 연속 실패 후 재호출·토큰 캐시, invalidation 후 재갱신,
  producer commit 오류 시 네트워크 0회. 기존 token/source 테스트 통과.
- 다음: 전용 reader 등록 및 내구성 있는 refresh token 저장소 연결, 운영 Rules 반영 후
  실제 runner 인수 검증. 이 함수만으로 무인 인증 완료를 선언하지 않는다.
