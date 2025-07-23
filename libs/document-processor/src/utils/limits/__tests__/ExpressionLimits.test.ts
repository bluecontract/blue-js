import { BlueNode } from '@blue-labs/language';
import { ExpressionLimits } from '../ExpressionLimits';

describe('ExpressionLimits', () => {
  let expressionLimits: ExpressionLimits;

  beforeEach(() => {
    expressionLimits = new ExpressionLimits();
  });

  describe('shouldMergePathSegment', () => {
    it('should return false for nodes with expression values', () => {
      const node = new BlueNode();
      node.setValue('${steps.CreateSubscriptions.changes}');

      expect(expressionLimits.shouldMergePathSegment('changeset', node)).toBe(
        false
      );
    });

    it('should return true for nodes without expression values', () => {
      const node = new BlueNode();
      node.setValue('regular string value');

      expect(expressionLimits.shouldMergePathSegment('changeset', node)).toBe(
        true
      );
    });
  });

  describe('shouldExtendPathSegment', () => {
    it('should return false for nodes with expression values', () => {
      const node = new BlueNode();
      node.setValue('${steps.result}');

      expect(expressionLimits.shouldExtendPathSegment('field', node)).toBe(
        false
      );
    });
  });
});
