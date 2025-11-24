import {
  getQuickJS,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from 'quickjs-emscripten';
import {
  getCanonicalPointerValue,
  unwrapCanonicalValue,
} from './canonical-json-utils.js';

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
type GasGlobal = { value: unknown };
type GasAugmentedModule = QuickJSWASMModule & {
  __setGasBudget?: (gas: bigint | number) => void;
  __gasGlobal?: GasGlobal;
  __gasExports?: Record<string, unknown>;
  getFFI?: () => unknown;
  module?: Record<string, unknown>;
  asm?: Record<string, unknown>;
};

export interface QuickJSBindings {
  readonly [key: string]: unknown;
}

export interface QuickJSEvaluationOptions {
  readonly code: string;
  readonly bindings?: QuickJSBindings;
  readonly timeout?: number;
  readonly memoryLimit?: number;
  readonly instrumentedWasmUrl?: string;
  readonly wasmGasLimit?: bigint | number;
  readonly onWasmGasUsed?: (usage: { used: bigint; remaining: bigint }) => void;
}

export class QuickJSEvaluator {
  private modulePromises = new Map<string, Promise<QuickJSWASMModule>>();
  private moduleInstances = new Map<string, QuickJSWASMModule>();

  async evaluate({
    code,
    bindings,
    timeout = DEFAULT_TIMEOUT_MS,
    memoryLimit = DEFAULT_MEMORY_LIMIT_BYTES,
    instrumentedWasmUrl,
    wasmGasLimit,
    onWasmGasUsed,
  }: QuickJSEvaluationOptions): Promise<unknown> {
    try {
      const wantsMetered =
        instrumentedWasmUrl !== undefined || wasmGasLimit !== undefined;
      const quickJS = await this.ensureModule(
        wantsMetered ? instrumentedWasmUrl : undefined,
        wantsMetered ? 'metered-default' : undefined,
      );
      const runtime = quickJS.newRuntime();
      runtime.setMemoryLimit(memoryLimit);
      let safeDispose = true;

      const absoluteTimeout = Number.isFinite(timeout)
        ? Date.now() + Math.max(timeout, 0)
        : undefined;
      if (absoluteTimeout !== undefined) {
        runtime.setInterruptHandler(() => Date.now() > absoluteTimeout);
      }

      const context = runtime.newContext();
      try {
        if (wantsMetered && wasmGasLimit !== undefined) {
          this.setGasLimit(quickJS, wasmGasLimit);
        }

        this.installConsole(context);
        this.installDeterministicGlobals(context);
        this.installCanonNamespace(context);
        this.installBindings(context, bindings);

        const wrappedCode = this.wrapCode(code);
        const evaluationResult = context.evalCode(wrappedCode);
        const initialHandle = context.unwrapResult(evaluationResult);

        let resolvedHandle: QuickJSHandle | null = null;
        let gasRemaining: bigint | undefined;

        try {
          resolvedHandle = await this.resolveHandle(
            context,
            runtime,
            initialHandle,
            absoluteTimeout,
          );
          if (wantsMetered && wasmGasLimit !== undefined) {
            const gasGlobal = this.findGasGlobal(quickJS);
            if (
              gasGlobal &&
              typeof (gasGlobal as { value?: unknown }).value !== 'undefined'
            ) {
              gasRemaining = BigInt(
                (gasGlobal as { value: unknown }).value as bigint,
              );
            }
          }
          const hostValue = context.dump(resolvedHandle);
          if (gasRemaining !== undefined && onWasmGasUsed) {
            const limit = BigInt(wasmGasLimit ?? 0);
            const used = limit > gasRemaining ? limit - gasRemaining : 0n;
            onWasmGasUsed({ used, remaining: gasRemaining });
          }
          return hostValue;
        } catch (error) {
          const normalized = this.normalizeWasmError(error);
          if (normalized.outOfGas) {
            safeDispose = false;
            throw normalized.error;
          }
          throw normalized.error;
        } finally {
          if (resolvedHandle) {
            resolvedHandle.dispose();
          } else {
            initialHandle.dispose();
          }
        }
      } finally {
        if (safeDispose) {
          try {
            context.dispose();
          } catch {
            // ignore disposal issues when runtime already aborted
          }
          try {
            runtime.removeInterruptHandler?.();
            runtime.dispose();
          } catch {
            // ignore disposal issues when runtime already aborted
          }
        }
      }
    } catch (error) {
      const normalized = this.normalizeWasmError(error);
      throw normalized.error;
    }
  }

  private async ensureModule(
    instrumentedWasmUrl?: string,
    keyHint?: string,
  ): Promise<QuickJSWASMModule> {
    const key = keyHint ?? instrumentedWasmUrl ?? 'default';
    const existing = this.moduleInstances.get(key);
    if (existing) {
      return existing;
    }

    let promise = this.modulePromises.get(key);
    if (!promise) {
      const shouldLoadInstrumented =
        instrumentedWasmUrl !== undefined || key === 'metered-default';
      promise = shouldLoadInstrumented
        ? this.loadInstrumentedModule(instrumentedWasmUrl)
        : getQuickJS();
      this.modulePromises.set(
        key,
        promise.then((module) => {
          this.moduleInstances.set(key, module);
          return module;
        }),
      );
    }

    return promise;
  }

  private async loadInstrumentedModule(
    wasmUrl?: string,
  ): Promise<QuickJSWASMModule> {
    const { loadMeteredQuickJS } = await import('./quickjs-gas-loader.js');
    return loadMeteredQuickJS(wasmUrl);
  }

  private setGasLimit(quickJS: QuickJSWASMModule, gasLimit: bigint | number) {
    const modAny = quickJS as GasAugmentedModule;
    if (typeof modAny.__setGasBudget === 'function') {
      modAny.__setGasBudget(gasLimit);
      return;
    }

    const gasGlobal = this.findGasGlobal(quickJS);
    if (gasGlobal) {
      gasGlobal.value = BigInt(gasLimit);
      return;
    }

    throw new Error(
      'Metered QuickJS: gas budget setter not found; ensure instrumented wasm is loaded',
    );
  }

  private findGasGlobal(quickJS: QuickJSWASMModule): GasGlobal | undefined {
    const quickJSCasted = quickJS as GasAugmentedModule;
    const directCandidates: Array<unknown> = [
      quickJSCasted.__gasGlobal,
      quickJSCasted.__gasExports?.gas_left,
      quickJSCasted.module?.gas_left,
      quickJSCasted.asm?.gas_left,
    ];

    const ffiModule =
      typeof quickJSCasted.getFFI === 'function'
        ? quickJSCasted.getFFI()
        : undefined;

    if (ffiModule && typeof ffiModule === 'object') {
      const moduleRef = (ffiModule as { module?: Record<string, unknown> })
        .module;
      if (moduleRef) {
        const moduleRefAny = moduleRef as Record<string, unknown> & {
          asm?: Record<string, unknown>;
          wasmExports?: Record<string, unknown>;
          instance?: { exports?: Record<string, unknown> };
          exports?: Record<string, unknown>;
          __gasGlobal?: unknown;
          __gasExports?: Record<string, unknown>;
        };
        directCandidates.push(
          moduleRefAny.__gasGlobal,
          moduleRefAny.__gasExports?.gas_left,
          moduleRefAny.asm?.gas_left,
          moduleRefAny.wasmExports?.gas_left,
          moduleRefAny.instance?.exports?.gas_left,
          moduleRefAny.exports?.gas_left,
          moduleRefAny.gas_left,
        );
      }
    }

    for (const candidate of directCandidates) {
      if (this.isGasGlobal(candidate)) {
        return candidate;
      }
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

  private wrapCode(code: string): string {
    return `(async () => {\n${code}\n})()`;
  }

  private installConsole(context: QuickJSContext): void {
    context.newObject().consume((consoleHandle) => {
      const methods: Array<keyof Console> = ['log', 'info', 'warn', 'error'];
      for (const method of methods) {
        const hostMethod =
          (console[method] as (...args: unknown[]) => void) ?? console.log;
        context
          .newFunction(method, (...args: QuickJSHandle[]) => {
            const nativeArgs = args.map((arg) => context.dump(arg));
            hostMethod.apply(console, nativeArgs);
            return context.undefined;
          })
          .consume((handle) => context.setProp(consoleHandle, method, handle));
      }
      context.setProp(context.global, 'console', consoleHandle);
    });
  }

  private installDeterministicGlobals(context: QuickJSContext): void {
    // Hide non-deterministic and host-specific globals from user code
    // Ensure typeof returns 'undefined' for these symbols
    context.setProp(context.global, 'Date', context.undefined.dup());
  }

  private installCanonNamespace(context: QuickJSContext): void {
    context.newObject().consume((canonHandle) => {
      context
        .newFunction('unwrap', (...args: readonly QuickJSHandle[]) => {
          try {
            const [targetHandle, deepHandle] = args;
            const target =
              targetHandle !== undefined
                ? context.dump(targetHandle)
                : undefined;
            const deep =
              deepHandle === undefined
                ? true
                : Boolean(context.dump(deepHandle));
            const value = unwrapCanonicalValue(target, deep);
            return this.createReturnHandle(context, value);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return context.newError(message);
          }
        })
        .consume((handle) => context.setProp(canonHandle, 'unwrap', handle));

      context
        .newFunction('at', (...args: readonly QuickJSHandle[]) => {
          try {
            const [targetHandle, pointerHandle] = args;
            const target =
              targetHandle !== undefined
                ? context.dump(targetHandle)
                : undefined;
            if (pointerHandle === undefined) {
              throw new TypeError(
                'canon.at(target, pointer) requires a pointer argument',
              );
            }
            const pointerValue = context.dump(pointerHandle);
            if (typeof pointerValue !== 'string') {
              throw new TypeError('canon.at pointer must be a string');
            }
            const resolved = getCanonicalPointerValue(target, pointerValue);
            return this.createReturnHandle(context, resolved);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            return context.newError(message);
          }
        })
        .consume((handle) => context.setProp(canonHandle, 'at', handle));

      context.setProp(context.global, 'canon', canonHandle);
    });
  }

  private installBindings(
    context: QuickJSContext,
    bindings: QuickJSBindings | undefined,
  ): void {
    if (!bindings) {
      return;
    }

    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === 'function') {
        const fnHandle = this.createFunctionHandle(
          context,
          key,
          value as (...args: unknown[]) => unknown,
        );
        fnHandle.consume((handle) =>
          context.setProp(context.global, key, handle),
        );
      } else if (value !== undefined) {
        const valueHandle = this.createOwnedHandle(context, value);
        valueHandle.consume((handle) =>
          context.setProp(context.global, key, handle),
        );
      }
    }
  }

  private createFunctionHandle(
    context: QuickJSContext,
    name: string,
    fn: (...args: unknown[]) => unknown,
  ): QuickJSHandle {
    const fnHandle = context.newFunction(
      name,
      (...args: readonly QuickJSHandle[]) => {
        try {
          const hostArgs = args.map((arg) => context.dump(arg));
          const result = fn(...hostArgs);
          if (result instanceof Promise) {
            throw new TypeError('Async bindings are not supported');
          }
          return this.createReturnHandle(context, result);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return context.newError(message);
        }
      },
    );
    this.applyFunctionProperties(context, fnHandle, fn);
    return fnHandle;
  }

  /**
   * Copies enumerable properties from a host function onto the QuickJS handle.
   * Nested functions (e.g. `document.canonical = () => {}`) are recursively wrapped
   * so they stay callable inside QuickJS; plain values are serialized via
   * `createOwnedHandle`. This preserves helper namespaces on binding functions.
   */
  private applyFunctionProperties(
    context: QuickJSContext,
    targetHandle: QuickJSHandle,
    source: unknown,
  ): void {
    if (
      source === null ||
      (typeof source !== 'object' && typeof source !== 'function')
    ) {
      return;
    }
    for (const [prop, propValue] of Object.entries(
      source as Record<string, unknown>,
    )) {
      if (propValue === undefined) {
        continue;
      }
      if (typeof propValue === 'function') {
        const propertyHandle = this.createFunctionHandle(
          context,
          prop,
          propValue as (...args: unknown[]) => unknown,
        );
        propertyHandle.consume((handle) =>
          context.setProp(targetHandle, prop, handle),
        );
        continue;
      }
      const propertyHandle = this.createOwnedHandle(context, propValue);
      propertyHandle.consume((handle) =>
        context.setProp(targetHandle, prop, handle),
      );
    }
  }

  private createOwnedHandle(
    context: QuickJSContext,
    value: unknown,
  ): QuickJSHandle {
    if (value === undefined) {
      return context.undefined.dup();
    }
    if (value === null) {
      return context.null.dup();
    }
    if (typeof value === 'boolean') {
      return (value ? context.true : context.false).dup();
    }
    if (typeof value === 'number') {
      return context.newNumber(value);
    }
    if (typeof value === 'string') {
      return context.newString(value);
    }
    if (typeof value === 'bigint') {
      return context.newBigInt(value);
    }
    if (Array.isArray(value) || typeof value === 'object') {
      const json = JSON.stringify(value);
      if (json === undefined) {
        return context.undefined.dup();
      }
      const evaluationResult = context.evalCode(`(${json})`);
      return context.unwrapResult(evaluationResult);
    }
    throw new TypeError(
      `Unsupported binding value type: ${typeof value as string}`,
    );
  }

  private createReturnHandle(
    context: QuickJSContext,
    value: unknown,
  ): QuickJSHandle {
    if (value === undefined) {
      return context.undefined;
    }
    if (value === null) {
      return context.null;
    }
    if (typeof value === 'boolean') {
      return value ? context.true : context.false;
    }
    if (typeof value === 'number') {
      return context.newNumber(value);
    }
    if (typeof value === 'string') {
      return context.newString(value);
    }
    if (typeof value === 'bigint') {
      return context.newBigInt(value);
    }
    if (Array.isArray(value) || typeof value === 'object') {
      const json = JSON.stringify(value);
      if (json === undefined) {
        return context.undefined;
      }
      const evaluationResult = context.evalCode(`(${json})`);
      return context.unwrapResult(evaluationResult);
    }
    throw new TypeError(
      `Unsupported binding return type: ${typeof value as string}`,
    );
  }

  private async resolveHandle(
    context: QuickJSContext,
    runtime: QuickJSRuntime,
    initialHandle: QuickJSHandle,
    deadline: number | undefined,
  ): Promise<QuickJSHandle> {
    let current = initialHandle;

    while (true) {
      const state = context.getPromiseState(current);

      if (state.type === 'pending') {
        if (deadline !== undefined && Date.now() > deadline) {
          current.dispose();
          throw new Error('QuickJS execution timed out while awaiting Promise');
        }

        const jobsResult = runtime.executePendingJobs();
        let executed = 0;
        try {
          executed = context.unwrapResult(jobsResult);
        } finally {
          jobsResult.dispose();
        }

        if (executed === 0) {
          if (deadline !== undefined && Date.now() > deadline) {
            current.dispose();
            throw new Error(
              'QuickJS execution timed out while awaiting Promise',
            );
          }
          // Yield to the event loop; prevents tight spin when promises never settle.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        continue;
      }

      if (state.type === 'fulfilled') {
        if (state.notAPromise) {
          return current;
        }
        current.dispose();
        current = state.value;
        continue;
      }

      if (state.type === 'rejected') {
        try {
          const errorValue = context.dump(state.error);
          if (errorValue instanceof Error) {
            throw errorValue;
          }
          if (
            errorValue &&
            typeof errorValue === 'object' &&
            'message' in errorValue
          ) {
            throw new Error(
              String((errorValue as { message: unknown }).message),
            );
          }
          throw new Error(
            typeof errorValue === 'string'
              ? errorValue
              : JSON.stringify(errorValue),
          );
        } finally {
          state.error.dispose();
          current.dispose();
        }
      }
    }
  }

  private normalizeWasmError(error: unknown): {
    error: Error;
    outOfGas: boolean;
  } {
    const err =
      error instanceof Error
        ? error
        : new Error(String(error ?? 'Unknown error'));
    const message = err.message ?? '';
    if (
      /out of gas/i.test(message) ||
      /unreachable/i.test(message) ||
      /Aborted\(Assertion failed/i.test(message)
    ) {
      return {
        error: new Error('OutOfGas: QuickJS Wasm execution exceeded fuel'),
        outOfGas: true,
      };
    }
    return { error: err, outOfGas: false };
  }
}
