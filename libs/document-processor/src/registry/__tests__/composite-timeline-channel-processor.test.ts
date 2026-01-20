import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { createBlue } from '../../test-support/blue.js';
import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';
import {
  buildProcessor,
  expectOk,
  property,
  typeBlueId,
} from '../../__tests__/test-utils.js';
import { TestEventChannelProcessor } from '../../__tests__/processors/index.js';
import type {
  ChannelContract,
  ChannelEventCheckpoint,
  CompositeTimelineChannel,
  MarkerContract,
} from '../../model/index.js';
import type { ChannelContractEntry } from '../../types/channel-contract-entry.js';
import type { ChannelEvaluationContext } from '../types.js';
import {
  CompositeTimelineChannelProcessor,
  compositeCheckpointKey,
} from '../processors/composite-timeline-channel-processor.js';
import { RecencyTestChannelProcessor } from '../../__tests__/processors/recency-test-channel.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

const blue = createBlue();

function testEvent(value: number): BlueNode {
  return blue.jsonValueToNode({
    type: { blueId: 'TestEvent' },
    value,
  });
}

function channelNode(blueId: string): BlueNode {
  return new BlueNode().setType(new BlueNode().setBlueId(blueId));
}

function resolveFrom(
  entries: ChannelContractEntry[],
): ChannelEvaluationContext['resolveChannel'] {
  const map = new Map(entries.map((entry) => [entry.key, entry]));
  return (key) => map.get(key) ?? null;
}

function baseContext(args: {
  event: BlueNode;
  resolveChannel: ChannelEvaluationContext['resolveChannel'];
  channelProcessorFor: ChannelEvaluationContext['channelProcessorFor'];
  markers?: ReadonlyMap<string, MarkerContract>;
  bindingKey?: string;
}): ChannelEvaluationContext {
  return {
    scopePath: '/',
    blue,
    event: args.event,
    markers: args.markers ?? new Map(),
    bindingKey: args.bindingKey ?? 'compositeChannel',
    resolveChannel: args.resolveChannel,
    channelProcessorFor: args.channelProcessorFor,
  };
}

describe('CompositeTimelineChannelProcessor', () => {
  it('throws when a referenced child is missing', async () => {
    const processor = new CompositeTimelineChannelProcessor();
    const channelProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['missingChild'],
    };

    const context = baseContext({
      event: testEvent(1),
      resolveChannel: () => null,
      channelProcessorFor: (_node) => channelProcessor,
    });

    await expect(processor.evaluate(contract, context)).rejects.toThrow(
      /missing channel/i,
    );
  });

  it('returns no matches when no children match the event', async () => {
    const processor = new CompositeTimelineChannelProcessor();
    const channelProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['child'],
    };
    const entry: ChannelContractEntry = {
      key: 'child',
      contract: {} as ChannelContract,
      blueId: 'RecencyTestChannel',
      node: channelNode('RecencyTestChannel'),
    };

    const randomEvent = blue.jsonValueToNode({
      type: { blueId: 'RandomEvent' },
    });

    const result = await processor.evaluate(
      contract,
      baseContext({
        event: randomEvent,
        resolveChannel: resolveFrom([entry]),
        channelProcessorFor: (_node) => channelProcessor,
      }),
    );

    expect(result.matches).toBe(false);
    expect(result.deliveries ?? []).toHaveLength(0);
  });

  it('delivers a single match with channelized output and source metadata', async () => {
    const processor = new CompositeTimelineChannelProcessor();
    const channelProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['child'],
    };
    const entry: ChannelContractEntry = {
      key: 'child',
      contract: { minDelta: 0 } as ChannelContract,
      blueId: 'RecencyTestChannel',
      node: channelNode('RecencyTestChannel'),
    };

    const result = await processor.evaluate(
      contract,
      baseContext({
        event: testEvent(5),
        resolveChannel: resolveFrom([entry]),
        channelProcessorFor: (_node) => channelProcessor,
      }),
    );

    expect(result.matches).toBe(true);
    expect(result.deliveries ?? []).toHaveLength(1);

    const delivered = result.deliveries?.[0]?.eventNode;
    const deliveredProps = delivered?.getProperties() ?? {};
    expect(deliveredProps.channelized?.getValue()).toBe(true);
    const meta = deliveredProps.meta;
    expect(meta).toBeInstanceOf(BlueNode);
    const sourceKey = meta
      ?.getProperties()
      ?.compositeSourceChannelKey?.getValue();
    expect(sourceKey).toBe('child');
  });

  it('delivers multiple matches in declared order', async () => {
    const processor = new CompositeTimelineChannelProcessor();
    const channelProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['childA', 'childB'],
    };

    const entries: ChannelContractEntry[] = [
      {
        key: 'childA',
        contract: { minDelta: 0 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
      {
        key: 'childB',
        contract: { minDelta: 0 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
    ];

    const result = await processor.evaluate(
      contract,
      baseContext({
        event: testEvent(7),
        resolveChannel: resolveFrom(entries),
        channelProcessorFor: (_node) => channelProcessor,
      }),
    );

    expect(result.matches).toBe(true);
    expect(result.deliveries ?? []).toHaveLength(2);

    const sourceKeys = (result.deliveries ?? []).map((delivery) =>
      delivery.eventNode
        .getProperties()
        ?.meta?.getProperties()
        ?.compositeSourceChannelKey?.getValue(),
    );
    expect(sourceKeys).toEqual(['childA', 'childB']);
  });

  it('uses child recency checks per checkpoint key', async () => {
    const processor = new CompositeTimelineChannelProcessor();
    const channelProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['childA', 'childB'],
    };

    const entries: ChannelContractEntry[] = [
      {
        key: 'childA',
        contract: { minDelta: 0 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
      {
        key: 'childB',
        contract: { minDelta: 5 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
    ];

    const compositeKey = 'compositeChannel';
    const checkpoint: ChannelEventCheckpoint = {
      lastEvents: {
        [compositeCheckpointKey(compositeKey, 'childA')]: testEvent(10),
        [compositeCheckpointKey(compositeKey, 'childB')]: testEvent(10),
      },
      lastSignatures: {},
    };
    const markers = new Map<string, MarkerContract>([
      [KEY_CHECKPOINT, checkpoint],
    ]);

    const result = await processor.evaluate(
      contract,
      baseContext({
        event: testEvent(12),
        resolveChannel: resolveFrom(entries),
        channelProcessorFor: (_node) => channelProcessor,
        markers,
        bindingKey: compositeKey,
      }),
    );

    expect(result.deliveries ?? []).toHaveLength(2);
    const shouldProcess = (result.deliveries ?? []).map(
      (delivery) => delivery.shouldProcess,
    );
    expect(shouldProcess).toEqual([true, false]);
  });

  it('respects inner composite recency when nested', async () => {
    const compositeProcessor = new CompositeTimelineChannelProcessor();
    const recencyProcessor = new RecencyTestChannelProcessor();
    const contract: CompositeTimelineChannel = {
      channels: ['innerComposite'],
    };

    const entries: ChannelContractEntry[] = [
      {
        key: 'innerComposite',
        contract: {
          channels: ['childA', 'childB'],
        } as CompositeTimelineChannel,
        blueId: conversationBlueIds['Conversation/Composite Timeline Channel'],
        node: channelNode(
          conversationBlueIds['Conversation/Composite Timeline Channel'],
        ),
      },
      {
        key: 'childA',
        contract: { minDelta: 5 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
      {
        key: 'childB',
        contract: { minDelta: 5 } as ChannelContract,
        blueId: 'RecencyTestChannel',
        node: channelNode('RecencyTestChannel'),
      },
    ];

    const compositeKey = 'outerComposite';
    const checkpoint: ChannelEventCheckpoint = {
      lastEvents: {
        [compositeCheckpointKey(compositeKey, 'innerComposite')]: testEvent(8),
        [compositeCheckpointKey('innerComposite', 'childA')]: testEvent(10),
        [compositeCheckpointKey('innerComposite', 'childB')]: testEvent(10),
      },
      lastSignatures: {},
    };
    const markers = new Map<string, MarkerContract>([
      [KEY_CHECKPOINT, checkpoint],
    ]);

    const result = await compositeProcessor.evaluate(
      contract,
      baseContext({
        event: testEvent(12),
        resolveChannel: resolveFrom(entries),
        channelProcessorFor: (node) => {
          const blueId = node.getType()?.getBlueId();
          if (
            blueId ===
            conversationBlueIds['Conversation/Composite Timeline Channel']
          ) {
            return compositeProcessor;
          }
          if (blueId === 'RecencyTestChannel') {
            return recencyProcessor;
          }
          return null;
        },
        markers,
        bindingKey: compositeKey,
      }),
    );

    expect(result.matches).toBe(true);
    expect(result.deliveries ?? []).toHaveLength(1);
    expect(result.deliveries?.[0]?.shouldProcess).toBe(false);
  });

  it('exposes composite source channel key to JS workflow steps', async () => {
    const processor = buildProcessor(blue, new TestEventChannelProcessor());

    const yaml = `name: Composite JS Workflow Doc
contracts:
  childA:
    type:
      blueId: TestEventChannel
    eventType: TestEvent
  childB:
    type:
      blueId: TestEventChannel
    eventType: TestEvent
  compositeChannel:
    type: Conversation/Composite Timeline Channel
    channels: [childA, childB]
  workflow:
    type: Conversation/Sequential Workflow
    channel: compositeChannel
    steps:
      - name: Branch
        type: Conversation/JavaScript Code
        code: |
          const raw = event.meta?.compositeSourceChannelKey;

          if (raw === 'childA') {
            return {
              events: [
                {
                  type: "Conversation/Chat Message",
                  message: "from childA"
                }
              ]
            };
          }
          if (raw === 'childB') {
            return {
              events: [
                {
                  type: "Conversation/Chat Message",
                  message: "from childB"
                }
              ]
            };
          }

          return {
            events: []
          };
`;

    const initialized = (
      await expectOk(processor.initializeDocument(blue.yamlToNode(yaml)))
    ).document;
    const event = blue.jsonValueToNode({
      type: { blueId: 'TestEvent' },
      kind: 'meta-check',
    });

    const result = await expectOk(
      processor.processDocument(initialized.clone(), event),
    );

    const messages = result.triggeredEvents
      .filter(
        (entry) =>
          typeBlueId(entry) ===
          conversationBlueIds['Conversation/Chat Message'],
      )
      .map((entry) => property(entry, 'message').getValue());

    expect(messages).toHaveLength(2);
    expect(messages).toEqual(
      expect.arrayContaining(['from childA', 'from childB']),
    );
  });
});
