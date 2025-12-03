# syntax=docker/dockerfile:1.7
FROM emscripten/emsdk:3.1.65 AS build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends git python3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY libs/quickjs-wasmfile-release-sync-gas /workspace/lib

WORKDIR /workspace/lib
ARG QUICKJS_REPO="https://github.com/mjwebblue/quickjs-emscripten.git"
ARG QUICKJS_BRANCH="feature/gc"
ARG QUICKJS_COMMIT="ba5ae554b937e2f4f678d036d88b08b6e7757147"
RUN rm -rf tools/quickjs-emscripten && \
    git clone --depth 1 --branch "${QUICKJS_BRANCH}" "${QUICKJS_REPO}" tools/quickjs-emscripten && \
    if [ -n "${QUICKJS_COMMIT}" ]; then \
      git -C tools/quickjs-emscripten fetch --depth 1 origin "${QUICKJS_COMMIT}" && \
      git -C tools/quickjs-emscripten checkout "${QUICKJS_COMMIT}"; \
    fi

RUN mkdir -p /workspace/artifacts
ENV OUT_WASM=/workspace/artifacts/emscripten-module-deterministic.wasm
ENV CLEAN_FIRST=1
# Build inside the container without requiring nested Docker
ENV INSIDE_DETERMINISTIC_CONTAINER=1
# emcc is already available in the base image, so make sure the helper does not
# try to spin up another Docker daemon.
ENV EMSDK_USE_DOCKER=
RUN ./scripts/build-deterministic-wasm.sh

FROM scratch AS artifact
COPY --from=build /workspace/artifacts/emscripten-module-deterministic.wasm /emscripten-module-deterministic.wasm
