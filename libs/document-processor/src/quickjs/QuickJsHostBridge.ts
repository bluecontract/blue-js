import {
  newQuickJSAsyncWASMModule,
  QuickJSAsyncContext,
  QuickJSAsyncRuntime,
  QuickJSAsyncWASMModule,
  QuickJSHandle,
} from 'quickjs-emscripten';
import { ProcessingOptions } from '../types';

export interface HostDeterministicAPIs {
  loadBlueContent?(blueId: string): Promise<string>;
  loadExternalModule?(url: string): Promise<string>;
  log?(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
  now?(): number;
}

export interface ProcessorCallOptions {
  timeoutMs?: number;
}

export interface ProcessorErrorPayload {
  message: string;
  name?: string;
  stack?: string;
}

export interface InitializeCall {
  method: 'initialize';
  document: unknown;
  options?: ProcessingOptions;
}

export interface ProcessEventsCall {
  method: 'processEvents';
  document: unknown;
  events: unknown[];
  options?: ProcessingOptions;
}

export type ProcessorRequest = InitializeCall | ProcessEventsCall;

export interface ProcessorResponse {
  ok: boolean;
  result?: unknown;
  error?: ProcessorErrorPayload;
}

export interface QuickJsHostBridgeOptions {
  entrySource: string;
  hostApis?: HostDeterministicAPIs;
  globals?: Record<string, unknown>;
  memoryLimitBytes?: number;
  stackSizeBytes?: number;
  defaultTimeoutMs?: number;
}

/**
 * Thin wrapper around a QuickJS runtime that exposes the document processor
 * entry points through a deterministic JSON-based protocol. The actual
 * implementation will be filled in once the processor bundle is available.
 */
export class QuickJsHostBridge {
  private wasmModulePromise: Promise<QuickJSAsyncWASMModule> | null = null;
  private context: QuickJSAsyncContext | null = null;
  private runtime: QuickJSAsyncRuntime | null = null;
  private entryHandle: QuickJSHandle | null = null;

  constructor(private readonly options: QuickJsHostBridgeOptions) {}

  /**
   * Ensures the QuickJS context is bootstrapped and ready to accept calls.
   */
  async init(): Promise<void> {
    if (this.context) return;

    const module = await this.getWasmModule();
    this.runtime = await module.newRuntime();
    this.runtime.setMemoryLimit(
      this.options.memoryLimitBytes ?? 32 * 1024 * 1024
    );
    if (typeof this.runtime.setMaxStackSize === 'function') {
      this.runtime.setMaxStackSize(this.options.stackSizeBytes ?? 256 * 1024);
    }
    this.context = await this.runtime.newContext();

    this.injectHostApis(this.context);
    this.applyBootstrapGlobals(this.context, this.options.globals);
    this.installConsole(this.context);
    this.context.setProp(
      this.context.global,
      '__BLUE_REQUEST__',
      this.context.undefined
    );
    await this.evaluateEntrySource();
  }

  async dispose(): Promise<void> {
    this.entryHandle?.dispose();
    this.entryHandle = null;

    if (this.context) {
      this.context.dispose();
      this.context = null;
    }

    if (this.runtime) {
      this.runtime.dispose();
      this.runtime = null;
    }
  }

  async call(
    request: ProcessorRequest,
    _options: ProcessorCallOptions = {}
  ): Promise<ProcessorResponse> {
    await this.init();
    const context = this.ensureContext();
    const runtime = this.ensureRuntime();
    this.ensureEntryHandle();

    const requestPayload = this.buildRequestPayload(request);
    const requestHandle = this.toQuickJSValueWithContext(
      context,
      requestPayload
    );

    context.setProp(context.global, '__BLUE_REQUEST__', requestHandle.handle);
    if (requestHandle.dispose && requestHandle.handle.alive) {
      requestHandle.handle.dispose();
    }

    const timeoutMs = _options.timeoutMs ?? this.options.defaultTimeoutMs ?? 0;
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;
    let didTimeout = false;
    if (deadline) {
      runtime.setInterruptHandler(() => {
        if (Date.now() > deadline) {
          didTimeout = true;
          return true;
        }
        return false;
      });
    }

    try {
      const evaluation = await context.evalCodeAsync(
        this.buildInvocationSource(request.method)
      );
      let resultHandle = context.unwrapResult(evaluation);
      resultHandle = await this.settleQuickJSHandle(resultHandle);
      const dumped = context.dump(resultHandle);
      const resultValue = this.deepClone(dumped);
      if (resultHandle.alive) {
        resultHandle.dispose();
      }

      if (this.isErrorEnvelope(resultValue)) {
        return {
          ok: false,
          error: this.normalizeError(resultValue.__blueError),
        };
      }

      const extracted = this.extractResult(resultValue);
      if (this.isErrorEnvelope(extracted)) {
        return {
          ok: false,
          error: this.normalizeError(extracted.__blueError),
        };
      }

      return {
        ok: true,
        result: extracted,
      };
    } catch (error) {
      return {
        ok: false,
        error: this.refineResourceError(this.normalizeError(error), didTimeout),
      };
    } finally {
      if (deadline) {
        runtime.setInterruptHandler(undefined);
      }
      context.setProp(context.global, '__BLUE_REQUEST__', context.undefined);
    }
  }

  private async getWasmModule(): Promise<QuickJSAsyncWASMModule> {
    if (!this.wasmModulePromise) {
      this.wasmModulePromise = newQuickJSAsyncWASMModule();
    }
    return this.wasmModulePromise;
  }

  private async evaluateEntrySource(): Promise<void> {
    const context = this.ensureContext();
    const { entrySource } = this.options;
    if (!entrySource) {
      throw new Error('Processor entry source is required');
    }

    const hasEntryMarker = entrySource.includes('__BLUE_ENTRY__');

    if (!hasEntryMarker) {
      throw new Error(
        'Processor entry source missing __BLUE_ENTRY__ export marker.'
      );
    }

    // The actual evaluation will invoke the bundled processor factory and keep
    // a reference to its exported API. Placeholder for now.
    const evaluation = context.evalCode(entrySource);
    const handle = context.unwrapResult(evaluation);
    const resultType = context.typeof(handle);
    const resultDump = context.dump(handle);
    if (handle.alive) {
      handle.dispose();
    }

    const keysEval = context.evalCode('Object.keys(globalThis)');
    const keysHandle = context.unwrapResult(keysEval);
    const globalKeys = context.dump(keysHandle) as unknown[];
    if (keysHandle.alive) {
      keysHandle.dispose();
    }

    const exportedEval = context.evalCode(`globalThis.__BLUE_ENTRY__`);
    const exported = context.unwrapResult(exportedEval);
    if (!exported || !exported.alive) {
      throw new Error(
        `Processor bundle evaluation did not expose __BLUE_ENTRY__. Globals: ${JSON.stringify(
          globalKeys
        )} Eval result (${resultType}): ${JSON.stringify(resultDump)}`
      );
    }

    const type = context.typeof(exported);
    if (type !== 'object' && type !== 'function') {
      const message = `Processor bundle must expose an object with callable methods. Received type ${type}. Globals: ${JSON.stringify(
        globalKeys
      )} Eval result type ${resultType} value ${JSON.stringify(resultDump)}`;
      exported.dispose();
      throw new Error(message);
    }

    const entryAlias = exported.dup();
    context.setProp(context.global, '__BLUE_ENTRY__', entryAlias);
    if (entryAlias.alive) {
      entryAlias.dispose();
    }

    this.entryHandle = exported;
  }

  private ensureContext(): QuickJSAsyncContext {
    if (!this.context) {
      throw new Error('QuickJS context not initialised');
    }
    return this.context;
  }

  private ensureEntryHandle(): QuickJSHandle {
    if (!this.entryHandle || !this.entryHandle.alive) {
      throw new Error('Processor entry handle missing – was dispose() called?');
    }
    return this.entryHandle;
  }

  private ensureRuntime(): QuickJSAsyncRuntime {
    if (!this.runtime) {
      throw new Error('QuickJS runtime not initialised');
    }
    return this.runtime;
  }

  private buildRequestPayload(
    request: ProcessorRequest
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      method: request.method,
    };

    if (request.options) {
      base.options = request.options;
    }

    if (request.method === 'initialize') {
      return {
        ...base,
        document: request.document,
      };
    }

    if (request.method === 'processEvents') {
      return {
        ...base,
        document: request.document,
        events: request.events,
      };
    }

    return base;
  }

  private injectHostApis(context: QuickJSAsyncContext): void {
    const apis = this.options.hostApis;
    if (!apis) return;

    const hostObject = context.newObject();

    const setFunction = (
      name: keyof HostDeterministicAPIs,
      handle: QuickJSHandle
    ) => {
      context.setProp(hostObject, name, handle);
      if (handle.alive) {
        handle.dispose();
      }
    };

    setFunction('log', this.createLogFunction(context, apis.log));
    setFunction('now', this.createNowFunction(context, apis.now));
    setFunction(
      'loadBlueContent',
      this.createAsyncStringFunction(
        context,
        'loadBlueContent',
        apis.loadBlueContent
      )
    );
    setFunction(
      'loadExternalModule',
      this.createAsyncStringFunction(
        context,
        'loadExternalModule',
        apis.loadExternalModule
      )
    );

    context.setProp(context.global, '__BLUE_HOST__', hostObject);
    hostObject.dispose();
  }

  private toQuickJSValueWithContext(
    context: QuickJSAsyncContext,
    value: unknown
  ): { handle: QuickJSHandle; dispose: boolean } {
    if (value === undefined) {
      return { handle: context.undefined, dispose: false };
    }

    const json = JSON.stringify(value);
    if (json === undefined) {
      return { handle: context.undefined, dispose: false };
    }

    const expression = `JSON.parse(${JSON.stringify(json)})`;
    const evaluation = context.evalCode(expression);
    const handle = context.unwrapResult(evaluation);

    return { handle, dispose: true };
  }

  private applyBootstrapGlobals(
    context: QuickJSAsyncContext,
    globals?: Record<string, unknown>
  ): void {
    if (!globals) return;
    for (const [key, value] of Object.entries(globals)) {
      const { handle, dispose } = this.toQuickJSValueWithContext(
        context,
        value
      );
      context.setProp(context.global, key, handle);
      if (dispose && handle.alive) {
        handle.dispose();
      }
    }
  }

  private installConsole(context: QuickJSAsyncContext): void {
    const existing = context.getProp(context.global, 'console');
    if (existing && existing.alive) {
      if (context.typeof(existing) === 'object') {
        existing.dispose();
        return;
      }
      existing.dispose();
    }

    const consoleObject = context.newObject();
    const logLevels: Array<'log' | 'info' | 'warn' | 'error'> = [
      'log',
      'info',
      'warn',
      'error',
    ];

    const hostLog = this.options.hostApis?.log;

    const makeLogger = (level: (typeof logLevels)[number]) => {
      const fn = context.newFunction(`console_${level}`, (...args) => {
        const messageParts = args.map((handle) => {
          const dumped = context.dump(handle);
          if (typeof dumped === 'string') return dumped;
          try {
            return JSON.stringify(dumped);
          } catch (_) {
            return String(dumped);
          }
        });
        for (const handle of args) {
          if (handle.alive) {
            handle.dispose();
          }
        }
        const message = messageParts.join(' ');
        try {
          if (hostLog) {
            const hostLevel =
              level === 'warn' || level === 'error' || level === 'info'
                ? level
                : 'info';
            hostLog(hostLevel, message);
          }
        } catch (_) {
          // Swallow host logging failures to keep QuickJS sandbox robust.
        }
        return context.undefined;
      });
      context.setProp(consoleObject, level, fn);
      if (fn.alive) fn.dispose();
    };

    for (const level of logLevels) {
      makeLogger(level);
    }

    context.setProp(context.global, 'console', consoleObject);
    consoleObject.dispose();
  }

  private createLogFunction(
    context: QuickJSAsyncContext,
    log?: HostDeterministicAPIs['log']
  ): QuickJSHandle {
    if (!log) {
      return context.newAsyncifiedFunction('log', async () => ({
        error: this.toQuickJSErrorHandle(
          context,
          'Host log API not implemented'
        ),
      }));
    }

    return context.newAsyncifiedFunction('log', async (...args) => {
      const [levelHandle, messageHandle] = args;
      const level = (
        levelHandle ? context.dump(levelHandle) : 'info'
      ) as string;
      const messageValue = messageHandle
        ? context.dump(messageHandle)
        : undefined;
      const message =
        typeof messageValue === 'string'
          ? messageValue
          : JSON.stringify(messageValue);

      try {
        log(
          level === 'debug' || level === 'warn' || level === 'error'
            ? level
            : 'info',
          message ?? ''
        );
        return context.undefined;
      } catch (error) {
        return {
          error: this.toQuickJSErrorHandle(context, error),
        };
      }
    });
  }

  private createNowFunction(
    context: QuickJSAsyncContext,
    now?: HostDeterministicAPIs['now']
  ): QuickJSHandle {
    if (!now) {
      return context.newFunction('now', () => {
        throw new Error('Host now() API not implemented');
      });
    }

    return context.newFunction('now', () => {
      const value = Number(now());
      return context.newNumber(value);
    });
  }

  private createAsyncStringFunction(
    context: QuickJSAsyncContext,
    name: 'loadBlueContent' | 'loadExternalModule',
    impl?: (input: string) => Promise<string>
  ): QuickJSHandle {
    if (!impl) {
      return context.newAsyncifiedFunction(name, async () => ({
        error: this.toQuickJSErrorHandle(
          context,
          `Host API ${name} not implemented`
        ),
      }));
    }

    return context.newAsyncifiedFunction(name, async (inputHandle) => {
      const input = String(context.dump(inputHandle));
      try {
        const result = await impl(input);
        if (typeof result === 'string') {
          return context.newString(result);
        }
        const { handle } = this.toQuickJSValueWithContext(context, result);
        return handle;
      } catch (error) {
        return {
          error: this.toQuickJSErrorHandle(context, error),
        };
      }
    });
  }

  private toQuickJSErrorHandle(
    context: QuickJSAsyncContext,
    error: unknown
  ): QuickJSHandle {
    if (error instanceof Error) {
      return context.newError({ name: error.name, message: error.message });
    }
    if (typeof error === 'object' && error !== null) {
      const maybeError = error as { name?: unknown; message?: unknown };
      const name =
        typeof maybeError.name === 'string' ? maybeError.name : 'Error';
      const message =
        typeof maybeError.message === 'string'
          ? maybeError.message
          : JSON.stringify(maybeError);
      return context.newError({ name, message });
    }
    return context.newError(String(error));
  }

  private async settleQuickJSHandle(
    handle: QuickJSHandle
  ): Promise<QuickJSHandle> {
    const context = this.ensureContext();
    const runtime = this.ensureRuntime();
    let current = handle;

    while (true) {
      const state = context.getPromiseState(current);

      if (state.type === 'pending') {
        const executed = this.executePendingJobs(runtime);
        if (!executed) {
          await this.yieldToEventLoop();
        }
        continue;
      }

      if (state.type === 'fulfilled') {
        if (state.notAPromise) {
          return current;
        }

        const valueHandle = state.value;
        current.dispose();
        current = valueHandle;
        continue;
      }

      const errorHandle = state.error;
      const normalized = this.normalizeError(context.dump(errorHandle));
      if (errorHandle.alive) {
        errorHandle.dispose();
      }
      current.dispose();
      throw new Error(normalized.message);
    }
  }

  private executePendingJobs(runtime: QuickJSAsyncRuntime): boolean {
    let executed = false;
    while (runtime.hasPendingJob()) {
      const jobResult = runtime.executePendingJobs();
      if (jobResult.error) {
        const errorContext = jobResult.error.context;
        const error = this.normalizeError(errorContext.dump(jobResult.error));
        if (jobResult.error.alive) {
          jobResult.error.dispose();
        }
        jobResult.dispose();
        throw new Error(error.message);
      }

      executed = executed || jobResult.value > 0;
      jobResult.dispose();
    }
    return executed;
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  private deepClone<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private buildInvocationSource(method: ProcessorRequest['method']): string {
    const methodKey = JSON.stringify(method);
    return `(async () => {
      const entry = globalThis.__BLUE_ENTRY__;
      const req = globalThis.__BLUE_REQUEST__;
      if (!entry || typeof entry !== 'object') {
        return { __blueError: { name: 'QuickJsBridgeError', message: 'Processor entry is not available' } };
      }
      const target = entry[${methodKey}];
      if (typeof target !== 'function') {
        return { __blueError: { name: 'QuickJsBridgeError', message: 'Processor method ${method} not found or not callable' } };
      }
      const bound = target.bind(entry);
      switch (${methodKey}) {
        case "initialize": {
          const result = bound(req.document, req.options ?? {});
          return { __blueResult: await result };
        }
        case "processEvents": {
          const result = bound(req.document, req.events, req.options ?? {});
          return { __blueResult: await result };
        }
        default:
          return { __blueError: { name: 'QuickJsBridgeError', message: 'Unsupported processor method: ${method}' } };
      }
    })()`;
  }

  private isErrorEnvelope(
    value: unknown
  ): value is { __blueError: ProcessorResponse['error'] } {
    return (
      typeof value === 'object' &&
      value !== null &&
      '__blueError' in value &&
      (value as Record<string, unknown>).__blueError !== undefined
    );
  }

  private extractResult(value: unknown): unknown {
    if (
      typeof value === 'object' &&
      value !== null &&
      '__blueResult' in value &&
      (value as Record<string, unknown>).__blueResult !== undefined
    ) {
      return (value as Record<string, unknown>).__blueResult;
    }
    return value;
  }

  private normalizeError(error: unknown): ProcessorErrorPayload {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'object' && error !== null) {
      const maybeError = error as {
        message?: unknown;
        name?: unknown;
        stack?: unknown;
      };
      return {
        name: typeof maybeError.name === 'string' ? maybeError.name : 'Error',
        message:
          typeof maybeError.message === 'string'
            ? maybeError.message
            : JSON.stringify(maybeError),
        stack:
          typeof maybeError.stack === 'string' ? maybeError.stack : undefined,
      };
    }

    return {
      name: 'Error',
      message: String(error),
    };
  }

  private refineResourceError(
    error: ProcessorErrorPayload,
    didTimeout: boolean
  ): ProcessorErrorPayload {
    if (didTimeout) {
      return {
        ...error,
        name: 'QuickJsTimeoutError',
        message: 'QuickJS execution exceeded the configured time budget.',
      };
    }

    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('out of memory') || message.includes('allocation')) {
      return {
        ...error,
        name: 'QuickJsOutOfMemoryError',
        message: 'QuickJS memory limit exceeded while processing the request.',
      };
    }

    if (message.includes('stack overflow')) {
      return {
        ...error,
        name: 'QuickJsStackOverflowError',
        message:
          'QuickJS call stack limit exceeded while processing the request.',
      };
    }

    return error;
  }
}
