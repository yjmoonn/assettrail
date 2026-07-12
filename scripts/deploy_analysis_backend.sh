#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-assettrail-6f676}"
REGION="${REGION:-asia-northeast3}"
SERVICE_NAME="${SERVICE_NAME:-assettrail-analysis-api}"
RUNTIME_ACCOUNT_NAME="${RUNTIME_ACCOUNT_NAME:-assettrail-analysis-runtime}"
RUNTIME_ACCOUNT="${RUNTIME_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

required_commands=(gcloud npm curl)
for command_name in "${required_commands[@]}"; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: ${command_name}" >&2
    exit 1
  fi
done

active_account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
if [[ -z "${active_account}" ]]; then
  echo "Google Cloud 로그인이 필요합니다. Cloud Shell을 사용하거나 gcloud auth login을 실행하세요." >&2
  exit 1
fi

billing_enabled="$(gcloud billing projects describe "${PROJECT_ID}" --format='value(billingEnabled)' 2>/dev/null || true)"
if [[ "${billing_enabled}" != "True" ]]; then
  echo "${PROJECT_ID} 프로젝트에 결제 계정이 연결되어 있지 않습니다." >&2
  echo "Cloud Run을 만들기 전에 Google Cloud Console에서 결제 연결과 예산 알림을 설정하세요." >&2
  exit 1
fi

echo "배포 계정: ${active_account}"
echo "프로젝트: ${PROJECT_ID}"
echo "리전: ${REGION}"
echo "서비스: ${SERVICE_NAME}"
echo "설정: 1 vCPU, 1 GiB, 최소 0개, 최대 2개 인스턴스"
read -r -p "계속하려면 프로젝트 ID(${PROJECT_ID})를 입력하세요: " confirmation
if [[ "${confirmation}" != "${PROJECT_ID}" ]]; then
  echo "입력이 일치하지 않아 중단했습니다."
  exit 1
fi

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com

if ! gcloud iam service-accounts describe "${RUNTIME_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_ACCOUNT_NAME}" \
    --display-name="AssetTrail analysis runtime" \
    --description="Writes authenticated AssetTrail analysis runs and renders PDFs"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_ACCOUNT}" \
  --role="roles/firebaseauth.viewer" \
  --condition=None >/dev/null

project_number="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
builder_account="${project_number}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${builder_account}" \
  --role="roles/run.builder" \
  --condition=None >/dev/null

deploy_service() {
  gcloud run deploy "${SERVICE_NAME}" \
    --source services/analysis-api \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --platform managed \
    --default-url \
    --ingress all \
    --no-invoker-iam-check \
    --build-service-account "projects/${PROJECT_ID}/serviceAccounts/${builder_account}" \
    --service-account "${RUNTIME_ACCOUNT}" \
    --cpu 1 \
    --memory 1Gi \
    --concurrency 4 \
    --timeout 120 \
    --min 0 \
    --max 2 \
    --min-instances 0 \
    --max-instances 2 \
    --set-env-vars NODE_ENV=production
}

for attempt in 1 2 3; do
  if deploy_service; then
    break
  fi
  if [[ "${attempt}" == "3" ]]; then
    echo "Cloud Run 배포가 3회 실패했습니다. 위 오류를 확인하세요." >&2
    exit 1
  fi
  wait_seconds=$((attempt * 30))
  echo "IAM 권한 전파를 기다린 뒤 Cloud Run 배포를 다시 시도합니다 (${wait_seconds}초)." >&2
  sleep "${wait_seconds}"
done

service_url="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

service_ready=false
for attempt in 1 2 3 4 5 6; do
  if curl --fail --silent --show-error "${service_url}/v1/status" >/dev/null; then
    service_ready=true
    break
  fi
  echo "Cloud Run URL 반영을 기다립니다 (${attempt}/6)." >&2
  sleep 5
done

if [[ "${service_ready}" != "true" ]]; then
  echo "Cloud Run은 배포됐지만 ${service_url}/v1/status 확인에 실패했습니다." >&2
  exit 1
fi

echo "Firestore Rules를 배포합니다. Firebase 로그인이 없다면 먼저 아래 명령을 실행하세요."
echo "npx --yes firebase-tools login --no-localhost"
npx --yes firebase-tools deploy --only firestore --project "${PROJECT_ID}"

echo
echo "배포 완료"
echo "ANALYSIS_API_BASE_URL=${service_url}"
echo "이 URL은 비밀정보가 아닙니다. 다음 앱 설정 단계에 사용하세요."
