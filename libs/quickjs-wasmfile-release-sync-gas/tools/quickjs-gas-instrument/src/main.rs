use std::{fs, num::NonZeroU32, path::PathBuf};

use anyhow::{Context, Result};
use clap::Parser;
use wasm_instrument::gas_metering::{
    inject, mutable_global, ConstantCostRules, MemoryGrowCost, Rules,
};
use wasm_instrument::parity_wasm::elements::Module;
use wasm_instrument::parity_wasm::{deserialize_buffer, serialize};

/// EVM-ish cost schedule with grouped categories.
#[derive(Debug, Clone)]
struct EvmLikeRules {
    verylow: u32,
    low: u32,
    mid: u32,
    high: u32,
    call_base: u32,
    call_per_local: u32,
    mem_grow_per_page: u32,
}

enum SelectedRules {
    Evm(EvmLikeRules),
    Const(ConstantCostRules),
}

impl Rules for SelectedRules {
    fn instruction_cost(
        &self,
        instr: &wasm_instrument::parity_wasm::elements::Instruction,
    ) -> Option<u32> {
        match self {
            SelectedRules::Evm(r) => r.instruction_cost(instr),
            SelectedRules::Const(r) => r.instruction_cost(instr),
        }
    }

    fn memory_grow_cost(&self) -> MemoryGrowCost {
        match self {
            SelectedRules::Evm(r) => r.memory_grow_cost(),
            SelectedRules::Const(r) => r.memory_grow_cost(),
        }
    }

    fn call_per_local_cost(&self) -> u32 {
        match self {
            SelectedRules::Evm(r) => r.call_per_local_cost(),
            SelectedRules::Const(r) => r.call_per_local_cost(),
        }
    }
}

impl Default for EvmLikeRules {
    fn default() -> Self {
        Self {
            verylow: 3,
            low: 5,
            mid: 8,
            high: 10,
            call_base: 700,
            call_per_local: 16,
            mem_grow_per_page: 3,
        }
    }
}

impl Rules for EvmLikeRules {
    fn instruction_cost(
        &self,
        instr: &wasm_instrument::parity_wasm::elements::Instruction,
    ) -> Option<u32> {
        use wasm_instrument::parity_wasm::elements::Instruction::*;
        Some(match instr {
            // simple const/locals/globals/returns
            I32Const(_) | I64Const(_) | F32Const(_) | F64Const(_) | GetLocal(_) | SetLocal(_)
            | TeeLocal(_) | GetGlobal(_) | SetGlobal(_) | Nop | Drop | Return => self.verylow,

            // unary / comparison
            I32Eqz | I64Eqz | I32Clz | I32Ctz | I32Popcnt | I64Clz | I64Ctz | I64Popcnt
            | F32Abs | F32Neg | F32Ceil | F32Floor | F32Trunc | F32Nearest | F32Sqrt | F64Abs
            | F64Neg | F64Ceil | F64Floor | F64Trunc | F64Nearest | F64Sqrt => self.verylow,

            // binary arithmetic/bitwise/compare
            I32Add | I32Sub | I32Mul | I32DivU | I32DivS | I32RemU | I32RemS | I32And | I32Or
            | I32Xor | I32Shl | I32ShrU | I32ShrS | I32Rotl | I32Rotr | I64Add | I64Sub
            | I64Mul | I64DivU | I64DivS | I64RemU | I64RemS | I64And | I64Or | I64Xor | I64Shl
            | I64ShrU | I64ShrS | I64Rotl | I64Rotr | F32Add | F32Sub | F32Mul | F32Div
            | F32Min | F32Max | F32Copysign | F64Add | F64Sub | F64Mul | F64Div | F64Min
            | F64Max | F64Copysign | I32Eq | I32Ne | I32LtS | I32LtU | I32GtS | I32GtU | I32LeS
            | I32LeU | I32GeS | I32GeU | I64Eq | I64Ne | I64LtS | I64LtU | I64GtS | I64GtU
            | I64LeS | I64LeU | I64GeS | I64GeU | F32Eq | F32Ne | F32Lt | F32Gt | F32Le | F32Ge => {
                self.verylow
            }

            // conversions
            I32WrapI64 | I64ExtendSI32 | I64ExtendUI32 | I32TruncSF32 | I32TruncUF32
            | I32TruncSF64 | I32TruncUF64 | I64TruncSF32 | I64TruncUF32 | I64TruncSF64
            | I64TruncUF64 | F32ConvertSI32 | F32ConvertUI32 | F32ConvertSI64 | F32ConvertUI64
            | F64ConvertSI32 | F64ConvertUI32 | F64ConvertSI64 | F64ConvertUI64 | F32DemoteF64
            | F64PromoteF32 | I32ReinterpretF32 | I64ReinterpretF64 | F32ReinterpretI32
            | F64ReinterpretI64 => self.low,

            // loads / stores
            I32Load(..) | I64Load(..) | F32Load(..) | F64Load(..) | I32Load8S(..)
            | I32Load8U(..) | I32Load16S(..) | I32Load16U(..) | I64Load8S(..) | I64Load8U(..)
            | I64Load16S(..) | I64Load16U(..) | I64Load32S(..) | I64Load32U(..) | I32Store(..)
            | I64Store(..) | F32Store(..) | F64Store(..) | I32Store8(..) | I32Store16(..)
            | I64Store8(..) | I64Store16(..) | I64Store32(..) => self.low,

            // control flow
            Select | If(_) | Else | End | Block(_) | Loop(_) | Br(_) | BrIf(_) | BrTable(_) => {
                self.mid
            }

            // calls
            Call(_) => self.call_base,
            CallIndirect { .. } => self.high + self.call_base,

            // memory size / grow
            CurrentMemory(_) => self.verylow,
            GrowMemory(_) => self.mem_grow_per_page,

            // fallback
            _ => self.mid,
        })
    }

    fn memory_grow_cost(&self) -> MemoryGrowCost {
        let per_page =
            NonZeroU32::new(self.mem_grow_per_page).unwrap_or_else(|| NonZeroU32::new(1).unwrap());
        MemoryGrowCost::Linear(per_page)
    }

    fn call_per_local_cost(&self) -> u32 {
        self.call_per_local
    }
}

/// CLI arguments for the gas instrumenter.
#[derive(Debug, Parser)]
#[command(
    name = "quickjs-gas-instrument",
    about = "Inject gas metering into a QuickJS wasm"
)]
struct Args {
    /// Input wasm path (e.g., node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm)
    #[arg(long)]
    input: PathBuf,
    /// Output wasm path (e.g., libs/quickjs-wasmfile-release-sync-gas/emscripten-module-gas.wasm)
    #[arg(long)]
    output: PathBuf,
    /// Exported mutable global name that tracks gas left
    #[arg(long, default_value = "gas_left")]
    global: String,
    /// Use uniform constant cost instead of the EVM-like schedule
    #[arg(long)]
    constant_cost: Option<u32>,
    /// Override memory.grow per-page cost
    #[arg(long)]
    grow_per_page: Option<u32>,
}

fn main() -> Result<()> {
    let args = Args::parse();

    let input_bytes = fs::read(&args.input)
        .with_context(|| format!("Reading input wasm at {}", args.input.display()))?;
    let mut module: Module =
        deserialize_buffer(&input_bytes).context("Deserializing input wasm")?;

    // Choose ruleset
    let rules = if let Some(cost) = args.constant_cost {
        SelectedRules::Const(ConstantCostRules::new(
            cost, /*mem_grow=*/ 0, /*call_per_local=*/ 0,
        ))
    } else {
        let mut rules = EvmLikeRules::default();
        if let Some(per_page) = args.grow_per_page {
            rules.mem_grow_per_page = per_page;
        }
        SelectedRules::Evm(rules)
    };

    // mutable_global backend: injects exported global and gas charging glue
    let leaked_global: &'static str = Box::leak(args.global.clone().into_boxed_str());
    let backend = mutable_global::Injector::new(leaked_global);

    module = inject(module, backend, &rules)
        .map_err(|_| anyhow::anyhow!("Injecting gas metering failed"))?;

    // Ensure non-zero initial gas so module init cannot trap before host sets it.
    bump_gas_global_init(
        &mut module,
        leaked_global,
        9_000_000_000_000i64, // large default; host will override per evaluation
    );

    let output_bytes = serialize(module).context("Serializing instrumented module")?;
    fs::write(&args.output, output_bytes)
        .with_context(|| format!("Writing instrumented wasm to {}", args.output.display()))?;

    Ok(())
}

fn bump_gas_global_init(module: &mut Module, export_name: &str, initial: i64) {
    let Some(exports) = module.export_section() else {
        return;
    };
    let gas_global_index = exports.entries().iter().find_map(|e| match e.internal() {
        wasm_instrument::parity_wasm::elements::Internal::Global(index)
            if e.field() == export_name =>
        {
            Some(*index as usize)
        }
        _ => None,
    });

    let Some(idx) = gas_global_index else {
        return;
    };

    if let Some(globals) = module.global_section_mut() {
        if let Some(global) = globals.entries_mut().get_mut(idx) {
            let new_init = wasm_instrument::parity_wasm::elements::InitExpr::new(vec![
                wasm_instrument::parity_wasm::elements::Instruction::I64Const(initial),
                wasm_instrument::parity_wasm::elements::Instruction::End,
            ]);
            let new_global = wasm_instrument::parity_wasm::elements::GlobalEntry::new(
                global.global_type().clone(),
                new_init,
            );
            *global = new_global;
        }
    }
}

