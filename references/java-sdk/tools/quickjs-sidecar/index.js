#!/usr/bin/env node

import readline from 'node:readline';
import {
  evaluate,
} from '@blue-quickjs/quickjs-runtime';
import {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
} from '@blue-quickjs/abi-manifest';

const FALLBACK_WASM_GAS_LIMIT = 1_000_000_000n;
const HOST_CALL_UNITS = 1;

const reader = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

function respond(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function normalizeInputBindings(bindings) {
  const safe = bindings && typeof bindings === 'object' ? bindings : {};
  const event = Object.prototype.hasOwnProperty.call(safe, 'event')
    ? safe.event
    : null;
  const eventCanonical =
    Object.prototype.hasOwnProperty.call(safe, 'eventCanonical') &&
    safe.eventCanonical !== undefined
      ? safe.eventCanonical
      : event;
  const steps = Object.prototype.hasOwnProperty.call(safe, 'steps') &&
    safe.steps !== undefined
      ? safe.steps
      : [];
  const currentContract = Object.prototype.hasOwnProperty.call(
    safe,
    'currentContract',
  )
    ? safe.currentContract
    : null;
  const currentContractCanonical =
    Object.prototype.hasOwnProperty.call(safe, 'currentContractCanonical') &&
    safe.currentContractCanonical !== undefined
      ? safe.currentContractCanonical
      : currentContract;
  return {
    bindings: safe,
    input: {
      event,
      eventCanonical,
      steps,
      currentContract,
      currentContractCanonical,
    },
  };
}

function toBigIntOrDefault(raw) {
  if (raw === null || raw === undefined) {
    return FALLBACK_WASM_GAS_LIMIT;
  }
  try {
    const value = BigInt(String(raw));
    if (value <= 0n) {
      return 1n;
    }
    return value;
  } catch (_error) {
    return FALLBACK_WASM_GAS_LIMIT;
  }
}

function isSafeBindingIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function serializeBindingLiteral(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return 'null';
  }
  return serialized;
}

function buildBindingPrelude(bindings) {
  const reserved = new Set([
    'event',
    'eventCanonical',
    'steps',
    'currentContract',
    'currentContractCanonical',
    'emit',
    'document',
  ]);
  const lines = [];
  for (const [key, value] of Object.entries(bindings)) {
    if (reserved.has(key)) {
      continue;
    }
    if (!isSafeBindingIdentifier(key)) {
      continue;
    }
    lines.push(`const ${key} = ${serializeBindingLiteral(value)};`);
  }
  if (lines.length === 0) {
    return '';
  }
  return `${lines.join('\n')}\n`;
}

function mapEvaluateError(result) {
  if (!result || result.ok !== false) {
    return {
      name: 'Error',
      message: 'Unknown QuickJS runtime failure',
      stack: undefined,
    };
  }

  const detail = result.error || {};
  if (detail.kind === 'out-of-gas') {
    return {
      name: 'OutOfGasError',
      message: `OutOfGas: ${detail.message || 'out of gas'}`,
      stack: result.raw || undefined,
    };
  }
  if (detail.kind === 'js-exception') {
    return {
      name: detail.name || 'Error',
      message: detail.message || result.message || 'QuickJS exception',
      stack: result.raw || undefined,
    };
  }
  if (detail.kind === 'host-error') {
    return {
      name: 'HostError',
      message: detail.message || result.message || 'QuickJS host error',
      stack: result.raw || undefined,
    };
  }
  if (detail.kind === 'manifest-error') {
    return {
      name: 'ManifestError',
      message: detail.message || result.message || 'QuickJS manifest error',
      stack: result.raw || undefined,
    };
  }
  return {
    name: detail.name || 'Error',
    message: detail.message || result.message || 'QuickJS evaluation failed',
    stack: result.raw || undefined,
  };
}

function isUndefinedResultError(result) {
  if (!result || result.ok !== false || !result.error) {
    return false;
  }
  const detail = result.error;
  return (
    detail.kind === 'js-exception' &&
    detail.name === 'TypeError' &&
    typeof detail.message === 'string' &&
    detail.message.includes('unsupported DV type: undefined')
  );
}

function buildResultWithEvents(value, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { value, resultDefined: true };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const withEvents = { ...value };
    if (Array.isArray(withEvents.events)) {
      withEvents.events = [...withEvents.events, ...events];
    } else {
      withEvents.events = events;
    }
    return { value: withEvents, resultDefined: true };
  }
  return {
    value: {
      __result: value,
      __resultDefined: true,
      events,
    },
    resultDefined: true,
  };
}

function buildUndefinedWithEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { value: null, resultDefined: false };
  }
  return {
    value: {
      __resultDefined: false,
      events,
    },
    resultDefined: false,
  };
}

function collapseSlashes(pointer) {
  if (typeof pointer !== 'string' || pointer.length === 0) {
    return '/';
  }
  let out = '';
  let previousSlash = false;
  for (let i = 0; i < pointer.length; i += 1) {
    const ch = pointer.charAt(i);
    if (ch === '/') {
      if (!previousSlash) {
        out += '/';
      }
      previousSlash = true;
      continue;
    }
    previousSlash = false;
    out += ch;
  }
  if (out.length > 1 && out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  return out.length === 0 ? '/' : out;
}

function normalizePointer(pointer, scopePath) {
  if (pointer === undefined || pointer === null || pointer === '') {
    return '/';
  }
  if (typeof pointer !== 'string') {
    return null;
  }
  if (pointer.startsWith('/')) {
    return collapseSlashes(pointer);
  }
  let scope = typeof scopePath === 'string' && scopePath.length > 0 ? scopePath : '/';
  if (!scope.startsWith('/')) {
    scope = `/${scope}`;
  }
  scope = collapseSlashes(scope);
  const combined = scope === '/' ? `/${pointer}` : `${scope}/${pointer}`;
  return collapseSlashes(combined);
}

function readAtPointer(root, pointer, scopePath) {
  if (root === undefined || root === null) {
    return null;
  }
  const normalized = normalizePointer(pointer, scopePath);
  if (normalized === null) {
    return null;
  }
  if (normalized === '/') {
    return root;
  }
  const segments = normalized
    .substring(1)
    .split('/')
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = root;
  for (const segment of segments) {
    if (current === undefined || current === null) {
      return null;
    }
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) {
        return null;
      }
      const index = Number(segment);
      current = current[index];
      continue;
    }
    if (typeof current !== 'object') {
      return null;
    }
    current = current[segment];
  }
  return current === undefined ? null : current;
}

function unwrapPotentialNode(current) {
  if (
    current &&
    typeof current === 'object' &&
    !Array.isArray(current) &&
    Object.prototype.hasOwnProperty.call(current, 'value')
  ) {
    const keys = Object.keys(current);
    const allowed = new Set(['value', 'type', 'name', 'description']);
    if (keys.length <= 4 && keys.every((key) => allowed.has(key))) {
      return current.value;
    }
  }
  return current;
}

function isRawValuePointer(normalizedPointer) {
  if (!normalizedPointer || normalizedPointer === '/') {
    return false;
  }
  const idx = normalizedPointer.lastIndexOf('/');
  const segment = idx >= 0 ? normalizedPointer.substring(idx + 1) : normalizedPointer;
  return (
    segment === 'blueId' ||
    segment === 'name' ||
    segment === 'description' ||
    segment === 'value'
  );
}

function isTypeMetadataPointer(normalizedPointer) {
  if (!normalizedPointer) {
    return false;
  }
  return normalizedPointer === '/type' || normalizedPointer.indexOf('/type/') >= 0;
}

function readSimpleDocument(bindings, pointer) {
  const scopePath = bindings.__scopePath;
  const normalizedPointer = normalizePointer(pointer, scopePath);
  if (normalizedPointer === null) {
    return null;
  }
  const simple =
    bindings.__documentDataSimple !== undefined
      ? bindings.__documentDataSimple
      : bindings.__documentData;
  const canonical = bindings.__documentDataCanonical ?? simple;

  let value = readAtPointer(simple, normalizedPointer, scopePath);
  if (value === null && (isRawValuePointer(normalizedPointer) || isTypeMetadataPointer(normalizedPointer))) {
    const canonicalValue = readAtPointer(canonical, normalizedPointer, scopePath);
    if (canonicalValue !== null) {
      return unwrapPotentialNode(canonicalValue);
    }
  }
  if (value === null) {
    return null;
  }
  return unwrapPotentialNode(value);
}

function readCanonicalDocument(bindings, pointer) {
  const scopePath = bindings.__scopePath;
  const normalizedPointer = normalizePointer(pointer, scopePath);
  if (normalizedPointer === null) {
    return null;
  }
  const simple =
    bindings.__documentDataSimple !== undefined
      ? bindings.__documentDataSimple
      : bindings.__documentData;
  const canonical = bindings.__documentDataCanonical ?? simple;
  const value = readAtPointer(canonical, normalizedPointer, scopePath);
  if (value === null) {
    return null;
  }
  if (isRawValuePointer(normalizedPointer)) {
    return unwrapPotentialNode(value);
  }
  return value;
}

async function evaluateCode(code, bindings, wasmGasLimit) {
  const normalized = normalizeInputBindings(bindings);
  const prelude = buildBindingPrelude(normalized.bindings);
  const programCode = `${prelude}${typeof code === 'string' ? code : ''}`;
  const gasLimit = toBigIntOrDefault(wasmGasLimit);

  let evaluated = await evaluateProgram(programCode, normalized, gasLimit);
  if (shouldRetryWrapped(evaluated.runtimeResult)) {
    evaluated = await evaluateProgram(
      `(() => {\n${programCode}\n})()`,
      normalized,
      gasLimit,
    );
  }
  const emittedEvents = evaluated.emittedEvents;
  const runtimeResult = evaluated.runtimeResult;

  if (runtimeResult.ok) {
    const normalizedResult = buildResultWithEvents(runtimeResult.value, emittedEvents);
    return {
      ok: true,
      result: normalizedResult.value,
      resultDefined: normalizedResult.resultDefined,
      wasmGasUsed: runtimeResult.gasUsed,
      wasmGasRemaining: runtimeResult.gasRemaining,
    };
  }

  if (isUndefinedResultError(runtimeResult)) {
    const normalizedUndefined = buildUndefinedWithEvents(emittedEvents);
    return {
      ok: true,
      result: normalizedUndefined.value,
      resultDefined: normalizedUndefined.resultDefined,
      wasmGasUsed: runtimeResult.gasUsed,
      wasmGasRemaining: runtimeResult.gasRemaining,
    };
  }

  return {
    ok: false,
    error: mapEvaluateError(runtimeResult),
    wasmGasUsed: runtimeResult.gasUsed,
    wasmGasRemaining: runtimeResult.gasRemaining,
  };
}

async function evaluateProgram(programCode, normalized, gasLimit) {
  const emittedEvents = [];
  const runtimeResult = await evaluate({
    program: {
      code: programCode,
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
    },
    input: normalized.input,
    gasLimit,
    manifest: HOST_V1_MANIFEST,
    handlers: {
      document: {
        get: (path) => ({
          ok: readSimpleDocument(normalized.bindings, path),
          units: HOST_CALL_UNITS,
        }),
        getCanonical: (path) => ({
          ok: readCanonicalDocument(normalized.bindings, path),
          units: HOST_CALL_UNITS,
        }),
      },
      emit: (value) => {
        emittedEvents.push(value);
        return { ok: null, units: HOST_CALL_UNITS };
      },
    },
  });
  return { runtimeResult, emittedEvents };
}

function shouldRetryWrapped(result) {
  if (!result || result.ok !== false || !result.error) {
    return false;
  }
  const detail = result.error;
  return detail.kind === 'js-exception' && detail.name === 'SyntaxError';
}

reader.on('line', async (line) => {
  if (!line || !line.trim()) {
    return;
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    respond({
      id: null,
      ok: false,
      error: {
        name: 'Error',
        message: `Invalid JSON request: ${error.message}`,
      },
    });
    return;
  }

  const id = request.id || null;
  const code = typeof request.code === 'string' ? request.code : '';
  const bindings =
    request.bindings && typeof request.bindings === 'object'
      ? request.bindings
      : {};
  const wasmGasLimit = request.wasmGasLimit != null ? String(request.wasmGasLimit) : null;

  try {
    const runtime = await evaluateCode(code, bindings, wasmGasLimit);
    if (runtime.ok) {
      respond({
        id,
        ok: true,
        resultDefined: runtime.resultDefined,
        result: runtime.result,
        wasmGasUsed:
          runtime.wasmGasUsed == null ? null : runtime.wasmGasUsed.toString(),
        wasmGasRemaining:
          runtime.wasmGasRemaining == null
            ? null
            : runtime.wasmGasRemaining.toString(),
      });
      return;
    }

    respond({
      id,
      ok: false,
      wasmGasUsed:
        runtime.wasmGasUsed == null ? null : runtime.wasmGasUsed.toString(),
      wasmGasRemaining:
        runtime.wasmGasRemaining == null
          ? null
          : runtime.wasmGasRemaining.toString(),
      error: runtime.error,
    });
  } catch (error) {
    respond({
      id,
      ok: false,
      error: {
        name: error && error.name ? error.name : 'Error',
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? String(error.stack) : undefined,
      },
    });
  }
});
