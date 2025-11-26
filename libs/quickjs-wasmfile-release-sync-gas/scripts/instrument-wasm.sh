#!/usr/bin/env bash
set -euo pipefail

# Directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Library root directory
LIB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# Workspace root directory
ROOT_DIR="$(cd "$LIB_DIR/../.." && pwd)"

IN_WASM="${IN_WASM:-$ROOT_DIR/node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm}"
OUT_WASM="${OUT_WASM:-$LIB_DIR/quickjs.release.gas.wasm}"
TARGET_DIR="${TARGET_DIR:-$LIB_DIR/target}"

echo "Instrumenting QuickJS wasm"
echo " input : ${IN_WASM}"
echo " output: ${OUT_WASM}"

cargo build --manifest-path "$LIB_DIR/tools/quickjs-gas-instrument/Cargo.toml" --release --target-dir "$TARGET_DIR"
BIN="$TARGET_DIR/release/quickjs-gas-instrument"
"$BIN" --input "$IN_WASM" --output "$OUT_WASM"

echo "Instrumented wasm written to ${OUT_WASM}"

