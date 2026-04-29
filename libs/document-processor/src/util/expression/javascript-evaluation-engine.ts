import {
  QuickJSEvaluator,
  type QuickJSEvaluationOptions,
  type QuickJSEvaluatorOptions,
} from './quickjs-evaluator.js';
import {
  createDocumentJavaScriptExecutionPolicy,
  type DocumentJavaScriptExecutionPolicy,
  type DocumentJavaScriptExecutionPolicyOptions,
  type JavaScriptExecutionPolicyProvider,
} from './javascript-execution-policy.js';

export type JavaScriptEvaluationOptions = QuickJSEvaluationOptions;

export type BlueQuickJsEngineOptions = QuickJSEvaluatorOptions &
  DocumentJavaScriptExecutionPolicyOptions;

export interface JavaScriptEvaluationEngine {
  readonly executionPolicy?: DocumentJavaScriptExecutionPolicy;
  evaluate(options: JavaScriptEvaluationOptions): Promise<unknown>;
}

export class BlueQuickJsEngine
  implements JavaScriptEvaluationEngine, JavaScriptExecutionPolicyProvider
{
  private readonly evaluator: QuickJSEvaluator;
  readonly executionPolicy: DocumentJavaScriptExecutionPolicy;

  constructor(options: BlueQuickJsEngineOptions = {}) {
    this.executionPolicy = createDocumentJavaScriptExecutionPolicy(options);
    this.evaluator = new QuickJSEvaluator({
      executionProfile: this.executionPolicy.executionProfile,
      releaseMode: this.executionPolicy.releaseMode,
      artifactPins: this.executionPolicy.artifactPins,
    });
  }

  evaluate(options: JavaScriptEvaluationOptions): Promise<unknown> {
    const onGasTrace = options.onGasTrace ?? this.executionPolicy.onGasTrace;
    return this.evaluator.evaluate({
      ...options,
      wasmGasLimit:
        options.wasmGasLimit ?? this.executionPolicy.jsCodeStepGasLimit,
      gasTrace:
        options.gasTrace ??
        (this.executionPolicy.enableGasTrace || onGasTrace !== undefined),
      onGasTrace,
    });
  }
}
