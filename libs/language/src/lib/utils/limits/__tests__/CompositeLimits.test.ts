import { BlueNode } from '../../../model';
import { TestLimits } from './TestLimits';
import { CompositeLimits } from '../CompositeLimits';
import { PathLimits } from '../PathLimits';

describe('CompositeLimits', () => {
  it('should combine multiple limit strategies', () => {
    const pathLimits = PathLimits.withSinglePath('/allowed/path/*');
    const testLimits = new TestLimits(['blocked value']);
    const compositeLimits = CompositeLimits.of(pathLimits, testLimits);

    // Node with blocked value should be blocked even if path is allowed
    const nodeWithBlockedValue = new BlueNode();
    nodeWithBlockedValue.setValue('blocked value');
    compositeLimits.enterPathSegment('allowed');
    compositeLimits.enterPathSegment('path');

    expect(
      compositeLimits.shouldMergePathSegment('field', nodeWithBlockedValue),
    ).toBe(false);

    compositeLimits.exitPathSegment();
    compositeLimits.exitPathSegment();

    // Node without blocked value on allowed path should be allowed
    const normalNode = new BlueNode();
    normalNode.setValue('normal value');
    compositeLimits.enterPathSegment('allowed');
    compositeLimits.enterPathSegment('path');

    expect(compositeLimits.shouldMergePathSegment('field', normalNode)).toBe(
      true,
    );

    compositeLimits.exitPathSegment();
    compositeLimits.exitPathSegment();

    // Node without blocked value on disallowed path should be blocked
    compositeLimits.enterPathSegment('disallowed');
    compositeLimits.enterPathSegment('path');

    expect(compositeLimits.shouldMergePathSegment('field', normalNode)).toBe(
      false,
    );
  });
});
