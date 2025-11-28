# QuickJS Wasm Gas Schedule (EVM-Inspired)

Injected via `wasm-instrument` mutable global backend.

## Cost Schedule

The gas schedule is defined in `tools/quickjs-gas-instrument/src/main.rs` with the following categories:

| Category | Cost | Example Operations |
| -------- | ----:| ------------------ |
| verylow | 3 | Integer ALU (`i32/i64 add/sub/mul`), const, locals, globals, nop, drop, return, comparisons |
| low | 5 | Type conversions, loads/stores |
| mid | 8 | Control flow (`if`, `else`, `block`, `loop`, `br`, `br_if`, `br_table`, `select`) |
| high | 10 | Indirect call overhead (added to call_base) |
| call_base | 700 | Direct calls |
| call_per_local | 16 | Per-local cost for calls |
| mem_grow_per_page | 3 | Memory growth per 64KiB page (linear cost) |

Mutable global export name: `gas_left`

## Host Gas Conversion

WASM fuel is converted to host gas units using a factor defined in the consumer code (e.g., document-processor):

```
WASM_FUEL_PER_HOST_GAS_UNIT = 162,000
```

This means ~162,000 WASM fuel = 1 host gas unit. The factor was calibrated so that:
- A minimal script (`return 1;`) uses ~15 host gas units
- A 1,000-iteration loop uses ~328 host gas units
- A 10,000-iteration loop uses ~3,006 host gas units

## Building

The instrumented WASM is built as part of the package build process:

```bash
# Build everything (instrument wasm + compile TypeScript)
npm run build

# Or just instrument the wasm
npm run build:c
```

## Calibration

Run calibration tests in the consuming package to capture baseline fuel usage.

## Updating the Schedule

1. Edit `tools/quickjs-gas-instrument/src/main.rs`
2. Run `npm run build:c` to regenerate the instrumented WASM
3. Update calibration snapshots if fuel usage changes

