import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { createBlue } from '../../test-support/blue.js';
import {
  ContractProcessorRegistry,
  ContractProcessorRegistryBuilder,
  HandlerProcessor,
  ChannelProcessor,
  MarkerProcessor,
} from '../index.js';
import { TimelineChannelProcessor } from '../processors/timeline-channel-processor.js';

const handlerSchema = z.object({ name: z.string() });
const handler: HandlerProcessor<{ readonly name: string }> = {
  kind: 'handler',
  blueIds: ['Handler.Contracts.Test'],
  schema: handlerSchema,
  execute: vi.fn(),
};

const channelSchema = z.object({ name: z.string() });
const channel: ChannelProcessor<{ readonly name: string }> = {
  kind: 'channel',
  blueIds: ['Channel.Contracts.Test'],
  schema: channelSchema,
  matches: vi.fn().mockReturnValue(true),
};

const markerSchema = z.object({ name: z.string() });
const marker: MarkerProcessor<{ readonly name: string }> = {
  kind: 'marker',
  blueIds: ['Marker.Contracts.Test'],
  schema: markerSchema,
};

describe('ContractProcessorRegistry', () => {
  it('registers processors by explicit role helpers', () => {
    const registry = new ContractProcessorRegistry();

    registry.registerHandler(handler);
    registry.registerChannel(channel);
    registry.registerMarker(marker);

    expect(registry.lookupHandler('Handler.Contracts.Test')).toBe(handler);
    expect(registry.lookupChannel('Channel.Contracts.Test')).toBe(channel);
    expect(registry.lookupMarker('Marker.Contracts.Test')).toBe(marker);
  });

  it('registers via generic register dispatch', () => {
    const registry = new ContractProcessorRegistry();

    registry.register(channel);

    expect(registry.lookupChannel('Channel.Contracts.Test')).toBe(channel);
  });

  it('maintains a read-only snapshot of processors map', () => {
    const registry = new ContractProcessorRegistry();
    registry.registerHandler(handler);

    const processors = registry.processors();
    expect(processors.get('Handler.Contracts.Test')).toBe(handler);

    processors.set('Handler.Contracts.Test', marker); // mutate copy
    expect(registry.lookupHandler('Handler.Contracts.Test')).toBe(handler);
  });

  it('resolves derived channel processors by schema extension', () => {
    const blue = createBlue();
    const registry = new ContractProcessorRegistry();
    const timelineProcessor = new TimelineChannelProcessor();

    registry.registerChannel(timelineProcessor);

    const derivedNode = blue.yamlToNode('type: MyOS/MyOS Timeline Channel');
    const resolved = registry.lookupChannelForNode(blue, derivedNode);

    expect(resolved).toBe(timelineProcessor);
  });

  it('resolves marker subtypes from a generic marker processor', () => {
    const blue = createBlue();
    const registry = new ContractProcessorRegistry();
    const genericMarker: MarkerProcessor<object> = {
      kind: 'marker',
      blueIds: [coreBlueIds['Core/Marker']],
      schema: z.object({}),
    };
    registry.registerMarker(genericMarker);

    const derivedNode = blue.yamlToNode('type: Conversation/Document Section');
    const resolved = registry.lookupMarkerForNode(blue, derivedNode);

    expect(resolved).toBe(genericMarker);
  });

  it('prefers specific marker processor over generic marker processor', () => {
    const blue = createBlue();
    const registry = new ContractProcessorRegistry();
    const genericMarker: MarkerProcessor<object> = {
      kind: 'marker',
      blueIds: [coreBlueIds['Core/Marker']],
      schema: z.object({}),
    };
    const specificMarker: MarkerProcessor<object> = {
      kind: 'marker',
      blueIds: [conversationBlueIds['Conversation/Document Section']],
      schema: z.object({}),
    };

    registry.registerMarker(genericMarker);
    registry.registerMarker(specificMarker);

    const derivedNode = blue.yamlToNode('type: Conversation/Document Section');
    const resolved = registry.lookupMarkerForNode(blue, derivedNode);

    expect(resolved).toBe(specificMarker);
  });

  it('throws when processors lack BlueIds', () => {
    const registry = new ContractProcessorRegistry();
    const badProcessor: MarkerProcessor<unknown> = {
      kind: 'marker',
      blueIds: [],
      schema: z.any(),
    };

    expect(() => registry.register(badProcessor)).toThrow(/BlueId/);
  });
});

describe('ContractProcessorRegistryBuilder', () => {
  it('builds a registry with registered processors', () => {
    const registry = ContractProcessorRegistryBuilder.create()
      .register(marker)
      .build();

    expect(registry.lookupMarker('Marker.Contracts.Test')).toBe(marker);
  });

  it('registerDefaults registers generic marker processor', () => {
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();

    expect(registry.lookupMarker(coreBlueIds['Core/Marker'])).toBeDefined();
  });
});
