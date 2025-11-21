# QuickJS Wasm Gas Schedule (EVM-Inspired)

Injected via `wasm-instrument` mutable global backend.

| Operation class                    | Cost |
| ---------------------------------- | ----:|
| Integer ALU (`i32/i64 add/sub/mul`)|   1  |
| Branch / control flow              |   2  |
| Memory load/store                  |   3  |
| Direct / indirect call             |  10  |
| `memory.grow` base                 | 300  |
| `memory.grow` per 64KiB page       |   3  |

Mutable global export name: `gas_left`

Adjust by editing `tools/quickjs-gas-instrument/src/main.rs` and re-running `scripts/ci-instrument-quickjs.sh`.
