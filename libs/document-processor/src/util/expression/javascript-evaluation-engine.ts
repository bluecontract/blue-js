import {
  QuickJSEvaluator,
  type QuickJSEvaluationOptions,
} from './quickjs-evaluator.js';

export type JavaScriptEvaluationOptions = QuickJSEvaluationOptions;

export interface JavaScriptEvaluationEngine {
  evaluate(options: JavaScriptEvaluationOptions): Promise<unknown>;
}

export class BlueQuickJsEngine implements JavaScriptEvaluationEngine {
  private readonly evaluator = new QuickJSEvaluator();

  evaluate(options: JavaScriptEvaluationOptions): Promise<unknown> {
    return this.evaluator.evaluate(options);
  }
}
