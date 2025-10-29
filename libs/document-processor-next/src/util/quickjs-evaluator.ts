import {
  getQuickJS,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from 'quickjs-emscripten';

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;

export interface QuickJSBindings {
  readonly [key: string]: unknown;
}

export interface QuickJSEvaluationOptions {
  readonly code: string;
  readonly bindings?: QuickJSBindings;
  readonly timeout?: number;
  readonly memoryLimit?: number;
}

export class QuickJSEvaluator {
  private modulePromise?: Promise<QuickJSWASMModule>;
  private moduleInstance?: QuickJSWASMModule;

  async evaluate({
    code,
    bindings,
    timeout = DEFAULT_TIMEOUT_MS,
    memoryLimit = DEFAULT_MEMORY_LIMIT_BYTES,
  }: QuickJSEvaluationOptions): Promise<unknown> {
    const quickJS = await this.ensureModule();
    const runtime = quickJS.newRuntime();
    runtime.setMemoryLimit(memoryLimit);

    const absoluteTimeout = Number.isFinite(timeout)
      ? Date.now() + Math.max(timeout, 0)
      : undefined;
    if (absoluteTimeout !== undefined) {
      runtime.setInterruptHandler(() => Date.now() > absoluteTimeout);
    }

    const context = runtime.newContext();
    try {
      this.installConsole(context);
      this.installBindings(context, bindings);

      const wrappedCode = this.wrapCode(code);
      const evaluationResult = context.evalCode(wrappedCode);
      const initialHandle = context.unwrapResult(evaluationResult);

      let resolvedHandle: QuickJSHandle | null = null;
      try {
        resolvedHandle = await this.resolveHandle(
          context,
          runtime,
          initialHandle,
          absoluteTimeout,
        );
        const hostValue = context.dump(resolvedHandle);
        return hostValue;
      } finally {
        if (resolvedHandle) {
          resolvedHandle.dispose();
        } else {
          initialHandle.dispose();
        }
      }
    } finally {
      context.dispose();
      runtime.removeInterruptHandler?.();
      runtime.dispose();
    }
  }

  private async ensureModule(): Promise<QuickJSWASMModule> {
    if (this.moduleInstance) {
      return this.moduleInstance;
    }
    if (!this.modulePromise) {
      this.modulePromise = getQuickJS().then((module) => {
        this.moduleInstance = module;
        return module;
      });
    }
    return this.modulePromise;
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

  private installBindings(
    context: QuickJSContext,
    bindings: QuickJSBindings | undefined,
  ): void {
    if (!bindings) {
      return;
    }

    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === 'function') {
        const fnHandle = context.newFunction(
          key,
          (...args: readonly QuickJSHandle[]) => {
            try {
              const hostArgs = args.map((arg) => context.dump(arg));
              const result = value(...hostArgs);
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
}
