import type { QuickJSWASMModule } from 'quickjs-emscripten';

const OUT_OF_GAS_MESSAGE = 'OutOfGas: QuickJS Wasm execution exceeded fuel';

type GasGlobal = { value: unknown };
type GasAugmentedModule = QuickJSWASMModule & {
  __setGasBudget?: (gas: bigint | number) => void;
  __gasGlobal?: GasGlobal;
  __gasExports?: Record<string, unknown>;
  getFFI?: () => unknown;
  module?: Record<string, unknown>;
  asm?: Record<string, unknown>;
};

export class QuickJSGasController {
  constructor(
    private readonly quickJS: QuickJSWASMModule | undefined,
    private readonly wantsMetered: boolean,
  ) {}

  setGasLimit(gasLimit: bigint | number): void {
    if (!this.quickJS) {
      throw new Error(
        'Metered QuickJS: gas budget setter not found; ensure instrumented wasm is loaded',
      );
    }
    const modAny = this.quickJS as GasAugmentedModule;
    if (typeof modAny.__setGasBudget === 'function') {
      modAny.__setGasBudget(gasLimit);
      return;
    }

    const gasGlobal = this.findGasGlobal();
    if (gasGlobal) {
      gasGlobal.value = BigInt(gasLimit);
      return;
    }

    throw new Error(
      'Metered QuickJS: gas budget setter not found; ensure instrumented wasm is loaded',
    );
  }

  readGasRemaining(): bigint | undefined {
    const gasGlobal = this.findGasGlobal();
    if (!gasGlobal) {
      return undefined;
    }
    const rawValue = (gasGlobal as { value?: unknown }).value;
    if (rawValue === undefined || rawValue === null) {
      return undefined;
    }
    if (typeof rawValue === 'bigint') {
      return rawValue;
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return BigInt(Math.trunc(rawValue));
    }
    if (typeof rawValue === 'string') {
      try {
        return BigInt(rawValue);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  normalizeError(error: unknown): { error: Error; outOfGas: boolean } {
    const err =
      error instanceof Error
        ? error
        : new Error(String(error ?? 'Unknown error'));
    if (this.wantsMetered && this.quickJS) {
      const gasRemaining = this.readGasRemaining();
      if (gasRemaining !== undefined && gasRemaining <= 0n) {
        return { error: this.newOutOfGasError(), outOfGas: true };
      }
    }
    const message = err.message ?? '';

    // QuickJS surfaces fuel exhaustion through different RuntimeError strings depending
    // on how the wasm was built and which host (Node, browsers, workers) is running it:
    // - `/out of gas/`: custom or partner QuickJS builds literally call `abort('out of gas')`,
    //   so the propagated message already says "RuntimeError: Out of gas".
    // - `/unreachable/`: our mutable-global injector executes the `unreachable` opcode
    //   when the counter hits zero; QuickJS propagates this raw trap as
    //   "RuntimeError: unreachable".
    // - `/Aborted(Assertion failed/`: when the wasm runtime aborts during teardown,
    //   the Emscripten glue asserts (e.g., `list_empty(&rt->gc_obj_list)`) and prefixes
    //   the thrown message with "Aborted(Assertion failed: …)" before surfacing it to JS.
    if (
      /out of gas/i.test(message) ||
      /unreachable/i.test(message) ||
      /Aborted\(Assertion failed/i.test(message)
    ) {
      return {
        error: this.newOutOfGasError(),
        outOfGas: true,
      };
    }

    return { error: err, outOfGas: false };
  }

  private findGasGlobal(): GasGlobal | undefined {
    if (!this.quickJS) {
      return undefined;
    }
    const mod = this.quickJS as GasAugmentedModule;
    if (this.isGasGlobal(mod.__gasGlobal)) {
      return mod.__gasGlobal;
    }
    const gasLeft = mod.__gasExports?.gas_left;
    if (this.isGasGlobal(gasLeft)) {
      return gasLeft;
    }
    return undefined;
  }

  private isGasGlobal(candidate: unknown): candidate is GasGlobal {
    return (
      !!candidate &&
      typeof candidate === 'object' &&
      'value' in (candidate as Record<string, unknown>)
    );
  }

  private newOutOfGasError(): Error {
    const outOfGasError = new Error(OUT_OF_GAS_MESSAGE);
    outOfGasError.name = 'OutOfGasError';
    return outOfGasError;
  }
}
