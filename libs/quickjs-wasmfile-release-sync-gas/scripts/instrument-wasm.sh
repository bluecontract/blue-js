#!/usr/bin/env bash
set -euo pipefail

# Pinned Rust Docker image for deterministic builds across all platforms
RUST_DOCKER_IMAGE="rust:1.91.1-slim"

# Directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Library root directory
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Workspace root directory
ROOT_DIR="$(cd "$LIB_DIR/../.." && pwd)"

BUILT_WASM="${LIB_DIR}/emscripten-module-deterministic.wasm"
IN_WASM="${IN_WASM:-}"
if [ -z "$IN_WASM" ] && [ -f "$BUILT_WASM" ]; then
  IN_WASM="$BUILT_WASM"
fi
IN_WASM="${IN_WASM:-$ROOT_DIR/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm}"
OUT_WASM="${OUT_WASM:-$LIB_DIR/emscripten-module-gas.wasm}"
TARGET_DIR="${TARGET_DIR:-$LIB_DIR/tools/quickjs-gas-instrument/target}"

echo "Instrumenting QuickJS wasm"
echo " input : ${IN_WASM}"
echo " output: ${OUT_WASM}"

# Use Docker by default for deterministic builds
# Set USE_DOCKER=false to use native Rust toolchain instead
use_docker() {
  if [ "${USE_DOCKER:-true}" = "false" ]; then
    return 1
  fi
  # Verify Docker is available
  if ! docker info &>/dev/null; then
    echo "ERROR: Docker is required for deterministic builds but is not running."
    echo "       Start Docker or set USE_DOCKER=false to use native toolchain."
    exit 1
  fi
  return 0
}

if use_docker; then
  echo " mode  : Docker (${RUST_DOCKER_IMAGE}) [linux/amd64]"
  # Use Docker with explicit linux/amd64 platform to ensure deterministic builds
  # across macOS ARM, macOS Intel, and Linux CI runners.
  # Use a separate target directory (target-docker) to avoid conflicts with native builds.
  docker run --rm \
    --platform linux/amd64 \
    -v "$ROOT_DIR:/workspace" \
    -w /workspace \
    "$RUST_DOCKER_IMAGE" \
    bash -c "
      cargo build \
        --manifest-path /workspace/libs/quickjs-wasmfile-release-sync-gas/tools/quickjs-gas-instrument/Cargo.toml \
        --release \
        --target-dir /workspace/libs/quickjs-wasmfile-release-sync-gas/tools/quickjs-gas-instrument/target-docker
      
      /workspace/libs/quickjs-wasmfile-release-sync-gas/tools/quickjs-gas-instrument/target-docker/release/quickjs-gas-instrument \
        --input /workspace/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm \
        --output /workspace/libs/quickjs-wasmfile-release-sync-gas/emscripten-module-gas.wasm
    "
else
  echo " mode  : Native (WARNING: may produce different output on different platforms)"
  cargo build --manifest-path "$LIB_DIR/tools/quickjs-gas-instrument/Cargo.toml" --release --target-dir "$TARGET_DIR"
  BIN="$TARGET_DIR/release/quickjs-gas-instrument"
  "$BIN" --input "$IN_WASM" --output "$OUT_WASM"
fi

echo "Instrumented wasm written to ${OUT_WASM}"
