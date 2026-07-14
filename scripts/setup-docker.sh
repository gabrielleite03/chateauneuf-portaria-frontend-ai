#!/usr/bin/env sh
set -eu

GOOGLE_CREDENTIALS_FILE=""
GOOGLE_SHEET_ID=""
FRONTEND_IMAGE="gabrielleite03/chateauneuf-portaria-frontend:2026.07.14.1"
BACKEND_IMAGE="gabrielleite03/chateauneuf-portaria-backend:2026.07.14.3"
FRONTEND_PORT="8081"
BACKEND_PORT="18080"
GOOGLE_SHEET_NAME="Entradas"
GOOGLE_DRIVE_FOLDER_ID=""
LOCAL_DATA_DIR="./data"
LOCAL_PHOTO_DIR="./photos"
SYNC_INTERVAL_SECONDS="30"
BUILD="false"
PULL="false"
UP="false"

usage() {
  cat <<EOF
Usage:
  ./scripts/setup-docker.sh --google-credentials-file PATH --google-sheet-id ID [options]

Required:
  --google-credentials-file PATH
  --google-sheet-id ID

Options:
  --frontend-image IMAGE
  --backend-image IMAGE
  --frontend-port PORT
  --backend-port PORT
  --google-sheet-name NAME
  --google-drive-folder-id ID
  --local-photo-dir PATH
  --local-data-dir PATH
  --sync-interval-seconds SECONDS
  --pull
  --build
  --up
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --google-credentials-file)
      GOOGLE_CREDENTIALS_FILE="${2:-}"
      shift 2
      ;;
    --google-sheet-id)
      GOOGLE_SHEET_ID="${2:-}"
      shift 2
      ;;
    --frontend-image)
      FRONTEND_IMAGE="${2:-}"
      shift 2
      ;;
    --backend-image)
      BACKEND_IMAGE="${2:-}"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="${2:-}"
      shift 2
      ;;
    --backend-port)
      BACKEND_PORT="${2:-}"
      shift 2
      ;;
    --google-sheet-name)
      GOOGLE_SHEET_NAME="${2:-}"
      shift 2
      ;;
    --google-drive-folder-id)
      GOOGLE_DRIVE_FOLDER_ID="${2:-}"
      shift 2
      ;;
    --local-photo-dir)
      LOCAL_PHOTO_DIR="${2:-}"
      shift 2
      ;;
    --local-data-dir)
      LOCAL_DATA_DIR="${2:-}"
      shift 2
      ;;
    --sync-interval-seconds)
      SYNC_INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --build)
      BUILD="true"
      shift
      ;;
    --pull)
      PULL="true"
      shift
      ;;
    --up)
      UP="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "$GOOGLE_CREDENTIALS_FILE" ] || [ -z "$GOOGLE_SHEET_ID" ]; then
  usage
  exit 1
fi

if [ ! -f "$GOOGLE_CREDENTIALS_FILE" ]; then
  echo "Google credentials file not found: $GOOGLE_CREDENTIALS_FILE" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SECRETS_DIR="$PROJECT_ROOT/secrets"
TARGET_CREDENTIALS="$SECRETS_DIR/google-service-account.json"
ENV_FILE="$PROJECT_ROOT/.env.docker"

mkdir -p "$SECRETS_DIR"
SOURCE_CREDENTIALS=$(readlink -f "$GOOGLE_CREDENTIALS_FILE" 2>/dev/null || echo "$GOOGLE_CREDENTIALS_FILE")
TARGET_CREDENTIALS_RESOLVED=$(readlink -f "$TARGET_CREDENTIALS" 2>/dev/null || echo "$TARGET_CREDENTIALS")
if [ "$SOURCE_CREDENTIALS" != "$TARGET_CREDENTIALS_RESOLVED" ]; then
  cp "$GOOGLE_CREDENTIALS_FILE" "$TARGET_CREDENTIALS"
fi
chmod 600 "$TARGET_CREDENTIALS" 2>/dev/null || true

cat > "$ENV_FILE" <<EOF
FRONTEND_IMAGE=$FRONTEND_IMAGE
BACKEND_IMAGE=$BACKEND_IMAGE
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
GOOGLE_SHEET_ID=$GOOGLE_SHEET_ID
GOOGLE_SHEET_NAME=$GOOGLE_SHEET_NAME
GOOGLE_DRIVE_FOLDER_ID=$GOOGLE_DRIVE_FOLDER_ID
SYNC_INTERVAL_SECONDS=$SYNC_INTERVAL_SECONDS
LOCAL_DATA_DIR=$LOCAL_DATA_DIR
LOCAL_PHOTO_DIR=$LOCAL_PHOTO_DIR
ALLOWED_ORIGIN=http://localhost:$FRONTEND_PORT
EOF

echo "Docker configuration prepared."
echo "Env file: $ENV_FILE"
echo "Google credentials: $TARGET_CREDENTIALS"
echo "Frontend URL: http://localhost:$FRONTEND_PORT"

if [ "$BUILD" = "true" ]; then
  cd "$PROJECT_ROOT"
  docker compose --env-file .env.docker up --build -d
elif [ "$UP" = "true" ]; then
  cd "$PROJECT_ROOT"
  docker compose --env-file .env.docker pull
  docker compose --env-file .env.docker up -d --no-build --force-recreate
elif [ "$PULL" = "true" ]; then
  cd "$PROJECT_ROOT"
  docker compose --env-file .env.docker pull
  echo "Images pulled. Run 'docker compose --env-file .env.docker up -d --no-build' to start."
fi
