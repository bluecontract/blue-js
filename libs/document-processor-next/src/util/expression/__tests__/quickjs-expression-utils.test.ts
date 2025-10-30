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
import { QuickJSEvaluator } from '../quickjs-evaluator.js';
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
        'steps.value * factor',
        {
          steps: { value: 6 },
          factor: 7,
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
        'Hello ${person.name}, you have ${inbox.count} new messages.',
        {
          person: { name: 'Blue' },
          inbox: { count: 3 },
        },
      );

      expect(result).toBe('Hello Blue, you have 3 new messages.');
    });
  });

  describe('resolveNodeExpressions', () => {
    const blue = createBlue();
    const context = { blue } as unknown as ContractProcessorContext;

    it('resolves matching pointers and leaves others untouched', async () => {
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
        document: (pointer: string) => {
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
  });
});
