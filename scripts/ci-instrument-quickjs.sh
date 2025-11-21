#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IN_WASM="${IN_WASM:-$ROOT_DIR/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm}"
OUT_WASM="${OUT_WASM:-$ROOT_DIR/libs/document-processor/quickjs.release.gas.wasm}"

echo "Instrumenting QuickJS wasm"
echo " input : ${IN_WASM}"
echo " output: ${OUT_WASM}"

cargo build --manifest-path "$ROOT_DIR/tools/quickjs-gas-instrument/Cargo.toml" --release --target-dir "$ROOT_DIR/target"
BIN="$ROOT_DIR/target/release/quickjs-gas-instrument"
"$BIN" "$IN_WASM" "$OUT_WASM"

echo "Instrumented wasm written to ${OUT_WASM}"

# Copy into publishable output if the dist/packages directory exists (Nx release uses it)
DEST_PKG_DIR="$ROOT_DIR/dist/packages/document-processor"
if mkdir -p "$DEST_PKG_DIR"; then
  cp "$OUT_WASM" "$DEST_PKG_DIR/quickjs.release.gas.wasm"
  echo "Copied wasm to ${DEST_PKG_DIR}/quickjs.release.gas.wasm"
fi
