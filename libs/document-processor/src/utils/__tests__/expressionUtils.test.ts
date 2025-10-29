import { isExpression, extractExpressionContent } from '../expressionUtils';

describe('expressionUtils', () => {
  describe('isExpression', () => {
    it('should return true for valid expressions', () => {
      expect(isExpression('${some.expression}')).toBe(true);
      expect(isExpression('${steps.result}')).toBe(true);
      expect(isExpression('${event.data}')).toBe(true);
      expect(isExpression('${document("/path")}')).toBe(true);
    });

    it('should return false for invalid expressions', () => {
      expect(isExpression('regular string')).toBe(false);
      expect(isExpression('${incomplete')).toBe(false);
      expect(isExpression('incomplete}')).toBe(false);
      expect(isExpression('$incomplete}')).toBe(false);
      expect(isExpression('{incomplete}')).toBe(false);
      expect(isExpression('')).toBe(false);
      expect(isExpression(null)).toBe(false);
      expect(isExpression(undefined)).toBe(false);
      expect(isExpression(123)).toBe(false);
      expect(isExpression({})).toBe(false);
    });
  });

  describe('extractExpressionContent', () => {
    it('should extract content from valid expressions', () => {
      expect(extractExpressionContent('${some.expression}')).toBe(
        'some.expression',
      );
      expect(extractExpressionContent('${steps.result}')).toBe('steps.result');
      expect(extractExpressionContent('${event.data}')).toBe('event.data');
      expect(extractExpressionContent('${document("/path")}')).toBe(
        'document("/path")',
      );
    });

    it('should throw error for invalid expressions', () => {
      expect(() => extractExpressionContent('regular string')).toThrow(
        'Invalid expression: regular string',
      );
      expect(() => extractExpressionContent('${incomplete')).toThrow(
        'Invalid expression: ${incomplete',
      );
      expect(() => extractExpressionContent('incomplete}')).toThrow(
        'Invalid expression: incomplete}',
      );
    });
  });
});
