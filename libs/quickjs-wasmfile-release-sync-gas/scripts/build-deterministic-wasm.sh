#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$LIB_DIR/../.." && pwd)"

OUT_WASM="${OUT_WASM:-$LIB_DIR/emscripten-module-deterministic.wasm}"
DOCKERFILE="${DOCKERFILE:-$LIB_DIR/Dockerfile}"

# When running inside the Docker build stage, skip the Docker wrapper and build
# directly with the clean-room Makefile. BuildKit may not set /.dockerenv, so
# also honor an explicit flag.
if [ "${INSIDE_DETERMINISTIC_CONTAINER:-}" = "1" ] || [ -f "/.dockerenv" ]; then
  echo "Building deterministic QuickJS wasm inside container (no Docker wrapper)"
  if [ "${CLEAN_FIRST:-0}" != "0" ]; then
    make -C "$LIB_DIR/tools/quickjs-wasm-clean" clean
  fi
  make -C "$LIB_DIR/tools/quickjs-wasm-clean" OUT_WASM="$OUT_WASM"
  echo "Deterministic wasm written to ${OUT_WASM}"
  echo "Next: IN_WASM=${OUT_WASM} ${LIB_DIR}/scripts/instrument-wasm.sh"
  exit 0
fi

if [ ! -f "$DOCKERFILE" ]; then
  echo "ERROR: Dockerfile not found at ${DOCKERFILE}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required for the deterministic build." >&2
  exit 1
fi

echo "Building deterministic QuickJS wasm via Docker"
echo " dockerfile : ${DOCKERFILE}"
echo " context    : ${WORKSPACE_ROOT}"
echo " output wasm: ${OUT_WASM}"

BUILD_ARGS=()
if [ -n "${QUICKJS_REPO:-}" ]; then
  BUILD_ARGS+=(--build-arg "QUICKJS_REPO=${QUICKJS_REPO}")
fi
if [ -n "${QUICKJS_BRANCH:-}" ]; then
  BUILD_ARGS+=(--build-arg "QUICKJS_BRANCH=${QUICKJS_BRANCH}")
fi
if [ -n "${QUICKJS_COMMIT:-}" ]; then
  BUILD_ARGS+=(--build-arg "QUICKJS_COMMIT=${QUICKJS_COMMIT}")
fi
if [ -n "${DOCKER_BUILD_EXTRA_ARGS:-}" ]; then
  # shellcheck disable=SC2206
  EXTRA_ARR=(${DOCKER_BUILD_EXTRA_ARGS})
  BUILD_ARGS+=("${EXTRA_ARR[@]}")
fi

OUTPUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUTPUT_DIR"' EXIT

DOCKER_CMD=(docker build -f "$DOCKERFILE" -o "$OUTPUT_DIR")
if [ ${#BUILD_ARGS[@]} -gt 0 ]; then
  DOCKER_CMD+=("${BUILD_ARGS[@]}")
fi
DOCKER_CMD+=("$WORKSPACE_ROOT")

"${DOCKER_CMD[@]}"

DOCKER_ARTIFACT="${OUTPUT_DIR}/emscripten-module-deterministic.wasm"
if [ ! -f "$DOCKER_ARTIFACT" ]; then
  echo "ERROR: Docker build did not produce ${DOCKER_ARTIFACT}" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_WASM")"
cp "$DOCKER_ARTIFACT" "$OUT_WASM"

echo "Deterministic wasm written to ${OUT_WASM}"
echo "Next: IN_WASM=${OUT_WASM} ${LIB_DIR}/scripts/instrument-wasm.sh"
