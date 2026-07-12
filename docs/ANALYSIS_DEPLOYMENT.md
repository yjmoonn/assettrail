# 분석 백엔드 배포

이 문서는 `services/analysis-api/`와 `firestore.rules`를 실제 프로젝트에 배포하는 1회 절차다. Cloud Run 서비스 생성, API 활성화, IAM 변경, Firestore Rules 배포와 과금 가능성을 포함한다.

## 권장 실행 위치

Google Cloud Console의 Cloud Shell을 사용한다. Cloud Shell에는 `gcloud`가 설치되어 있고 현재 Google 계정으로 인증되므로 로컬 인증정보나 서비스 계정 키를 저장소에 넣을 필요가 없다.

## 배포 전 확인

1. Google Cloud 프로젝트가 `assettrail-6f676`인지 확인한다.
2. 프로젝트에 결제 계정을 연결한다.
3. 예산 알림을 먼저 설정한다.
4. Firebase CLI 인증을 준비한다.

```sh
npx --yes firebase-tools login --no-localhost
```

브라우저에서 본인 계정으로 승인하고 표시된 절차를 완료한다. 토큰, 인증 코드, 서비스 계정 키는 채팅이나 저장소에 복사하지 않는다.

## 실행

Cloud Shell에서 저장소의 `dev` 브랜치를 체크아웃한 뒤 실행한다.

```sh
git clone https://github.com/yjmoonn/assettrail.git
cd assettrail
git checkout dev
bash scripts/deploy_analysis_backend.sh
```

스크립트는 다음 변경만 수행한다.

- Cloud Run, Cloud Build, Artifact Registry, IAM API 활성화
- `assettrail-analysis-runtime` 전용 서비스 계정 생성
- 런타임 계정에 Firestore 사용 권한 부여
- Cloud Build 계정에 Cloud Run 빌더 역할 부여
- 서울 리전에 `assettrail-analysis-api` 배포
- 1 vCPU, 1 GiB, 동시요청 4, 최소 인스턴스 0, 최대 2로 제한
- Firebase 프로젝트에 `firestore.rules` 배포

Cloud Run 자체는 브라우저에서 호출할 수 있도록 공개되지만, 분석 저장과 PDF API는 Firebase ID token을 별도로 검증한다. `/healthz`만 인증 없이 상태를 반환한다.

## 배포 후

마지막에 출력되는 아래 값을 기록한다.

```text
ANALYSIS_API_BASE_URL=https://...
```

URL은 비밀정보가 아니다. `firebase-config.js`의 `analysisApiBaseUrl`에 반영하고 PR에서 실제 로그인·분석 이력·PDF 생성을 검증한다.

## 비용 경계

- 최소 인스턴스를 0으로 설정해 사용하지 않을 때 상시 실행 비용이 발생하지 않게 한다.
- Cloud Run은 사용량 기반 과금이며 무료 사용량을 초과하면 비용이 발생한다.
- 소스 배포 과정에서 Cloud Build와 Artifact Registry를 사용하므로 이미지 저장·빌드 비용이 별도로 발생할 수 있다.
- PDF 생성은 Chromium을 기동하므로 일반 JSON API보다 CPU·메모리 사용량이 크다.
- 예상과 다른 호출 증가에 대비해 Google Cloud 예산 알림과 Cloud Run 최대 인스턴스 제한을 유지한다.

## 되돌리기

서비스를 즉시 비활성화해야 할 때 Cloud Run의 인그레스 또는 IAM을 제한한다. 완전히 제거하려면 Cloud Run 서비스와 Artifact Registry 이미지를 별도로 삭제한다. Firestore Rules는 이전 버전을 다시 배포해야 하므로 배포 전 Firebase Console의 Rules 이력을 확인한다.
