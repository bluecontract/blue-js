# QuickJS Gas Metering: Determinism Analysis

## Executive Summary

**Goal**: Achieve deterministic gas metering for JavaScript code execution across all platforms (macOS, Linux, CI environments).

**Current Status**: The WASM-level gas metering approach **cannot provide cross-platform determinism** due to fundamental limitations in how QuickJS executes JavaScript.

**Finding**: Even with identical WASM binaries (verified by SHA-256 checksums), gas consumption differs by ~651 units between macOS and Linux due to V8 runtime differences in WASM execution.

---

## The Original Problem

Tests measuring gas consumption produced different values on local development machines vs GitHub CI:

| Test Case   | Local (macOS) | CI (Linux)  | Difference |
| ----------- | ------------- | ----------- | ---------- |
| `return 1;` | 2,436,121     | 2,436,772   | **651**    |
| loop-1k     | 53,128,144    | 53,128,795  | **651**    |
| loop-10k    | 486,743,029   | 486,743,680 | **651**    |

The difference is **constant (651)** across all test cases, regardless of code complexity.

---

## Investigation Steps

### 1. Build Environment Differences

**Hypothesis**: Different Rust compiler versions produce different WASM instrumentation.

**Actions taken**:

- Pinned Rust version to 1.91.1 via `rust-toolchain.toml`
- Added Rust toolchain setup to CI workflow
- Committed `Cargo.lock` for dependency pinning

**Result**: ❌ Did not resolve the issue.

### 2. Host Platform Differences

**Hypothesis**: macOS ARM64 vs Linux x86_64 produces different compiled binaries.

**Actions taken**:

- Modified build script to use Docker with explicit `--platform linux/amd64`
- Ensured identical Rust Docker image (`rust:1.91.1-slim`) on all platforms
- Used separate `target-docker/` directory to avoid cache contamination

**Result**: ❌ Did not resolve the issue.

### 3. WASM Binary Verification

**Actions taken**:

- Added checksum verification step to CI
- Compared SHA-256 hashes of input and output WASM files

**Results**:

```
Input WASM (npm):  0c031dd404df00f2d1ed9491a6590d014e88a50424996e5fd70feff1c931c045
Output WASM:       31601c0567716717cf549715e8da191d8faebb00087d2e90b5b3257b2cc40f99
```

**Finding**: ✅ **WASM files are byte-for-byte identical** between local and CI!

### 4. Node.js Version Differences

**Hypothesis**: Different Node.js versions have different V8 engines.

**Actions taken**:

- Updated CI to use Node.js 22 (matching local development)

**Result**: ❌ Did not resolve the issue.

---

## Root Cause Analysis

### The Fundamental Issue

The WASM-level gas metering counts **all WASM instructions**, including:

- QuickJS bytecode interpreter operations ✅
- JIT compilation overhead ❌
- Garbage collection operations ❌
- Memory allocation/deallocation ❌
- Internal QuickJS housekeeping ❌

The non-deterministic overhead (JIT, GC, memory) varies by platform even when:

- The WASM binary is identical
- The JavaScript code is identical
- The Node.js version is the same

### Evidence: Same-Machine Variance

Even on the **same machine**, gas consumption varies between runtime creations:

```javascript
// Test results from same machine, same code
First runtime/context:  36,645,737
Second runtime/context: 36,532,411
Third runtime/context:  36,576,520
// Difference: up to 113,326 between runs!
```

Within the **same context**, subsequent evaluations are more stable but still vary:

```javascript
Run 1: 53,995,366  // First run - includes JIT compilation
Run 2: 2,792,261   // After warmup
Run 3: 2,789,191   // Slight variance
Run 4: 2,747,237   // More variance
Run 5: 2,763,057   // Still varying
```

---

## Code Examples from Investigation

### Test 1: Runtime Creation Variance

This test shows that even on the same machine, creating new runtimes produces different gas consumption:

```javascript
import('@blue-labs/quickjs-wasmfile-release-sync-gas').then(async ({ gasVariant, setGasBudget, getGasRemaining }) => {
  const { newQuickJSWASMModuleFromVariant } = await import('quickjs-emscripten');

  const LIMIT = 10_000_000_000n;
  const module = await newQuickJSWASMModuleFromVariant(gasVariant);

  // First evaluation - includes initialization overhead
  setGasBudget(module, LIMIT);
  const rt1 = module.newRuntime();
  const ctx1 = rt1.newContext();
  ctx1.evalCode('1');
  const gas1 = LIMIT - getGasRemaining(module);
  ctx1.dispose();
  rt1.dispose();

  // Second evaluation - should have less overhead
  setGasBudget(module, LIMIT);
  const rt2 = module.newRuntime();
  const ctx2 = rt2.newContext();
  ctx2.evalCode('1');
  const gas2 = LIMIT - getGasRemaining(module);
  ctx2.dispose();
  rt2.dispose();

  // Third evaluation - same runtime/context
  setGasBudget(module, LIMIT);
  const rt3 = module.newRuntime();
  const ctx3 = rt3.newContext();
  ctx3.evalCode('1');
  const firstEval = LIMIT - getGasRemaining(module);

  setGasBudget(module, LIMIT);
  ctx3.evalCode('1');
  const secondEval = LIMIT - getGasRemaining(module);

  console.log('First runtime/context:', gas1.toString());
  console.log('Second runtime/context:', gas2.toString());
  console.log('Third runtime - first eval:', firstEval.toString());
  console.log('Third runtime - second eval (same ctx):', secondEval.toString());
  console.log('Diff between runtimes:', (gas1 - gas2).toString());

  ctx3.dispose();
  rt3.dispose();
});
```

**Output:**

```
First runtime/context: 36645737
Second runtime/context: 36532411
Third runtime - first eval: 36576520
Third runtime - second eval (same ctx): 512118
Diff between runtimes: 113326
```

### Test 2: Same-Context Evaluation Variance

This test shows variance even within the same context after warmup:

```javascript
import('@blue-labs/quickjs-wasmfile-release-sync-gas').then(async ({ gasVariant, setGasBudget, getGasRemaining }) => {
  const { newQuickJSWASMModuleFromVariant } = await import('quickjs-emscripten');

  const LIMIT = 10_000_000_000n;
  const module = await newQuickJSWASMModuleFromVariant(gasVariant);
  const rt = module.newRuntime();
  const ctx = rt.newContext();

  // Warmup - discard first evaluation
  setGasBudget(module, LIMIT);
  ctx.evalCode('1');

  // Now measure multiple evaluations
  const results = [];
  for (let i = 0; i < 5; i++) {
    setGasBudget(module, LIMIT);
    ctx.evalCode('let x = 0; for(let i=0; i<1000; i++) x += i; x');
    results.push((LIMIT - getGasRemaining(module)).toString());
  }

  console.log('Evaluations after warmup:');
  results.forEach((r, i) => console.log('  Run ' + (i + 1) + ':', r));
  console.log('All identical:', new Set(results).size === 1);

  ctx.dispose();
  rt.dispose();
});
```

**Output:**

```
Evaluations after warmup:
  Run 1: 53995366
  Run 2: 2792261
  Run 3: 2789191
  Run 4: 2747237
  Run 5: 2763057
All identical: false
```

### Test 3: Interrupt Handler Determinism

This test shows that the interrupt handler IS deterministic (but coarse-grained):

```javascript
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from 'quickjs-emscripten';

const module = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

function countedEval(code) {
  let counter = 0;
  const rt = module.newRuntime();
  rt.setInterruptHandler(() => {
    counter++;
    return false; // don't interrupt
  });
  const ctx = rt.newContext();
  ctx.evalCode(code);
  ctx.dispose();
  rt.dispose();
  return counter;
}

console.log('100 iterations:', countedEval('let x = 0; for(let i=0; i<100; i++) x += i; x'));
console.log('1000 iterations:', countedEval('let x = 0; for(let i=0; i<1000; i++) x += i; x'));
console.log('10000 iterations:', countedEval('let x = 0; for(let i=0; i<10000; i++) x += i; x'));
console.log('100000 iterations:', countedEval('let x = 0; for(let i=0; i<100000; i++) x += i; x'));
console.log('');
console.log('Repeated 10000:');
for (let i = 0; i < 5; i++) {
  console.log('  Run ' + (i + 1) + ':', countedEval('let x = 0; for(let i=0; i<10000; i++) x += i; x'));
}
```

**Output:**

```
100 iterations: 1
1000 iterations: 1
10000 iterations: 3
100000 iterations: 21

Repeated 10000:
  Run 1: 3
  Run 2: 3
  Run 3: 3
  Run 4: 3
  Run 5: 3
```

**Key Finding**: The interrupt handler gives **consistent counts** (3 every time for 10k iterations), proving it's deterministic. However, it's too coarse-grained (~10k operations per interrupt) for precise gas metering.

### Test 4: Verifying Platform Information

```bash
# Check local Rust target
rustc --print cfg | grep target
```

**Output (macOS M1/M2):**

```
target_arch="aarch64"
target_os="macos"
target_vendor="apple"
```

**CI Output (Linux):**

```
target_arch="x86_64"
target_os="linux"
target_vendor="unknown"
```

### Test 5: Docker Platform Check

```bash
docker info 2>/dev/null | grep -E "Architecture|OSType|Kernel"
```

**Output (on macOS with Docker Desktop):**

```
Kernel Version: 6.10.14-linuxkit
OSType: linux
Architecture: aarch64  # ARM64 on M1/M2 Mac
```

This is why we added `--platform linux/amd64` to force x86_64 emulation.

---

## How EVM Achieves Determinism

The Ethereum Virtual Machine (EVM) guarantees deterministic gas consumption because:

1. **Simple Stack Machine**: No JIT compilation, pure interpretation
2. **Fixed Opcode Costs**: Each opcode has a predetermined gas cost
3. **No GC During Execution**: Memory is managed differently
4. **No Platform Dependencies**: Execution is completely abstracted from hardware

### EVM Gas Metering Pseudocode

```
for each opcode in bytecode:
    gas_cost = OPCODE_COSTS[opcode]
    if gas_remaining < gas_cost:
        throw OutOfGas
    gas_remaining -= gas_cost
    execute(opcode)
```

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      JavaScript Code                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   QuickJS Interpreter                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Parser    │  │  Bytecode   │  │     GC      │         │
│  │             │  │  Executor   │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              QuickJS WASM Binary (Instrumented)              │
│                                                              │
│   Every WASM instruction decrements gas_left global:         │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  i32.add  → gas_left -= 3                            │  │
│   │  call     → gas_left -= 700                          │  │
│   │  i32.load → gas_left -= 5                            │  │
│   │  ...etc                                               │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  V8 WASM Runtime (Node.js)                   │
│                                                              │
│   Platform-specific optimizations affect execution:          │
│   • Different memory layouts on macOS vs Linux               │
│   • Different WASM compilation strategies                    │
│   • Different timing of internal operations                  │
└─────────────────────────────────────────────────────────────┘
```

**The Problem**: We're metering at the WASM level, but the WASM includes ALL QuickJS operations, not just the JavaScript bytecode execution.

---

## Possible Solutions

### Option 1: Accept Platform Variance (Current Workaround)

**Approach**: Test for proportional behavior rather than exact values.

**Pros**:

- No code changes required
- Works for execution limits (preventing infinite loops)

**Cons**:

- Cannot be used for consensus/billing
- Different platforms will compute different gas costs

```typescript
// Test checks relative scaling, not exact values
expect(return1.fuel).toBeGreaterThan(2_400_000n);
expect(return1.fuel).toBeLessThan(2_500_000n);
expect(scalingRatio).toBeGreaterThan(8.5);
expect(scalingRatio).toBeLessThan(10.5);
```

### Option 2: Bytecode-Level Metering (Requires QuickJS Fork)

**Approach**: Modify QuickJS C source to count bytecode operations instead of WASM instructions.

**Required Changes**:

1. Add counter to `JSRuntime` struct in `quickjs.h`:

```c
typedef struct JSRuntime {
    // ... existing fields ...
    uint64_t opcode_counter;
    uint64_t opcode_limit;
} JSRuntime;
```

2. Modify interpreter loop in `quickjs.c`:

```c
// In JS_CallInternal, main interpreter loop
for(;;) {
    rt->opcode_counter++;
    if (rt->opcode_limit && rt->opcode_counter > rt->opcode_limit) {
        return JS_ThrowInternalError(ctx, "opcode limit exceeded");
    }

    switch(op) {
        // existing opcode handlers...
    }
}
```

3. Add FFI functions:

```c
void JS_SetOpcodeLimit(JSRuntime *rt, uint64_t limit);
uint64_t JS_GetOpcodeCount(JSRuntime *rt);
void JS_ResetOpcodeCount(JSRuntime *rt);
```

**Pros**:

- True determinism across all platforms
- Similar to EVM gas model

**Cons**:

- Requires forking and maintaining QuickJS
- Significant development effort (2-4 days)
- Need to recompile WASM with each QuickJS update

### Option 3: Use QuickJS Interrupt Handler

**Approach**: Use the existing interrupt handler mechanism with finer granularity.

**Current behavior**: Interrupt handler called ~every 10,000 operations.

```javascript
let counter = 0;
runtime.setInterruptHandler(() => {
  counter++;
  return counter > limit;
});
```

**Pros**:

- No QuickJS source modifications
- Deterministic count values

**Cons**:

- Very coarse granularity (~10k ops per increment)
- Not suitable for fine-grained billing

### Option 4: Use a Different JavaScript Engine

**Alternatives**:

- **Duktape**: Simpler engine, easier to meter
- **Hermes** (Facebook): Has some metering support
- **Custom interpreter**: Full control but massive effort

---

## Recommendations

### For Execution Limits Only (Preventing Abuse)

Use the current WASM metering. The variance is small (~0.03%) and acceptable for preventing infinite loops or runaway scripts.

### For Deterministic Billing/Consensus

Implement **Option 2** (bytecode-level metering). This is the only way to achieve true cross-platform determinism, similar to how EVM works.

### Interim Solution

Keep the current implementation with range-based tests. Document that:

1. Gas values may vary slightly (~651 units) between platforms
2. Gas is accurate for limiting execution, not for precise billing
3. Future work will implement bytecode-level metering if consensus requirements arise

---

## Technical Details

### Build Configuration

The instrumented WASM is built using:

- **Input**: `@jitl/quickjs-wasmfile-release-sync` v0.31.0
- **Instrumenter**: `wasm-instrument` v0.4.0 (Rust)
- **Gas Schedule**: EVM-inspired costs (see `gas-schedule.md`)
- **Docker Image**: `rust:1.91.1-slim` with `--platform linux/amd64`

### Verified Checksums

| File        | SHA-256                                                            |
| ----------- | ------------------------------------------------------------------ |
| Input WASM  | `0c031dd404df00f2d1ed9491a6590d014e88a50424996e5fd70feff1c931c045` |
| Output WASM | `31601c0567716717cf549715e8da191d8faebb00087d2e90b5b3257b2cc40f99` |

These checksums are **identical** between local macOS and Linux CI, proving the WASM binary is deterministic.

---

## Conclusion

The WASM-level gas metering approach provides **consistent scaling** but not **exact determinism** across platforms. The ~651 unit variance (0.03%) comes from V8 runtime differences, not from our instrumentation.

For true EVM-like determinism, a bytecode-level metering solution is required, which involves modifying QuickJS's C source code.
