import {
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from 'quickjs-emscripten';
import {
  getCanonicalPointerValue,
  unwrapCanonicalValue,
} from './canonical-json-utils.js';
import { QuickJSGasController } from './quickjs-gas-controller.js';
import { loadMeteredQuickJS } from './quickjs-gas-loader.js';

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;

let cachedModulePromise: Promise<QuickJSWASMModule> | undefined;
let cachedModule: QuickJSWASMModule | undefined;

function getMeteredQuickJS(): Promise<QuickJSWASMModule> {
  if (cachedModule) {
    return Promise.resolve(cachedModule);
  }
  if (!cachedModulePromise) {
    cachedModulePromise = loadMeteredQuickJS().then((module) => {
      cachedModule = module;
      return module;
    });
  }
  return cachedModulePromise;
}

export interface QuickJSBindings {
  readonly [key: string]: unknown;
}

export interface QuickJSEvaluatorOptions {
  /**
   * When false, bypass the shared module cache and instantiate a fresh QuickJS
   * wasm module for each evaluator call. Useful for deterministic fuel sampling
   * where prior allocations could skew measurements.
   */
  readonly useModuleCache?: boolean;
}

export interface QuickJSEvaluationOptions {
  readonly code: string;
  readonly bindings?: QuickJSBindings;
  readonly timeout?: number;
  readonly memoryLimit?: number;
  readonly wasmGasLimit?: bigint | number;
  readonly onWasmGasUsed?: (usage: { used: bigint; remaining: bigint }) => void;
}

export interface QuickJSPinnedRunner {
  run: (options?: {
    readonly wasmGasLimit?: bigint | number;
    readonly onWasmGasUsed?: QuickJSEvaluationOptions['onWasmGasUsed'];
  }) => Promise<unknown>;
  dispose: () => void;
}

export interface QuickJSPinnedRunnerOptions extends QuickJSEvaluationOptions {
  /**
   * When true (default), run deterministic GC before and after each invocation.
   * Set to false for extremely tight determinism when running repeated samples;
   * call `runDeterministicGC` manually at your own cadence if needed.
   */
  readonly runDeterministicGCBetweenRuns?: boolean;
  /**
   * When false, wraps the provided code in a synchronous function instead of an async IIFE.
   * This avoids the promise microtask machinery and can be useful for ultra-tight fuel sampling.
   */
  readonly wrapAsAsync?: boolean;
}

export class QuickJSEvaluator {
  constructor(
    private readonly evaluatorOptions: QuickJSEvaluatorOptions = {},
  ) {}

  async evaluate({
    code,
    bindings,
    timeout = DEFAULT_TIMEOUT_MS,
    memoryLimit = DEFAULT_MEMORY_LIMIT_BYTES,
    wasmGasLimit,
    onWasmGasUsed,
  }: QuickJSEvaluationOptions): Promise<unknown> {
    let lastQuickJS: QuickJSWASMModule | undefined;
    try {
      const quickJS = await this.ensureModule();
      lastQuickJS = quickJS;
      const gasController = new QuickJSGasController(quickJS, true);
      const runtime = quickJS.newRuntime();
      runtime.setMemoryLimit(memoryLimit);

      let deterministicGCReady = false;
      const ensureDeterministicGC = (): void => {
        if (deterministicGCReady) {
          return;
        }
        gasController.configureDeterministicGC(runtime);
        deterministicGCReady = true;
      };
      const runDeterministicGC = (propagateError: boolean): void => {
        if (!deterministicGCReady) {
          if (propagateError) {
            ensureDeterministicGC();
          } else {
            return;
          }
        }
        if (propagateError) {
          gasController.runDeterministicGC(runtime);
        } else if (deterministicGCReady) {
          try {
            gasController.runDeterministicGC(runtime);
          } catch {
            // ignore cleanup errors while tearing down the runtime
          }
        }
      };

      runDeterministicGC(true);

      const absoluteTimeout = Number.isFinite(timeout)
        ? Date.now() + Math.max(timeout, 0)
        : undefined;
      if (absoluteTimeout !== undefined) {
        runtime.setInterruptHandler(() => Date.now() > absoluteTimeout);
      }

      const context = runtime.newContext();
      try {
        runDeterministicGC(true);
        this.installConsole(context);
        this.installDeterministicGlobals(context);
        this.installCanonNamespace(context);
        this.installBindings(context, bindings);

        const wrappedCode = this.wrapCode(code);

        if (wasmGasLimit !== undefined) {
          gasController.setGasLimit(wasmGasLimit);
        }

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
          if (wasmGasLimit !== undefined) {
            gasRemaining = gasController.readGasRemaining();
          }
          const hostValue = context.dump(resolvedHandle);
          if (gasRemaining !== undefined && onWasmGasUsed) {
            const limit = BigInt(wasmGasLimit ?? 0);
            const used = limit > gasRemaining ? limit - gasRemaining : 0n;
            onWasmGasUsed({ used, remaining: gasRemaining });
          }
          runDeterministicGC(true);
          return hostValue;
        } catch (error) {
          const normalized = gasController.normalizeError(error);
          if (normalized.outOfGas) {
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
        runDeterministicGC(false);
        try {
          context.dispose();
        } catch {
          // ignore disposal issues when runtime already aborted
        }
        try {
          runtime.removeInterruptHandler?.();
        } catch {
          // ignore disposal issues when runtime already aborted
        }
        runDeterministicGC(false);
        try {
          runtime.dispose();
        } catch {
          // ignore disposal issues when runtime already aborted
        }
      }
    } catch (error) {
      const normalized = new QuickJSGasController(
        lastQuickJS,
        true,
      ).normalizeError(error);
      throw normalized.error;
    }
  }

  private ensureModule(): Promise<QuickJSWASMModule> {
    if (this.evaluatorOptions.useModuleCache === false) {
      return loadMeteredQuickJS();
    }
    return getMeteredQuickJS();
  }

  private wrapCode(code: string): string {
    return `(async () => {\n${code}\n})()`;
  }

  private wrapCodeAsFunction(code: string): string {
    return `(function __quickjs_eval(){ return (async () => {\n${code}\n})(); })`;
  }

  private wrapCodeAsFunctionSync(code: string): string {
    return `(function __quickjs_eval(){ return (function(){\n${code}\n})(); })`;
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
        try {
          context.unwrapResult(jobsResult);
        } finally {
          jobsResult.dispose();
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
          const err = context.dump(state.error);
          if (err instanceof Error) throw err;
          if (err && typeof err === 'object' && 'message' in err) {
            throw new Error(String((err as { message: unknown }).message));
          }
          throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
        } finally {
          state.error.dispose();
          current.dispose();
        }
      }
    }
  }

  async createPinnedRunner({
    code,
    bindings,
    timeout = DEFAULT_TIMEOUT_MS,
    memoryLimit = DEFAULT_MEMORY_LIMIT_BYTES,
    wasmGasLimit,
    onWasmGasUsed,
    runDeterministicGCBetweenRuns = true,
    wrapAsAsync = true,
  }: QuickJSPinnedRunnerOptions): Promise<QuickJSPinnedRunner> {
    const quickJS = await this.ensureModule();
    const gasController = new QuickJSGasController(quickJS, true);
    const runtime = quickJS.newRuntime();
    runtime.setMemoryLimit(memoryLimit);
    gasController.configureDeterministicGC(runtime);
    gasController.runDeterministicGC(runtime);

    const absoluteTimeout = Number.isFinite(timeout)
      ? Date.now() + Math.max(timeout, 0)
      : undefined;
    if (absoluteTimeout !== undefined) {
      runtime.setInterruptHandler(() => Date.now() > absoluteTimeout);
    }

    const context = runtime.newContext();
    this.installConsole(context);
    this.installDeterministicGlobals(context);
    this.installCanonNamespace(context);
    this.installBindings(context, bindings);

    const compiledResult = context.evalCode(
      wrapAsAsync
        ? this.wrapCodeAsFunction(code)
        : this.wrapCodeAsFunctionSync(code),
    );
    const fnHandle = context.unwrapResult(compiledResult);

    let disposed = false;

    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        gasController.runDeterministicGC(runtime);
      } catch {
        // ignore cleanup failures
      }
      try {
        fnHandle.dispose();
      } catch {
        // ignore cleanup failures
      }
      try {
        context.dispose();
      } catch {
        // ignore cleanup failures
      }
      try {
        runtime.removeInterruptHandler?.();
      } catch {
        // ignore cleanup failures
      }
      try {
        runtime.dispose();
      } catch {
        // ignore cleanup failures
      }
    };

    const run: QuickJSPinnedRunner['run'] = async (options) => {
      const effectiveGasLimit =
        options?.wasmGasLimit !== undefined
          ? options.wasmGasLimit
          : wasmGasLimit;
      const gasCallback =
        options?.onWasmGasUsed !== undefined
          ? options.onWasmGasUsed
          : onWasmGasUsed;

      let resolvedHandle: QuickJSHandle | null = null;
      let initialHandle: QuickJSHandle | null = null;
      try {
        if (runDeterministicGCBetweenRuns) {
          gasController.runDeterministicGC(runtime);
        }
        if (effectiveGasLimit !== undefined) {
          gasController.setGasLimit(effectiveGasLimit);
        }
        const invocationResult = context.callFunction(
          fnHandle,
          context.undefined,
        );
        initialHandle = context.unwrapResult(invocationResult);
        resolvedHandle = await this.resolveHandle(
          context,
          runtime,
          initialHandle,
          absoluteTimeout,
        );

        let gasRemaining: bigint | undefined;
        if (effectiveGasLimit !== undefined) {
          gasRemaining = gasController.readGasRemaining();
        }

        const hostValue = context.dump(resolvedHandle);
        if (gasRemaining !== undefined && gasCallback) {
          const limit = BigInt(effectiveGasLimit ?? 0);
          const used = gasRemaining < limit ? limit - gasRemaining : 0n;
          gasCallback({ used, remaining: gasRemaining });
        }
        if (runDeterministicGCBetweenRuns) {
          gasController.runDeterministicGC(runtime);
        }
        return hostValue;
      } catch (error) {
        const normalized = gasController.normalizeError(error);
        throw normalized.error;
      } finally {
        if (resolvedHandle) {
          resolvedHandle.dispose();
        } else if (initialHandle) {
          initialHandle.dispose();
        }
      }
    };

    return { run, dispose };
  }
}
