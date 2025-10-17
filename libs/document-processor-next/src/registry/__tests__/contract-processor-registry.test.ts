import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  ContractProcessorRegistry,
  ContractProcessorRegistryBuilder,
  HandlerProcessor,
  ChannelProcessor,
  MarkerProcessor,
} from '../index.js';

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
  eventId: vi.fn().mockReturnValue('event-1'),
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
});
