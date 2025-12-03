# Clean-room deterministic QuickJS build that mirrors the exports used by
# @jitl/quickjs-wasmfile-release-sync. Produces a wasm compatible with the
# upstream JS loader while avoiding the upstream build scripts.

MAKEFILE_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
LIB_DIR := $(abspath $(MAKEFILE_DIR)/../..)

QUICKJS_ROOT := $(LIB_DIR)/tools/quickjs-emscripten/vendor/quickjs
WRAPPER_ROOT := $(LIB_DIR)/tools/quickjs-emscripten/c
TEMPLATES := $(LIB_DIR)/tools/quickjs-emscripten/templates
EXPORTED_RUNTIME_METHODS := $(LIB_DIR)/tools/quickjs-emscripten/exportedRuntimeMethods.json
SYMBOLS_JSON := $(MAKEFILE_DIR)/symbols.json

EMSDK_VERSION ?= 3.1.65
EMSDK_DOCKER_IMAGE ?= emscripten/emsdk:$(EMSDK_VERSION)
EMSDK_USE_DOCKER ?= 1
EMSDK_PROJECT_ROOT ?= $(LIB_DIR)/tools/quickjs-emscripten
EMSDK_DOCKER_CACHE ?= $(EMSDK_PROJECT_ROOT)/emsdk-cache/$(EMSDK_VERSION)
EMCC_WRAPPER ?= $(LIB_DIR)/tools/quickjs-emscripten/scripts/emcc.sh
EMCC ?= EMSDK_VERSION=$(EMSDK_VERSION) EMSDK_DOCKER_IMAGE=$(EMSDK_DOCKER_IMAGE) EMSDK_PROJECT_ROOT=$(EMSDK_PROJECT_ROOT) EMSDK_DOCKER_CACHE=$(EMSDK_DOCKER_CACHE) EMSDK_USE_DOCKER=$(EMSDK_USE_DOCKER) $(EMCC_WRAPPER)

BUILD_DIR := $(MAKEFILE_DIR)/build
BUILD_WRAPPER := $(BUILD_DIR)/wrapper
BUILD_QUICKJS := $(BUILD_DIR)/quickjs
LINKED_JS := $(BUILD_DIR)/emscripten-module.js
LINKED_WASM := $(BUILD_DIR)/emscripten-module.wasm

OUT_WASM ?= $(LIB_DIR)/emscripten-module-deterministic.wasm

QUICKJS_VERSION := $(shell cat $(QUICKJS_ROOT)/VERSION)
QUICKJS_SOURCES := quickjs.c libregexp.c libunicode.c cutils.c quickjs-libc.c libbf.c
QUICKJS_OBJECTS := $(patsubst %.c,$(BUILD_QUICKJS)/%.o,$(QUICKJS_SOURCES))

DETERMINISTIC_FLAGS ?= -s DETERMINISTIC=1 -s MALLOC=emmalloc -s INITIAL_MEMORY=64MB -s ERROR_ON_UNDEFINED_SYMBOLS=0
ENVIRONMENT_FLAGS ?= -s ENVIRONMENT=web,worker
OPT_FLAGS ?= -O3 --closure 1 -flto

COMMON_WASM_FLAGS := -s EXPORTED_RUNTIME_METHODS=@$(EXPORTED_RUNTIME_METHODS)
COMMON_WASM_FLAGS += -s MODULARIZE=1
COMMON_WASM_FLAGS += -s IMPORTED_MEMORY=1
COMMON_WASM_FLAGS += -s EXPORT_NAME=QuickJSRaw
COMMON_WASM_FLAGS += -s INVOKE_RUN=0
COMMON_WASM_FLAGS += -s ALLOW_MEMORY_GROWTH=1
COMMON_WASM_FLAGS += -s ALLOW_TABLE_GROWTH=1
COMMON_WASM_FLAGS += -s STACK_SIZE=5MB
COMMON_WASM_FLAGS += -s SUPPORT_ERRNO=0
COMMON_WASM_FLAGS += -s IGNORE_MISSING_MAIN=0 --no-entry
COMMON_WASM_FLAGS += -s AUTO_JS_LIBRARIES=0
COMMON_WASM_FLAGS += -s -lccall.js
COMMON_WASM_FLAGS += -s AUTO_NATIVE_LIBRARIES=0
COMMON_WASM_FLAGS += -s AUTO_ARCHIVE_INDEXES=0
COMMON_WASM_FLAGS += -s DEFAULT_TO_CXX=0
COMMON_WASM_FLAGS += -s ALLOW_UNIMPLEMENTED_SYSCALLS=0
COMMON_WASM_FLAGS += -s MIN_NODE_VERSION=160000
COMMON_WASM_FLAGS += -s NODEJS_CATCH_EXIT=0
COMMON_WASM_FLAGS += -s FILESYSTEM=0
COMMON_WASM_FLAGS += --pre-js $(TEMPLATES)/pre-extension.js
COMMON_WASM_FLAGS += --pre-js $(TEMPLATES)/pre-wasmMemory.js

EMCC_FLAGS := $(COMMON_WASM_FLAGS) $(ENVIRONMENT_FLAGS) $(DETERMINISTIC_FLAGS) $(OPT_FLAGS)
EMCC_LINK_FLAGS := $(EMCC_FLAGS) -s EXPORTED_FUNCTIONS=@$(SYMBOLS_JSON)

CFLAGS_COMMON := -fwrapv -I$(QUICKJS_ROOT) -D_GNU_SOURCE -DCONFIG_VERSION=\"$(QUICKJS_VERSION)\" -DCONFIG_STACK_CHECK -DCONFIG_BIGNUM
CFLAGS_ALL := $(CFLAGS_COMMON) $(EMCC_FLAGS)

.PHONY: all clean

all: $(OUT_WASM)

$(OUT_WASM): $(LINKED_JS)
	@mkdir -p $(dir $@)
	cp $(LINKED_WASM) $@
	@echo "Copied wasm to $@"

$(LINKED_JS): $(BUILD_WRAPPER)/interface.o $(QUICKJS_OBJECTS) | $(SYMBOLS_JSON)
	@mkdir -p $(dir $@)
	$(EMCC) $(EMCC_LINK_FLAGS) $(BUILD_WRAPPER)/interface.o $(QUICKJS_OBJECTS) -o $@

$(BUILD_WRAPPER)/interface.o: $(WRAPPER_ROOT)/interface.c $(SYMBOLS_JSON)
	@mkdir -p $(dir $@)
	$(EMCC) $(CFLAGS_ALL) -Wcast-function-type -c -o $@ $<

$(BUILD_QUICKJS)/%.o: $(QUICKJS_ROOT)/%.c
	@mkdir -p $(dir $@)
	$(EMCC) $(CFLAGS_ALL) -c -o $@ $<

clean:
	rm -rf $(BUILD_DIR)
