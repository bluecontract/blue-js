import { describe, expect, it } from 'vitest';

import {
  isExpression,
  containsExpression,
  extractExpressionContent,
  evaluateQuickJSExpression,
  resolveTemplateString,
  createPicomatchShouldResolve,
  resolveNodeExpressions,
} from '../quickjs-expression-utils.js';
import {
  QuickJSEvaluator,
  type QuickJSEvaluationOptions,
} from '../quickjs-evaluator.js';
import { createBlue } from '../../../test-support/blue.js';
import type { ContractProcessorContext } from '../../../registry/types.js';

describe('quickjs-expression-utils', () => {
  const evaluator = new QuickJSEvaluator();

  describe('expression helpers', () => {
    it('detects standalone expressions', () => {
      expect(isExpression('${value}')).toBe(true);
      expect(isExpression('${foo} + ${bar}')).toBe(false);
      expect(isExpression('plain text')).toBe(false);
    });

    it('detects strings containing expressions', () => {
      expect(containsExpression('${value}')).toBe(true);
      expect(containsExpression('hello ${value} world')).toBe(true);
      expect(containsExpression('just text')).toBe(false);
    });

    it('extracts the inner expression content', () => {
      expect(extractExpressionContent('${steps.answer}')).toBe('steps.answer');
      expect(() => extractExpressionContent('not an expression')).toThrow(
        /Invalid expression/,
      );
    });
  });

  describe('QuickJS evaluation utilities', () => {
    it('evaluates QuickJS expressions with provided bindings', async () => {
      const result = await evaluateQuickJSExpression(
        evaluator,
        'steps.value * steps.factor',
        {
          steps: { value: 6, factor: 7 },
        },
      );

      expect(result).toBe(42);
    });

    it('wraps evaluation failures in CodeBlockEvaluationError', async () => {
      await expect(
        evaluateQuickJSExpression(evaluator, 'invalid ?? expression', {}),
      ).rejects.toThrow('Failed to evaluate code block');
    });

    it('resolves template strings with multiple expressions', async () => {
      const result = await resolveTemplateString(
        evaluator,
        'Hello ${steps.person.name}, you have ${steps.inbox.count} new messages.',
        {
          steps: { person: { name: 'Blue' }, inbox: { count: 3 } },
        },
      );

      expect(result).toBe('Hello Blue, you have 3 new messages.');
    });
  });

  describe('resolveNodeExpressions', () => {
    const blue = createBlue();

    it('resolves matching pointers and leaves others untouched', async () => {
      const wasmCharges: bigint[] = [];
      const context = {
        blue,
        gasMeter: () => ({
          chargeWasmGas(amount: bigint | number) {
            wasmCharges.push(
              typeof amount === 'bigint' ? amount : BigInt(amount),
            );
          },
        }),
      } as unknown as ContractProcessorContext;
      const node = blue.jsonValueToNode({
        keep: 'Value stays',
        direct: '${steps.answer}',
        template: 'Total: ${steps.answer} ${document("/unit")}',
        nested: [
          {
            flag: '${steps.flag}',
          },
          {
            flag: 'no substitution',
          },
        ],
      });

      const bindings = {
        steps: { answer: 42, flag: 'yes' },
        document: (pointer: unknown) => {
          if (pointer === '/unit') {
            return 'points';
          }
          return undefined;
        },
      };

      const shouldResolve = createPicomatchShouldResolve({
        include: ['/direct', '/template', '/nested/**'],
      });

      const resolved = await resolveNodeExpressions({
        evaluator,
        node,
        bindings,
        shouldResolve,
        context,
      });

      const resolvedJson = blue.nodeToJson(resolved, 'original') as {
        keep: string;
        direct: number;
        template: string;
        nested: Array<{ flag: string }>;
      };

      expect(resolvedJson.keep).toBe('Value stays');
      expect(resolvedJson.direct).toBe(42);
      expect(resolvedJson.template).toBe('Total: 42 points');
      expect(resolvedJson.nested[0].flag).toBe('yes');
      expect(resolvedJson.nested[1].flag).toBe('no substitution');

      const originalJson = blue.nodeToJson(node, 'original') as {
        direct: string;
      };
      expect(originalJson.direct).toBe('${steps.answer}');
      // WASM gas is charged for each expression evaluation
      expect(wasmCharges.length).toBeGreaterThanOrEqual(1);
    });

    it('charges wasm gas usage for each evaluated expression', async () => {
      const wasmCharges: number[] = [];
      const context = {
        blue,
        gasMeter: () => ({
          chargeWasmGas(amount: bigint | number) {
            const numeric =
              typeof amount === 'bigint' ? Number(amount) : amount;
            wasmCharges.push(numeric);
          },
        }),
      } as unknown as ContractProcessorContext;
      const mockEvaluator = {
        async evaluate({
          onWasmGasUsed,
        }: QuickJSEvaluationOptions): Promise<unknown> {
          onWasmGasUsed?.({ used: 123n, remaining: 0n });
          return 7;
        },
      } as unknown as QuickJSEvaluator;
      const node = blue.jsonValueToNode({ value: '${steps.answer}' });

      const resolved = await resolveNodeExpressions({
        evaluator: mockEvaluator,
        node,
        bindings: {},
        shouldResolve: createPicomatchShouldResolve({
          include: ['/**'],
        }),
        context,
      });

      expect(blue.nodeToJson(resolved, 'simple')).toBe(7);
      expect(wasmCharges).toStrictEqual([123]);
    });

    it('supports custom include/exclude patterns', () => {
      const predicate = createPicomatchShouldResolve({
        include: ['/include/**'],
        exclude: ['/include/skip/**'],
      });

      expect(predicate('/include/path')).toBe(true);
      expect(predicate('/include/skip/here')).toBe(false);
      expect(predicate('/other')).toBe(false);
    });

    it('honors shouldDescend predicates to keep literal subtrees intact', async () => {
      const context = {
        blue,
        gasMeter: () => ({
          chargeWasmGas() {
            return undefined;
          },
        }),
      } as unknown as ContractProcessorContext;
      const node = blue.jsonValueToNode({
        resolve: '${steps.answer}',
        literal: {
          nested: '${steps.answer}',
        },
      });

      const resolved = await resolveNodeExpressions({
        evaluator,
        node,
        bindings: { steps: { answer: 42 } },
        shouldResolve: createPicomatchShouldResolve({
          include: ['/**'],
        }),
        shouldDescend: (pointer) => pointer !== '/literal',
        context,
      });

      const json = blue.nodeToJson(resolved, 'original') as {
        resolve: number;
        literal: { nested: string };
      };
      expect(json.resolve).toBe(42);
      expect(json.literal.nested).toBe('${steps.answer}');
    });
  });
});
