use std::{env, fs, num::NonZeroU32};

use wasm_instrument::gas_metering::{host_function, inject, MemoryGrowCost, Rules};
use wasm_instrument::parity_wasm::elements::{Instruction, Module};
use wasm_instrument::parity_wasm::{deserialize_buffer, serialize};

struct EthLike;

impl Rules for EthLike {
    fn instruction_cost(&self, instruction: &Instruction) -> Option<u32> {
        use Instruction::*;
        Some(match instruction {
            I32Add | I32Sub | I32Mul | I64Add | I64Sub | I64Mul => 1,
            If(_) | Br(_) | BrIf(_) | BrTable(_) | Loop(_) | Return => 2,
            I32Load(..) | I32Store(..) | I64Load(..) | I64Store(..) => 3,
            Call(_) | CallIndirect(..) => 10,
            _ => 1,
        })
    }

    fn memory_grow_cost(&self) -> MemoryGrowCost {
        MemoryGrowCost::Linear(NonZeroU32::new(300).unwrap())
    }

    fn call_per_local_cost(&self) -> u32 {
        0
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: quickjs-gas-instrument <in.wasm> <out.wasm>");
        std::process::exit(2);
    }

    let input = fs::read(&args[1]).expect("read input wasm");
    let module: Module = deserialize_buffer(&input).expect("deserialize input wasm");
    // Host-function backend: call imported env.gas_charge(amount).
    // The host is responsible for tracking remaining gas and throwing when depleted.
    let backend = host_function::Injector::new("env", "gas_charge");
    let mut instrumented = inject(module, backend, &EthLike).expect("inject metering");
    // Optional: make initial gas counter large for safety if host fails to set.
    // Not used by host_function backend but kept for parity with mutable global workflows.
    bump_gas_global_init(&mut instrumented, 9_000_000_000_000i64);
    let output_bytes = serialize(instrumented).expect("serialize instrumented module");
    fs::write(&args[2], output_bytes).expect("write output wasm");
}

fn bump_gas_global_init(module: &mut Module, initial: i64) {
    // Locate the global index exported as "gas_left"
    let Some(exports) = module.export_section() else {
        return;
    };
    let gas_global_index = exports
        .entries()
        .iter()
        .find_map(|e| match e.internal() {
            wasm_instrument::parity_wasm::elements::Internal::Global(index)
                if e.field() == "gas_left" =>
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
            let new_init =
                wasm_instrument::parity_wasm::elements::InitExpr::new(vec![
                    Instruction::I64Const(initial),
                    Instruction::End,
                ]);
            let new_global = wasm_instrument::parity_wasm::elements::GlobalEntry::new(
                global.global_type().clone(),
                new_init,
            );
            *global = new_global;
        }
    }
}
