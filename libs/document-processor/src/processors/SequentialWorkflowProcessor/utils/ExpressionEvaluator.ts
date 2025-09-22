import { ProcessingContext } from '../../../types';
import {
  CodeBlockEvaluationError,
  ExpressionEvaluationError,
} from '../../../utils/exceptions';
import type {
  QuickJSAsyncContext,
  QuickJSAsyncRuntime,
  QuickJSAsyncWASMModule,
  QuickJSHandle,
} from 'quickjs-emscripten';
import { newQuickJSAsyncWASMModule } from 'quickjs-emscripten';
import { getEnvFlag, getRuntimeInfo } from '../../../utils/runtimeEnv';

/**
 * Bindings that will be available inside the VM
 */
export interface VMBindings {
  [key: string]: unknown;
  document?: (path: string) => unknown;
  event?: unknown;
  steps?: Record<string, unknown>;
}

const DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024; // 32MB, similar to previous isolated-vm limit
const DEFAULT_TIMEOUT_MS = 500;
const BASE_EXPRESSION_GAS_COST = 50;
const GAS_PER_CHAR_COST = 2;
const GAS_PER_BINDING_COST = 5;
const MODULE_RESOLUTION_GAS_COST = 75;

function shouldSkipQuickJS(): boolean {
  return (
    getEnvFlag('SKIP_QUICKJS') ||
    getEnvFlag('SKIP_QUICKJS_WASM') ||
    getEnvFlag('SKIP_ISOLATED_VM')
  );
}

let quickJsModulePromise: Promise<QuickJSAsyncWASMModule> | null = null;

async function getQuickJsModule(): Promise<QuickJSAsyncWASMModule> {
  if (!quickJsModulePromise) {
    quickJsModulePromise = newQuickJSAsyncWASMModule().catch((err) => {
      quickJsModulePromise = null;
      throw err;
    });
  }
  return quickJsModulePromise;
}

function hasModuleSyntax(code: string): boolean {
  return (
    /\bimport\s.+\sfrom\s+['"][^'"]+['"]/.test(code) || /\bexport\s+/.test(code)
  );
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toDeterministicError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (isObjectLike(value)) {
    const name = typeof value.name === 'string' ? value.name : 'Error';
    const message = typeof value.message === 'string' ? value.message : JSON.stringify(value);
    const error = new Error(message);
    error.name = name;
    return error;
  }
  return new Error(String(value));
}

async function yieldToEventLoop(): Promise<void> {
  if (typeof queueMicrotask === 'function') {
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    return;
  }

  if (typeof setImmediate === 'function') {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return;
  }

  if (typeof setTimeout === 'function') {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return;
  }

  await Promise.resolve();
}

export class ExpressionEvaluator {
  private static getQuickJSUnavailableMessage(error?: unknown): string {
    const { version, platform, arch } = getRuntimeInfo();

    const message = [
      'QuickJS-WASM is required for expression evaluation but could not be initialized.',
      'Ensure the environment supports WebAssembly and that the quickjs-emscripten package is installed.',
      '',
      `Detected environment: ${version} on ${platform}/${arch}.`,
    ];

    if (error) {
      message.push('', `Underlying error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return message.join('\n');
  }

  static async evaluate({
    code,
    ctx,
    bindings = {},
    options = {},
  }: {
    code: string;
    ctx: ProcessingContext;
    bindings?: VMBindings;
    options?: { isCodeBlock?: boolean; timeout?: number };
  }): Promise<unknown> {
    this.chargeForEvaluation(ctx, code, bindings);

    if (shouldSkipQuickJS()) {
      return this.evaluateSimple(code, bindings, options);
    }

    let quickJsModule: QuickJSAsyncWASMModule;
    try {
      quickJsModule = await getQuickJsModule();
    } catch (error) {
      throw new ExpressionEvaluationError(code, this.getQuickJSUnavailableMessage(error));
    }

    try {
      return await this.evaluateWithQuickJS(
        quickJsModule,
        code,
        bindings,
        ctx,
        options
      );
    } catch (error) {
      if (options.isCodeBlock) {
        throw new CodeBlockEvaluationError(code, error);
      }
      throw new ExpressionEvaluationError(code, error);
    }
  }

  private static async evaluateSimple(
    code: string,
    bindings: VMBindings,
    options: { isCodeBlock?: boolean } = {}
  ): Promise<unknown> {
    if (hasModuleSyntax(code)) {
      throw new Error(
        'Static import/export syntax requires QuickJS – start without SKIP_QUICKJS or SKIP_ISOLATED_VM.'
      );
    }

    try {
      if (options.isCodeBlock) {
        const bindingKeys = Object.keys(bindings);
        const evalFn = new Function(
          ...bindingKeys,
          `return async function codeBlock(${bindingKeys.join(', ')}) { ${code} }`
        );
        const codeBlockFn = await evalFn(
          ...bindingKeys.map((key) => bindings[key])
        );
        return await codeBlockFn(...bindingKeys.map((key) => bindings[key]));
      }

      const evalFn = new Function(
        ...Object.keys(bindings),
        `return ${code};`
      );
      return evalFn(...Object.values(bindings));
    } catch (error) {
      if (options.isCodeBlock) throw new CodeBlockEvaluationError(code, error);
      throw new ExpressionEvaluationError(code, error);
    }
  }

  private static async evaluateWithQuickJS(
    quickJsModule: QuickJSAsyncWASMModule,
    code: string,
    bindings: VMBindings,
    ctx: ProcessingContext,
    options: { isCodeBlock?: boolean; timeout?: number } = {}
  ): Promise<unknown> {
    const runtime = quickJsModule.newRuntime();
    const context = runtime.newContext();
    runtime.setMemoryLimit(DEFAULT_MEMORY_LIMIT_BYTES);

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;
    if (deadline) {
      runtime.setInterruptHandler(() => Date.now() > deadline);
    }

    const moduleCache = new Map<string, string>();
    runtime.setModuleLoader(async (specifier) => {
      if (moduleCache.has(specifier)) {
        return moduleCache.get(specifier)!;
      }
      const source = await this.loadModuleSource(specifier, ctx);
      moduleCache.set(specifier, source);
      return source;
    });

    try {
      this.setupBindings(context, bindings);

      let resultHandle: QuickJSHandle;
      if (hasModuleSyntax(code)) {
        resultHandle = await this.evaluateAsModule(
          context,
          runtime,
          code,
          options,
          deadline
        );
      } else {
        resultHandle = await this.evaluateAsScript(
          context,
          runtime,
          code,
          bindings,
          options,
          deadline
        );
      }

      const result = context.dump(resultHandle);
      if (resultHandle.alive) {
        resultHandle.dispose();
      }

      return this.deepClone(result);
    } finally {
      if (deadline) {
        runtime.removeInterruptHandler();
      }
      context.dispose();
      runtime.dispose();
    }
  }

  private static setupBindings(
    context: QuickJSAsyncContext,
    bindings: VMBindings
  ): void {
    const consoleObject = context.newObject();
    const logFunction = context.newAsyncifiedFunction('log', async (...args) => {
      const values = args.map((arg) => context.dump(arg));
      console.log(...values);
      return context.undefined;
    });
    context.setProp(consoleObject, 'log', logFunction);
    logFunction.dispose();
    context.setProp(context.global, 'console', consoleObject);
    consoleObject.dispose();

    for (const [key, value] of Object.entries(bindings)) {
      if (typeof value === 'function') {
        const fnHandle = context.newAsyncifiedFunction(
          key,
          async (...args) => {
            const hostArgs = args.map((arg) => context.dump(arg));
            try {
              const hostResult = await (value as (...fnArgs: unknown[]) => unknown)(
                ...hostArgs
              );
              const { handle } = this.toQuickJSValue(context, hostResult);
              return handle;
            } catch (error) {
              return { error: this.toQuickJSErrorHandle(context, error) };
            }
          }
        );
        context.setProp(context.global, key, fnHandle);
        fnHandle.dispose();
      } else {
        const { handle, dispose } = this.toQuickJSValue(context, value);
        context.setProp(context.global, key, handle);
        if (dispose && handle.alive) {
          handle.dispose();
        }
      }
    }
  }

  private static async evaluateAsScript(
    context: QuickJSAsyncContext,
    runtime: QuickJSAsyncRuntime,
    code: string,
    bindings: VMBindings,
    options: { isCodeBlock?: boolean; timeout?: number },
    deadline: number | null
  ): Promise<QuickJSHandle> {
    const bindingKeys = Object.keys(bindings);
    const paramList = bindingKeys.join(', ');
    const argsList = bindingKeys.join(', ');

    const body = options.isCodeBlock ? code : `return (${code});`;
    const invocation = `(async (${paramList}) => { ${body} })(${argsList})`;

    const evaluation = await context.evalCodeAsync(invocation);
    const handle = context.unwrapResult(evaluation);
    return await this.resolveQuickJSHandle(context, runtime, handle, deadline);
  }

  private static async evaluateAsModule(
    context: QuickJSAsyncContext,
    runtime: QuickJSAsyncRuntime,
    code: string,
    options: { isCodeBlock?: boolean; timeout?: number },
    deadline: number | null
  ): Promise<QuickJSHandle> {
    let moduleCode = code;
    if (options.isCodeBlock) {
      const importExportRegex = /^\s*(import\s.+?;|export\s.+?;)/gm;
      const importExportLines = (code.match(importExportRegex) || []).join('\n');
      const codeWithoutImports = code.replace(importExportRegex, '').trim();

      moduleCode = `
        ${importExportLines}
        const run = function() {
          ${codeWithoutImports}
        };
        export default run();
      `;
    }

    const evaluation = await context.evalCodeAsync(moduleCode, 'expression-evaluator-entry.mjs', {
      type: 'module',
    });
    const namespaceHandle = await this.resolveQuickJSHandle(
      context,
      runtime,
      context.unwrapResult(evaluation),
      deadline
    );

    const defaultExportHandle = context.getProp(namespaceHandle, 'default');
    namespaceHandle.dispose();

    return defaultExportHandle;
  }

  private static async resolveQuickJSHandle(
    context: QuickJSAsyncContext,
    runtime: QuickJSAsyncRuntime,
    handle: QuickJSHandle,
    deadline: number | null
  ): Promise<QuickJSHandle> {
    while (true) {
      const state = context.getPromiseState(handle);

      if (state.type === 'pending') {
        if (deadline && Date.now() > deadline) {
          handle.dispose();
          throw new Error('QuickJS evaluation timed out while waiting for a promise to settle.');
        }

        const executed = this.executePendingJobs(runtime);
        if (!executed) {
          await yieldToEventLoop();
        }
        continue;
      }

      if (state.type === 'fulfilled') {
        if (state.notAPromise) {
          return handle;
        }

        handle.dispose();
        return state.value;
      }

      const errorHandle = state.error;
      const error = toDeterministicError(context.dump(errorHandle));
      if (errorHandle.alive) {
        errorHandle.dispose();
      }
      handle.dispose();
      throw error;
    }
  }

  private static executePendingJobs(runtime: QuickJSAsyncRuntime): boolean {
    let executed = false;
    while (runtime.hasPendingJob()) {
      const jobResult = runtime.executePendingJobs();
      if (jobResult.error) {
        const errorContext = jobResult.error.context;
        const error = toDeterministicError(errorContext.dump(jobResult.error));
        if (jobResult.error.alive) {
          jobResult.error.dispose();
        }
        jobResult.dispose();
        throw error;
      }

      executed = executed || jobResult.value > 0;
      jobResult.dispose();
    }
    return executed;
  }

  private static toQuickJSValue(
    context: QuickJSAsyncContext,
    value: unknown,
    seen: WeakMap<object, QuickJSHandle> = new WeakMap()
  ): { handle: QuickJSHandle; dispose: boolean } {
    if (value === undefined) {
      return { handle: context.undefined, dispose: false };
    }
    if (value === null) {
      return { handle: context.null, dispose: false };
    }
    if (typeof value === 'boolean') {
      return { handle: value ? context.true : context.false, dispose: false };
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return { handle: context.undefined, dispose: false };
      }
      return { handle: context.newNumber(value), dispose: true };
    }
    if (typeof value === 'string') {
      return { handle: context.newString(value), dispose: true };
    }
    if (typeof value === 'bigint') {
      return { handle: context.newBigInt(value), dispose: true };
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      const copy = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      return { handle: context.newArrayBuffer(copy), dispose: true };
    }
    if (value instanceof Date) {
      return { handle: context.newString(value.toJSON()), dispose: true };
    }
    if (value instanceof Map) {
      return this.toQuickJSValue(context, Array.from(value.entries()), seen);
    }
    if (value instanceof Set) {
      return this.toQuickJSValue(context, Array.from(value.values()), seen);
    }
    if (Array.isArray(value)) {
      const arrayHandle = context.newArray();
      for (let index = 0; index < value.length; index++) {
        const { handle: elementHandle, dispose } = this.toQuickJSValue(
          context,
          value[index],
          seen
        );
        context.setProp(arrayHandle, index, elementHandle);
        if (dispose && elementHandle.alive) {
          elementHandle.dispose();
        }
      }
      return { handle: arrayHandle, dispose: true };
    }
    if (isObjectLike(value)) {
      if (seen.has(value)) {
        return { handle: seen.get(value)!, dispose: false };
      }

      const objectHandle = context.newObject();
      seen.set(value, objectHandle);

      for (const [key, entryValue] of Object.entries(value)) {
        const { handle: propertyHandle, dispose } = this.toQuickJSValue(
          context,
          entryValue,
          seen
        );
        context.setProp(objectHandle, key, propertyHandle);
        if (dispose && propertyHandle.alive) {
          propertyHandle.dispose();
        }
      }

      return { handle: objectHandle, dispose: true };
    }

    return { handle: context.undefined, dispose: false };
  }

  private static toQuickJSErrorHandle(
    context: QuickJSAsyncContext,
    error: unknown
  ): QuickJSHandle {
    if (error instanceof Error) {
      return context.newError({ name: error.name, message: error.message });
    }
    return context.newError(String(error));
  }

  private static async loadModuleSource(
    specifier: string,
    ctx: ProcessingContext
  ): Promise<string> {
    this.chargeForModuleResolution(ctx, specifier);

    if (specifier.startsWith('blue:')) {
      const blueId = specifier.slice(5);
      const fetchFn = ctx.loadBlueContent;
      if (typeof fetchFn !== 'function') {
        throw new Error(
          `ProcessingContext is missing a loadBlueContent(blueId) implementation (needed for ${specifier})`
        );
      }
      return await fetchFn(blueId);
    }

    if (/^https?:\/\//.test(specifier)) {
      if (typeof ctx.loadExternalModule !== 'function') {
        throw new Error(
          `ProcessingContext is missing a loadExternalModule(url) implementation (needed for ${specifier})`
        );
      }
      return await ctx.loadExternalModule(specifier);
    }

    throw new Error(`Unsupported module specifier "${specifier}"`);
  }

  private static deepClone<T = unknown>(value: T): T {
    if (typeof value === 'undefined') {
      return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private static chargeForEvaluation(
    ctx: ProcessingContext,
    code: string,
    bindings: VMBindings
  ): void {
    const gasMeter = ctx.getGasMeter?.();
    if (!gasMeter) return;
    const bindingCount = Object.keys(bindings).length;
    const cost =
      BASE_EXPRESSION_GAS_COST +
      code.length * GAS_PER_CHAR_COST +
      bindingCount * GAS_PER_BINDING_COST;
    gasMeter.consume(cost, 'expression');
  }

  private static chargeForModuleResolution(
    ctx: ProcessingContext,
    specifier: string
  ): void {
    const gasMeter = ctx.getGasMeter?.();
    if (!gasMeter) return;
    const cost = MODULE_RESOLUTION_GAS_COST + specifier.length * GAS_PER_CHAR_COST;
    gasMeter.consume(cost, `module:${specifier}`);
  }
}
