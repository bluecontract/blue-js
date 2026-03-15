import { describe, expect, it } from 'vitest';
import {
  assertRepositoryTypeAliasAvailable,
  isRepositoryTypeAliasAvailable,
  RuntimeEventTypes,
} from '../runtime-type-support.js';

describe('core/runtime-type-support', () => {
  it('reports runtime support for available and unavailable aliases', () => {
    expect(isRepositoryTypeAliasAvailable('Conversation/Event')).toBe(true);
    expect(
      isRepositoryTypeAliasAvailable('PayNote/Capture Funds Requested'),
    ).toBe(true);
    expect(isRepositoryTypeAliasAvailable('Common/Named Event')).toBe(true);
    expect(
      isRepositoryTypeAliasAvailable('PayNote/Backward Payment Requested'),
    ).toBe(false);
  });

  it('throws deterministic errors for unavailable aliases', () => {
    expect(() =>
      assertRepositoryTypeAliasAvailable(
        'PayNote/Backward Payment Requested',
        'test helper',
      ),
    ).toThrow(
      "test helper requires repository type alias 'PayNote/Backward Payment Requested'",
    );
  });

  it('exposes runtime-compatible named event alias', () => {
    expect(RuntimeEventTypes.NamedEvent).toBe('Common/Named Event');
  });
});
