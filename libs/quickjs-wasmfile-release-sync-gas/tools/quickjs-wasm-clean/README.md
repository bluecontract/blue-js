# quickjs-wasm-clean

Minimal, clean-room Emscripten build for the `@jitl/quickjs-wasmfile-release-sync` variant.

- Uses the vendored Bellard QuickJS `2024-02-14` sources with `CONFIG_BIGNUM` and `CONFIG_STACK_CHECK`.
- Shares the interface wrapper and pre-js shims from `tools/quickjs-emscripten/` but avoids its Node/Yarn tooling.
- Exports exactly the functions in `symbols.json` (including GC control helpers `QTS_RuntimeSetGCThreshold` / `QTS_RuntimeCollectGarbage`) so the upstream JS loader continues to work.
- Targets deterministic flags by default (`-s DETERMINISTIC=1 -s MALLOC=emmalloc -s INITIAL_MEMORY=64MB -s ENVIRONMENT=web,worker -O3 --closure 1`).

Run `make -C tools/quickjs-wasm-clean` to produce `emscripten-module-deterministic.wasm` at the library root. Customize via:

- `OUT_WASM` – output path (defaults to `../../emscripten-module-deterministic.wasm`)
- `DETERMINISTIC_FLAGS`, `ENVIRONMENT_FLAGS`, `OPT_FLAGS` – emcc flags
- `EMSDK_VERSION`, `EMSDK_DOCKER_IMAGE`, `EMSDK_USE_DOCKER`, `EMSDK_PROJECT_ROOT` – emscripten toolchain controls  
  `EMSDK_USE_DOCKER` defaults to `1` to force containerized builds; the Docker image explicitly clears it to avoid Docker-in-Docker when running inside the container.
