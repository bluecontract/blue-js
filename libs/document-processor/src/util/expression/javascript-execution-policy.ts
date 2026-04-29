import {
  DEFAULT_EXPRESSION_WASM_GAS_LIMIT,
  DEFAULT_WASM_GAS_LIMIT,
} from './quickjs-config.js';
import type {
  DocumentJavaScriptExecutionProfile,
  QuickJSArtifactPins,
  QuickJSGasTrace,
} from './quickjs-evaluator.js';

const DEFAULT_DOCUMENT_JS_EXECUTION_PROFILE = 'baseline-v1';

export type DocumentJavaScriptGasTraceHandler = (
  trace: QuickJSGasTrace,
) => void;

export interface DocumentJavaScriptExecutionPolicy {
  readonly jsExpressionGasLimit: bigint;
  readonly jsCodeStepGasLimit: bigint;
  readonly executionProfile: DocumentJavaScriptExecutionProfile;
  readonly enableGasTrace: boolean;
  readonly onGasTrace?: DocumentJavaScriptGasTraceHandler;
  readonly releaseMode: boolean;
  readonly artifactPins: QuickJSArtifactPins;
}

export interface DocumentJavaScriptExecutionPolicyOptions {
  readonly jsExpressionGasLimit?: bigint | number;
  readonly jsCodeStepGasLimit?: bigint | number;
  readonly executionProfile?: DocumentJavaScriptExecutionProfile;
  readonly enableGasTrace?: boolean;
  readonly onGasTrace?: DocumentJavaScriptGasTraceHandler;
  readonly releaseMode?: boolean;
  readonly artifactPins?: QuickJSArtifactPins;
}

export interface JavaScriptExecutionPolicyProvider {
  readonly executionPolicy: DocumentJavaScriptExecutionPolicy;
}

export const DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY: DocumentJavaScriptExecutionPolicy =
  {
    jsExpressionGasLimit: DEFAULT_EXPRESSION_WASM_GAS_LIMIT,
    jsCodeStepGasLimit: DEFAULT_WASM_GAS_LIMIT,
    executionProfile: DEFAULT_DOCUMENT_JS_EXECUTION_PROFILE,
    enableGasTrace: false,
    onGasTrace: undefined,
    releaseMode: false,
    artifactPins: {},
  };

export function createDocumentJavaScriptExecutionPolicy(
  options: DocumentJavaScriptExecutionPolicyOptions = {},
): DocumentJavaScriptExecutionPolicy {
  return {
    jsExpressionGasLimit: normalizeGasLimit(
      options.jsExpressionGasLimit ??
        DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.jsExpressionGasLimit,
      'jsExpressionGasLimit',
    ),
    jsCodeStepGasLimit: normalizeGasLimit(
      options.jsCodeStepGasLimit ??
        DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.jsCodeStepGasLimit,
      'jsCodeStepGasLimit',
    ),
    executionProfile:
      options.executionProfile ??
      DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.executionProfile,
    enableGasTrace:
      options.enableGasTrace ??
      DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.enableGasTrace,
    onGasTrace:
      options.onGasTrace ??
      DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.onGasTrace,
    releaseMode:
      options.releaseMode ??
      DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.releaseMode,
    artifactPins:
      options.artifactPins ??
      DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY.artifactPins,
  };
}

export function getJavaScriptExecutionPolicy(
  value: unknown,
): DocumentJavaScriptExecutionPolicy {
  if (isJavaScriptExecutionPolicyProvider(value)) {
    return value.executionPolicy;
  }
  return DEFAULT_DOCUMENT_JAVASCRIPT_EXECUTION_POLICY;
}

function isJavaScriptExecutionPolicyProvider(
  value: unknown,
): value is JavaScriptExecutionPolicyProvider {
  return (
    value !== null &&
    typeof value === 'object' &&
    'executionPolicy' in value &&
    isDocumentJavaScriptExecutionPolicy(value.executionPolicy)
  );
}

function isDocumentJavaScriptExecutionPolicy(
  value: unknown,
): value is DocumentJavaScriptExecutionPolicy {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<DocumentJavaScriptExecutionPolicy>;
  return (
    typeof candidate.jsExpressionGasLimit === 'bigint' &&
    typeof candidate.jsCodeStepGasLimit === 'bigint' &&
    typeof candidate.executionProfile === 'string' &&
    typeof candidate.enableGasTrace === 'boolean' &&
    (candidate.onGasTrace === undefined ||
      typeof candidate.onGasTrace === 'function') &&
    typeof candidate.releaseMode === 'boolean' &&
    candidate.artifactPins !== null &&
    typeof candidate.artifactPins === 'object'
  );
}

function normalizeGasLimit(value: bigint | number, label: string): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new TypeError(`${label} must be non-negative`);
    }
    return value;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number`);
  }
  return BigInt(Math.trunc(value));
}
