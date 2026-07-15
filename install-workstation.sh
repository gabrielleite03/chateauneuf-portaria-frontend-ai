#!/usr/bin/env sh
set -eu

GOOGLE_SHEET_ID=""
INSTALL_DIR="$HOME/ChateauneufPortaria"
SOURCE_DIR=""
PACKAGE_FILE="chateauneuf-docker-setup.zip"
FRONTEND_IMAGE="gabrielleite03/chateauneuf-portaria-frontend:2026.07.15.6"
BACKEND_IMAGE="gabrielleite03/chateauneuf-portaria-backend:2026.07.15.1"
FRONTEND_PORT="8081"
FRONTEND_HTTPS_PORT="8443"
BACKEND_PORT="18080"
GOOGLE_SHEET_NAME="Entradas"
SYNC_INTERVAL_SECONDS="30"
NO_START="false"
SKIP_DOCKER_INSTALL="false"

usage() {
  cat <<EOF
Uso:
  ./install-workstation.sh --google-sheet-id ID_DA_SUA_PLANILHA [opcoes]

Obrigatorio:
  --google-sheet-id ID

Opcoes:
  --install-dir PATH
  --source-dir PATH
  --package-file PATH
  --frontend-image IMAGE
  --backend-image IMAGE
  --frontend-port PORT
  --frontend-https-port PORT
  --backend-port PORT
  --google-sheet-name NAME
  --sync-interval-seconds SECONDS
  --no-start
  --skip-docker-install
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --google-sheet-id)
      GOOGLE_SHEET_ID="${2:-}"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="${2:-}"
      shift 2
      ;;
    --source-dir)
      SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --package-file)
      PACKAGE_FILE="${2:-}"
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
    --frontend-https-port)
      FRONTEND_HTTPS_PORT="${2:-}"
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
    --sync-interval-seconds)
      SYNC_INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --no-start)
      NO_START="true"
      shift
      ;;
    --skip-docker-install)
      SKIP_DOCKER_INSTALL="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opcao desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "$GOOGLE_SHEET_ID" ]; then
  usage
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -z "$SOURCE_DIR" ]; then
  SOURCE_DIR="$SCRIPT_DIR"
fi

run_sudo() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "Este comando precisa de sudo/root: $*" >&2
    exit 1
  fi
}

docker_info() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    run_sudo docker "$@"
  fi
}

install_docker_desktop_or_engine() {
  if [ "$SKIP_DOCKER_INSTALL" = "true" ]; then
    echo "Docker nao encontrado. Instale Docker manualmente ou execute sem --skip-docker-install." >&2
    exit 1
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Docker nao encontrado e este instalador automatico suporta apenas distribuicoes com apt." >&2
    exit 1
  fi

  echo "Docker nao encontrado. Instalando Docker Engine via apt..."
  run_sudo apt-get update
  run_sudo apt-get install -y ca-certificates curl gnupg unzip
  run_sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  run_sudo chmod a+r /etc/apt/keyrings/docker.gpg

  . /etc/os-release
  DOCKER_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  if [ -z "$DOCKER_CODENAME" ]; then
    echo "Nao foi possivel detectar o codename Ubuntu para o repositorio Docker." >&2
    exit 1
  fi

  ARCH=$(dpkg --print-architecture)
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $DOCKER_CODENAME stable" | run_sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  run_sudo apt-get update
  run_sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  if [ "$(id -u)" -ne 0 ]; then
    run_sudo usermod -aG docker "$USER" || true
  fi
}

ensure_unzip() {
  if command -v unzip >/dev/null 2>&1; then
    return
  fi
  if command -v apt-get >/dev/null 2>&1; then
    run_sudo apt-get update
    run_sudo apt-get install -y unzip
    return
  fi
  echo "Comando unzip nao encontrado. Instale unzip e execute novamente." >&2
  exit 1
}

extract_package() {
  package_path="$1"

  set +e
  unzip -o "$package_path"
  unzip_code="$?"
  set -e

  if [ "$unzip_code" -eq 0 ]; then
    return
  fi

  # Windows-built ZIPs can make Info-ZIP return 1 only because entries use
  # backslashes. If the required files exist after extraction, continue.
  if [ "$unzip_code" -eq 1 ] &&
    [ -f "scripts/setup-docker.sh" ] &&
    [ -f "secrets/google-service-account.json" ] &&
    [ -f "docker-compose.yml" ]; then
    echo "ZIP extraido com aviso compativel com Linux. Continuando..."
    return
  fi

  echo "Falha ao extrair $package_path. Codigo de saida: $unzip_code" >&2
  exit "$unzip_code"
}

ensure_docker_ready() {
  if ! command -v docker >/dev/null 2>&1; then
    install_docker_desktop_or_engine
  fi

  if docker_info; then
    return
  fi

  if command -v systemctl >/dev/null 2>&1; then
    echo "Iniciando servico Docker..."
    run_sudo systemctl start docker || true
  elif command -v service >/dev/null 2>&1; then
    echo "Iniciando servico Docker..."
    run_sudo service docker start || true
  fi

  echo "Aguardando Docker ficar pronto..."
  attempts=0
  while [ "$attempts" -lt 36 ]; do
    if docker_info; then
      echo "Docker pronto."
      if ! docker info >/dev/null 2>&1; then
        echo "Aviso: usando Docker com sudo nesta execucao. Para usar sem sudo futuramente, encerre a sessao e entre novamente."
      fi
      return
    fi
    attempts=$((attempts + 1))
    sleep 5
  done

  echo "Docker foi instalado/encontrado, mas o usuario atual ainda nao consegue usa-lo." >&2
  echo "Tente: sudo systemctl status docker" >&2
  echo "Se voce acabou de instalar, encerre a sessao e entre novamente para ativar o grupo docker." >&2
  exit 1
}

copy_distribution_file() {
  file_name="$1"
  source_path="$SOURCE_DIR/$file_name"
  target_path="$INSTALL_DIR/$file_name"

  if [ ! -f "$source_path" ]; then
    echo "Arquivo obrigatorio nao encontrado: $source_path" >&2
    exit 1
  fi

  source_resolved=$(readlink -f "$source_path" 2>/dev/null || echo "$source_path")
  target_resolved=$(readlink -f "$target_path" 2>/dev/null || echo "$target_path")
  if [ "$source_resolved" != "$target_resolved" ]; then
    cp "$source_path" "$target_path"
  fi
}

if [ "$NO_START" != "true" ]; then
  ensure_docker_ready
fi

mkdir -p "$INSTALL_DIR"
copy_distribution_file "docker-compose.yml"
copy_distribution_file ".env.docker.example"

PACKAGE_NAME=$(basename "$PACKAGE_FILE")
SOURCE_PACKAGE_PATH="$SOURCE_DIR/$PACKAGE_NAME"
SOURCE_IS_EXTRACTED="false"
if [ -f "$SOURCE_DIR/scripts/setup-docker.sh" ] && [ -f "$SOURCE_DIR/secrets/google-service-account.json" ]; then
  SOURCE_IS_EXTRACTED="true"
fi

if [ -f "$SOURCE_PACKAGE_PATH" ]; then
  ensure_unzip
  copy_distribution_file "$PACKAGE_NAME"
  (cd "$INSTALL_DIR" && extract_package "$PACKAGE_NAME")
  copy_distribution_file "docker-compose.yml"
  copy_distribution_file ".env.docker.example"
elif [ "$SOURCE_IS_EXTRACTED" = "true" ]; then
  cp -R "$SOURCE_DIR/scripts" "$INSTALL_DIR/"
  cp -R "$SOURCE_DIR/secrets" "$INSTALL_DIR/"
else
  echo "Nao encontrei $PACKAGE_NAME nem um pacote extraido valido em: $SOURCE_DIR" >&2
  exit 1
fi

SETUP_SCRIPT="$INSTALL_DIR/scripts/setup-docker.sh"
CREDENTIALS_FILE="$INSTALL_DIR/secrets/google-service-account.json"

if [ ! -f "$SETUP_SCRIPT" ]; then
  echo "Script de configuracao nao encontrado: $SETUP_SCRIPT" >&2
  exit 1
fi
if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "Credencial Google nao encontrada: $CREDENTIALS_FILE" >&2
  exit 1
fi

chmod +x "$SETUP_SCRIPT" 2>/dev/null || true

if [ "$NO_START" = "true" ]; then
  "$SETUP_SCRIPT" \
    --google-credentials-file "$CREDENTIALS_FILE" \
    --google-sheet-id "$GOOGLE_SHEET_ID" \
    --frontend-image "$FRONTEND_IMAGE" \
    --backend-image "$BACKEND_IMAGE" \
    --frontend-port "$FRONTEND_PORT" \
    --frontend-https-port "$FRONTEND_HTTPS_PORT" \
    --backend-port "$BACKEND_PORT" \
    --google-sheet-name "$GOOGLE_SHEET_NAME" \
    --local-data-dir "./data" \
    --local-photo-dir "./photos" \
    --local-cert-dir "./certs" \
    --sync-interval-seconds "$SYNC_INTERVAL_SECONDS"
else
  "$SETUP_SCRIPT" \
    --google-credentials-file "$CREDENTIALS_FILE" \
    --google-sheet-id "$GOOGLE_SHEET_ID" \
    --frontend-image "$FRONTEND_IMAGE" \
    --backend-image "$BACKEND_IMAGE" \
    --frontend-port "$FRONTEND_PORT" \
    --frontend-https-port "$FRONTEND_HTTPS_PORT" \
    --backend-port "$BACKEND_PORT" \
    --google-sheet-name "$GOOGLE_SHEET_NAME" \
    --local-data-dir "./data" \
    --local-photo-dir "./photos" \
    --local-cert-dir "./certs" \
    --sync-interval-seconds "$SYNC_INTERVAL_SECONDS" \
    --up
fi

FRONTEND_URL="http://localhost:$FRONTEND_PORT"
FRONTEND_HTTPS_URL="https://localhost:$FRONTEND_HTTPS_PORT"

echo ""
echo "Instalacao preparada em: $INSTALL_DIR"
echo "Aplicacao: $FRONTEND_URL"
echo "Aplicacao HTTPS: $FRONTEND_HTTPS_URL"

if [ "$NO_START" != "true" ] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FRONTEND_HTTPS_URL" >/dev/null 2>&1 || true
fi

echo ""
echo "Verificar containers:"
if docker info >/dev/null 2>&1; then
  echo "  cd $INSTALL_DIR && docker compose --env-file .env.docker ps"
else
  echo "  cd $INSTALL_DIR && sudo docker compose --env-file .env.docker ps"
fi
echo ""
echo "Ver logs:"
if docker info >/dev/null 2>&1; then
  echo "  cd $INSTALL_DIR && docker compose --env-file .env.docker logs -f"
else
  echo "  cd $INSTALL_DIR && sudo docker compose --env-file .env.docker logs -f"
fi
echo ""
echo "Parar:"
if docker info >/dev/null 2>&1; then
  echo "  cd $INSTALL_DIR && docker compose --env-file .env.docker down"
else
  echo "  cd $INSTALL_DIR && sudo docker compose --env-file .env.docker down"
fi
echo ""
echo "Subir novamente:"
if docker info >/dev/null 2>&1; then
  echo "  cd $INSTALL_DIR && docker compose --env-file .env.docker up -d"
else
  echo "  cd $INSTALL_DIR && sudo docker compose --env-file .env.docker up -d"
fi
