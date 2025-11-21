import {
  evaluate,
  type HostDispatcherHandlers,
  type InputEnvelope,
  type ProgramArtifact,
} from '@blue-quickjs/quickjs-runtime';
import { DV_LIMIT_DEFAULTS, validateDv, type DV } from '@blue-quickjs/dv';
import { DEFAULT_WASM_GAS_LIMIT } from './quickjs-config.js';
import { HOST_V1_MANIFEST, HOST_V1_HASH } from '@blue-quickjs/abi-manifest';

const RESERVED_BINDINGS = new Set([
  'event',
  'eventCanonical',
  'steps',
  'document',
  'emit',
  'canon',
  'console',
]);

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED_WORDS = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'enum',
  'implements',
  'package',
  'protected',
  'interface',
  'private',
  'public',
]);

const HOST_CALL_UNITS = 1;

export interface QuickJSBindings {
  readonly [key: string]: unknown;
}

export interface QuickJSEvaluationOptions {
  readonly code: string;
  readonly bindings?: QuickJSBindings;
  readonly timeout?: number;
  readonly memoryLimit?: number;
  readonly wasmGasLimit?: bigint | number;
  readonly onWasmGasUsed?: (usage: { used: bigint; remaining: bigint }) => void;
}

type DocumentBinding = ((pointer?: unknown) => unknown) & {
  canonical?: (pointer?: unknown) => unknown;
};

type EmitBinding = (value: unknown) => unknown;

type HostCallResult<T> =
  | { ok: T; units: number }
  | { err: { code: string; tag: string; details?: DV }; units: number };

interface HandlerState {
  documentGet: (path: string) => HostCallResult<DV>;
  documentGetCanonical: (path: string) => HostCallResult<DV>;
  emit: (value: DV) => HostCallResult<null>;
}

interface PreparedBindings {
  input: InputEnvelope;
  prelude: string;
}

export class QuickJSEvaluator {
  // Serialize evaluations to avoid races when updating host handler bindings.
  private evaluationQueue: Promise<void> = Promise.resolve();
  private readonly handlerState: HandlerState = {
    documentGet: () => ({ ok: null, units: HOST_CALL_UNITS }),
    documentGetCanonical: () => ({ ok: null, units: HOST_CALL_UNITS }),
    emit: () => ({ ok: null, units: HOST_CALL_UNITS }),
  };

  private readonly handlers: HostDispatcherHandlers = {
    document: {
      get: (path) => this.handlerState.documentGet(path),
      getCanonical: (path) => this.handlerState.documentGetCanonical(path),
    },
    emit: (value) => this.handlerState.emit(value),
  };

  async evaluate(options: QuickJSEvaluationOptions): Promise<unknown> {
    const task = this.evaluationQueue.then(() => this.evaluateOnce(options));
    this.evaluationQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async evaluateOnce({
    code,
    bindings,
    wasmGasLimit,
    onWasmGasUsed,
  }: QuickJSEvaluationOptions): Promise<unknown> {
    const prepared = this.prepareBindings(bindings);
    const gasLimit = wasmGasLimit ?? DEFAULT_WASM_GAS_LIMIT;

    const program: ProgramArtifact = {
      code: this.wrapCode(code, prepared.prelude),
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
    };

    try {
      const result = await evaluate({
        program,
        input: prepared.input,
        gasLimit,
        manifest: HOST_V1_MANIFEST,
        handlers: this.handlers,
      });

      if (!result.ok) {
        throw mapEvaluateError(result);
      }

      if (wasmGasLimit !== undefined && onWasmGasUsed) {
        onWasmGasUsed({
          used: result.gasUsed,
          remaining: result.gasRemaining,
        });
      }

      return normalizeDvValue(result.value);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  private prepareBindings(bindings?: QuickJSBindings): PreparedBindings {
    const resolvedBindings = bindings ?? {};
    const event = normalizeInputDv(resolvedBindings.event, null, 'event');
    const eventCanonical = normalizeInputDv(
      resolvedBindings.eventCanonical ?? event,
      event,
      'eventCanonical',
    );
    const steps = normalizeInputDv(resolvedBindings.steps, [], 'steps');
    const input: InputEnvelope = {
      event,
      eventCanonical,
      steps,
    };

    const documentBinding = this.extractDocumentBinding(resolvedBindings);
    const canonicalBinding =
      typeof documentBinding?.canonical === 'function'
        ? documentBinding.canonical
        : undefined;
    this.handlerState.documentGet = createDocumentHandler(documentBinding);
    this.handlerState.documentGetCanonical = createDocumentHandler(
      canonicalBinding ?? documentBinding,
    );

    const emitBinding = this.extractEmitBinding(resolvedBindings);
    this.handlerState.emit = createEmitHandler(emitBinding);

    const prelude = buildPrelude(resolvedBindings);
    return { input, prelude };
  }

  private extractDocumentBinding(
    bindings: QuickJSBindings,
  ): DocumentBinding | undefined {
    if (!Object.prototype.hasOwnProperty.call(bindings, 'document')) {
      return undefined;
    }
    const value = bindings.document;
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'function') {
      throw new TypeError('QuickJS document binding must be a function');
    }
    return value as DocumentBinding;
  }

  private extractEmitBinding(
    bindings: QuickJSBindings,
  ): EmitBinding | undefined {
    if (!Object.prototype.hasOwnProperty.call(bindings, 'emit')) {
      return undefined;
    }
    const value = bindings.emit;
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'function') {
      throw new TypeError('QuickJS emit binding must be a function');
    }
    return value as EmitBinding;
  }

  private wrapCode(code: string, prelude: string): string {
    const trimmedPrelude = prelude.trim();
    const prefix = trimmedPrelude.length > 0 ? `${trimmedPrelude}\n` : '';
    return `(() => {\n${prefix}return (() => {\n${code}\n})()\n})()`;
  }
}

function normalizeInputDv(value: unknown, fallback: DV, label: string): DV {
  const resolved = value === undefined ? fallback : value;
  try {
    validateDv(resolved, { limits: DV_LIMIT_DEFAULTS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TypeError(
      `QuickJS ${label} binding must be valid DV: ${message}`,
    );
  }
  return resolved;
}

function createDocumentHandler(
  binding: DocumentBinding | undefined,
): (path: string) => HostCallResult<DV> {
  if (!binding) {
    return () => ({ ok: null, units: HOST_CALL_UNITS });
  }
  return (path: string) => {
    try {
      const value = binding(path);
      return {
        ok: (value === undefined ? null : value) as DV,
        units: HOST_CALL_UNITS,
      };
    } catch {
      return {
        err: { code: 'INVALID_PATH', tag: 'host/invalid_path' },
        units: HOST_CALL_UNITS,
      };
    }
  };
}

function createEmitHandler(
  binding: EmitBinding | undefined,
): (value: DV) => HostCallResult<null> {
  if (!binding) {
    return () => ({ ok: null, units: HOST_CALL_UNITS });
  }
  return (value: DV) => {
    try {
      const result = binding(normalizeDvValue(value));
      if (result instanceof Promise) {
        throw new Error('Async emit handlers are not supported');
      }
      return { ok: null, units: HOST_CALL_UNITS };
    } catch {
      return {
        err: { code: 'LIMIT_EXCEEDED', tag: 'host/limit' },
        units: HOST_CALL_UNITS,
      };
    }
  };
}

function buildPrelude(bindings: QuickJSBindings): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(bindings)) {
    if (RESERVED_BINDINGS.has(key)) {
      continue;
    }
    if (typeof value === 'function') {
      throw new TypeError(
        `QuickJS bindings do not support function values for "${key}"`,
      );
    }
    const serialized = serializeBindingValue(value);
    if (isSafeIdentifier(key)) {
      lines.push(`const ${key} = ${serialized};`);
    } else {
      lines.push(`globalThis[${JSON.stringify(key)}] = ${serialized};`);
    }
  }

  return lines.filter(Boolean).join('\n');
}

function serializeBindingValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return 'NaN';
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? 'Infinity' : '-Infinity';
    }
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'bigint') {
    return `BigInt("${value.toString()}")`;
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      if (json === undefined) {
        throw new Error('JSON serialization failed');
      }
      return json;
    } catch {
      throw new TypeError('QuickJS bindings must be JSON-serializable values');
    }
  }
  throw new TypeError(
    `Unsupported QuickJS binding type: ${typeof value as string}`,
  );
}

// DV decoding uses null-prototype maps; normalize to plain objects for JSON consumers.
function normalizeDvValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDvValue(item));
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const normalized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      normalized[key] = normalizeDvValue(nested);
    }
    return normalized;
  }
  return value;
}

function isSafeIdentifier(value: string): boolean {
  return IDENTIFIER_RE.test(value) && !RESERVED_WORDS.has(value);
}

function mapEvaluateError(result: Awaited<ReturnType<typeof evaluate>>): Error {
  if (result.ok) {
    return new Error('Unexpected evaluation result');
  }

  if (result.type === 'invalid-output') {
    const invalid = new Error(result.message);
    invalid.name = 'InvalidOutputError';
    return invalid;
  }

  const detail = result.error;
  if (detail.kind === 'out-of-gas') {
    const outOfGasError = new Error(
      `OutOfGas: ${detail.message || 'out of gas'}`,
    );
    outOfGasError.name = 'OutOfGasError';
    return outOfGasError;
  }

  const message = detail.message || result.message;
  const error = new Error(message);

  if (detail.kind === 'js-exception') {
    error.name = detail.name || 'Error';
    return error;
  }

  if (detail.kind === 'host-error') {
    error.name = 'HostError';
    return error;
  }

  if (detail.kind === 'manifest-error') {
    error.name = 'ManifestError';
    return error;
  }

  if (detail.kind === 'unknown' && detail.name) {
    error.name = detail.name;
  }

  return error;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error ?? 'Unknown error'));
}
