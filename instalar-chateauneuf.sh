#!/usr/bin/env sh
set -eu

GOOGLE_SHEET_ID="ID_DA_SUA_PLANILHA"

if [ "$GOOGLE_SHEET_ID" = "ID_DA_SUA_PLANILHA" ]; then
  echo "Edite este arquivo e troque ID_DA_SUA_PLANILHA pelo ID real da planilha." >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_SCRIPT="$SCRIPT_DIR/install-workstation.sh"

if [ ! -f "$INSTALL_SCRIPT" ]; then
  INSTALL_SCRIPT="$SCRIPT_DIR/scripts/install-workstation.sh"
fi

if [ ! -f "$INSTALL_SCRIPT" ]; then
  echo "Arquivo install-workstation.sh nao encontrado." >&2
  echo "Coloque install-workstation.sh na mesma pasta deste script ou em ./scripts." >&2
  exit 1
fi

chmod +x "$INSTALL_SCRIPT" 2>/dev/null || true
exec "$INSTALL_SCRIPT" --google-sheet-id "$GOOGLE_SHEET_ID"
