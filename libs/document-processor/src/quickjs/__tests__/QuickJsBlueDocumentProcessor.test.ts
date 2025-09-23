import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { QuickJsHostBridge } from '../QuickJsHostBridge';
import { QuickJsBlueDocumentProcessor } from '../QuickJsBlueDocumentProcessor';

const BASIC_ENTRY = `(() => {
  const entry = {
    initialize(document, options) {
      return {
        state: document,
        emitted: [],
        gasUsed: options?.gasBudget ?? 0,
        gasRemaining: options?.gasBudget ?? 0,
      };
    },
    processEvents(document, events, options) {
      return {
        state: document,
        emitted: events ?? [],
        gasUsed: options?.gasBudget ?? 0,
        gasRemaining: 0,
      };
    },
  };
  globalThis.__BLUE_ENTRY__ = entry;
  return entry;
})()`;

const ERROR_ENTRY = `(() => {
  const entry = {
    initialize() {
      return { __blueError: { name: 'GasBudgetExceededError', message: 'budget exceeded' } };
    },
  };
  globalThis.__BLUE_ENTRY__ = entry;
  return entry;
})()`;

describe('QuickJsBlueDocumentProcessor', () => {
  const blue = new Blue({ repositories: [coreRepository, myosRepository] });

  it('delegates initialize/processEvents through QuickJS bridge', async () => {
    const bridge = new QuickJsHostBridge({ entrySource: BASIC_ENTRY });
    const processor = new QuickJsBlueDocumentProcessor(blue, bridge);

    const documentJson = {
      contracts: {
        example: {
          type: 'Sequential Workflow',
        },
      },
    };

    const documentNode = blue.jsonValueToNode(documentJson);

    const initResult = await processor.initialize(documentNode, { gasBudget: 10 });
    expect(blue.nodeToJson(initResult.state, 'simple')).toStrictEqual(
      blue.nodeToJson(documentNode, 'simple')
    );
    expect(initResult.gasUsed).toBe(10);
    expect(initResult.emitted).toHaveLength(0);

    const eventJson = {
      type: 'MyOS Timeline Entry',
      timeline: { timelineId: 'timeline-1' },
    };

    const processResult = await processor.processEvents(
      documentNode,
      [blue.jsonValueToNode(eventJson)],
      { gasBudget: 5 }
    );

    expect(blue.nodeToJson(processResult.state, 'simple')).toStrictEqual(
      blue.nodeToJson(documentNode, 'simple')
    );
    expect(processResult.gasUsed).toBe(5);
    expect(processResult.gasRemaining).toBe(0);
    expect(processResult.emitted).toHaveLength(1);
    expect(
      blue.nodeToJson(processResult.emitted[0] as any, 'simple')
    ).toStrictEqual(blue.nodeToJson(blue.jsonValueToNode(eventJson), 'simple'));
  });

  it('propagates QuickJS error envelopes as exceptions', async () => {
    const bridge = new QuickJsHostBridge({ entrySource: ERROR_ENTRY });
    const processor = new QuickJsBlueDocumentProcessor(blue, bridge);
    const documentNode = blue.jsonValueToNode({ contracts: {} });

    await expect(processor.initialize(documentNode)).rejects.toThrow(
      /budget exceeded/
    );
  });
});
