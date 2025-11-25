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

WASM fuel is converted to host gas units using the factor defined in `gas-schedule.ts`:

```
WASM_FUEL_PER_HOST_GAS_UNIT = 162,000
```

This means ~162,000 WASM fuel = 1 host gas unit. The factor was calibrated so that:
- A minimal script (`return 1;`) uses ~15 host gas units
- A 1,000-iteration loop uses ~328 host gas units
- A 10,000-iteration loop uses ~3,006 host gas units

## Calibration

Run calibration tests to capture baseline fuel usage:

```bash
NX_DAEMON=false nx test document-processor --testNamePattern="fuel"
```

## Updating the Schedule

1. Edit `tools/quickjs-gas-instrument/src/main.rs`
2. Run `scripts/ci-instrument-quickjs.sh` to regenerate the instrumented WASM
3. Update calibration snapshots if fuel usage changes
