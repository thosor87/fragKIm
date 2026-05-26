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
)
for pkg in "${REMOVE[@]}"; do
  rm -rf "node_modules/$pkg" "backend/node_modules/$pkg" 2>/dev/null || true
done
echo "Vercel-Build fertig, Slim-Pakete entfernt."
