#!/usr/bin/env bash
# Vercel-Build: Frontend + Backend bauen, dann die schweren Optional-
# Pakete aus node_modules entfernen, damit die Serverless-Function unter
# der 250 MB-Grenze bleibt. Diese Pakete werden im Default-Modus
# (RETRIEVAL_PROVIDER=online, LLM_PROVIDER=mistral) nie geladen.
set -euo pipefail

npm run build

REMOVE=(
  "@huggingface"
  "@qdrant"
  "onnxruntime-web"
  "onnxruntime-node"
  "sharp"
  "@img"
)

for root in node_modules backend/node_modules; do
  [ -d "$root" ] || continue
  for pkg in "${REMOVE[@]}"; do
    target="$root/$pkg"
    if [ -e "$target" ]; then
      du -sh "$target" 2>/dev/null | head -1
      rm -rf "$target"
    fi
  done
done

echo "Vercel-Build fertig. Schwer-Pakete entfernt."
du -sh node_modules backend/node_modules 2>/dev/null || true
