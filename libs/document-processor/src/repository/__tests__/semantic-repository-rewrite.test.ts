import { describe, expect, it } from 'vitest';

import {
  rewriteAliasMappings,
  rewriteBlueIds,
  rewriteBlueIdWithOptionalIndex,
} from '../semantic-repository-rewrite.js';

describe('semantic repository rewrite helpers', () => {
  it('rewrites old repository blueId fragments with #index suffixes', () => {
    expect(
      rewriteBlueIds({ type: { blueId: 'OLD#1' } }, { OLD: 'NEW' }),
    ).toEqual({
      type: { blueId: 'NEW#1' },
    });
  });

  it('prefers exact mappings before indexed suffix rewrites', () => {
    expect(
      rewriteBlueIdWithOptionalIndex('OLD#1', {
        OLD: 'NEW',
        'OLD#1': 'EXACT',
      }),
    ).toBe('EXACT');
  });

  it('rewrites aliases with indexed suffixes', () => {
    expect(rewriteAliasMappings({ Fragment: 'OLD#0' }, { OLD: 'NEW' })).toEqual(
      {
        Fragment: 'NEW#0',
      },
    );
  });
});
