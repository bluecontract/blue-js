import { describe, expect, it } from 'vitest';
import { classifyChange, CHANGE_STATUS } from '../lib/core/diff';
import { PRIMITIVE_BLUE_IDS } from '../lib/core/constants';
import type { Alias, JsonMap } from '../lib/core/internalTypes';

const previousHandlerBlueId = 'previous-handler-blue-id';
const currentHandlerBlueId = PRIMITIVE_BLUE_IDS.Handler;

const previousContent: JsonMap = {
  name: 'Uses Handler',
  description: 'unchanged',
  handler: { type: { blueId: previousHandlerBlueId } },
};
const nextContent: JsonMap = {
  name: 'Uses Handler',
  description: 'unchanged',
  handler: { type: { blueId: currentHandlerBlueId } },
};
const sourceContent: JsonMap = {
  name: 'Uses Handler',
  description: 'unchanged',
  handler: { type: 'Handler' },
};

describe('registry rotation classification', () => {
  it('classifies a consistently inferred symbolic registry update as non-breaking', () => {
    expect(
      classifyChange(
        previousContent,
        nextContent,
        'Core',
        'Uses Handler',
        new Map<string, Set<Alias>>(),
        sourceContent,
        new Map([['Handler', previousHandlerBlueId]]),
      ),
    ).toEqual({ status: CHANGE_STATUS.NonBreaking, attributesAdded: [] });
  });

  it('does not guess when prior registry provenance is inconsistent', () => {
    expect(
      classifyChange(
        previousContent,
        nextContent,
        'Core',
        'Uses Handler',
        new Map<string, Set<Alias>>(),
        sourceContent,
        new Map([['Handler', 'some-other-id']]),
      ).status,
    ).toBe(CHANGE_STATUS.Breaking);
  });

  it('does not hide an ordinary content change behind a registry update', () => {
    expect(
      classifyChange(
        previousContent,
        { ...nextContent, description: 'changed' },
        'Core',
        'Uses Handler',
        new Map<string, Set<Alias>>(),
        sourceContent,
        new Map([['Handler', previousHandlerBlueId]]),
      ).status,
    ).toBe(CHANGE_STATUS.Breaking);
  });

  it('requires the current symbolic alias to resolve to the emitted BlueId', () => {
    expect(
      classifyChange(
        previousContent,
        nextContent,
        'Core',
        'Uses Handler',
        new Map<string, Set<Alias>>(),
        {
          name: 'Uses Handler',
          handler: { type: 'Channel' },
        },
        new Map([['Channel', previousHandlerBlueId]]),
      ).status,
    ).toBe(CHANGE_STATUS.Breaking);
  });

  it('classifies a proven cyclic fragment reorder as non-breaking', () => {
    const alias = 'Core/Peer' as Alias;
    const aliases = new Map<string, Set<Alias>>([
      ['old-master#1', new Set([alias])],
      ['new-master#0', new Set([alias])],
    ]);

    expect(
      classifyChange(
        {
          name: 'Cyclic',
          peer: { type: { blueId: 'this#1' } },
        },
        {
          name: 'Cyclic',
          peer: { type: { blueId: 'this#0' } },
        },
        'Core',
        'Cyclic',
        aliases,
        {
          name: 'Cyclic',
          peer: { type: alias },
        },
        new Map(),
        'old-master#0',
        'new-master#1',
      ),
    ).toEqual({ status: CHANGE_STATUS.NonBreaking, attributesAdded: [] });
  });

  it('rejects an unproven cyclic fragment reorder', () => {
    expect(
      classifyChange(
        {
          name: 'Cyclic',
          peer: { type: { blueId: 'this#1' } },
        },
        {
          name: 'Cyclic',
          peer: { type: { blueId: 'this#0' } },
        },
        'Core',
        'Cyclic',
        new Map(),
        {
          name: 'Cyclic',
          peer: { type: 'Core/Peer' },
        },
        new Map(),
        'old-master#0',
        'new-master#1',
      ).status,
    ).toBe(CHANGE_STATUS.Breaking);
  });
});
