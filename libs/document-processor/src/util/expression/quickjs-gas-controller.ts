import type { QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten';
import {
  setGasBudget as setGasBudgetHelper,
  getGasRemaining as getGasRemainingHelper,
  disableRuntimeAutomaticGC,
  collectRuntimeGarbage,
} from '@blue-labs/quickjs-wasmfile-release-sync-gas';

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

  configureDeterministicGC(runtime: QuickJSRuntime): void {
    const module = this.getQuickJSOrThrow();
    try {
      disableRuntimeAutomaticGC(module, runtime);
    } catch (error) {
      throw this.newGCControlError(error);
    }
  }

  runDeterministicGC(runtime: QuickJSRuntime): void {
    const module = this.getQuickJSOrThrow();
    try {
      collectRuntimeGarbage(module, runtime);
    } catch (error) {
      throw this.newGCControlError(error);
    }
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

  private getQuickJSOrThrow(): QuickJSWASMModule {
    if (!this.quickJS) {
      throw new Error('QuickJS module not loaded');
    }
    return this.quickJS;
  }

  private newGCControlError(error: unknown): Error {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return new Error(
      `Metered QuickJS: GC control helpers unavailable (${message}). ` +
        'Rebuild the instrumented wasm bundle before running evaluations.',
    );
  }
}
