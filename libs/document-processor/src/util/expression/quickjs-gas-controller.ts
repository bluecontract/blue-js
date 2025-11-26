import type { QuickJSWASMModule } from 'quickjs-emscripten';
import {
  setGasBudget as setGasBudgetHelper,
  getGasRemaining as getGasRemainingHelper,
} from '@blue-labs/quickjs-wasm-gas';

const OUT_OF_GAS_MESSAGE = 'OutOfGas: QuickJS Wasm execution exceeded fuel';

export class QuickJSGasController {
  constructor(
    private readonly quickJS: QuickJSWASMModule | undefined,
    private readonly wantsMetered: boolean,
  ) {}

  setGasLimit(gasLimit: bigint | number): void {
    if (!this.quickJS) {
      throw new Error('QuickJS module not loaded');
    }
    try {
      setGasBudgetHelper(this.quickJS, gasLimit);
    } catch {
      throw new Error(
        'Metered QuickJS: gas budget setter not found; ensure instrumented wasm is loaded',
      );
    }
  }

  readGasRemaining(): bigint | undefined {
    if (!this.quickJS) {
      return undefined;
    }
    return getGasRemainingHelper(this.quickJS);
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

  private newOutOfGasError(): Error {
    const outOfGasError = new Error(OUT_OF_GAS_MESSAGE);
    outOfGasError.name = 'OutOfGasError';
    return outOfGasError;
  }
}
