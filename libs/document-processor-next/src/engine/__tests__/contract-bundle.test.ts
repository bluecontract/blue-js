import { describe, expect, it } from 'vitest';
import { blueIds } from '../../test-support/blue.js';

import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';
import type {
  ChannelContract,
  HandlerContract,
  ProcessEmbeddedMarker,
  ChannelEventCheckpoint,
} from '../../model/index.js';
import { ContractBundle } from '../contract-bundle.js';

const channelBlueId = 'TestChannel';
const handlerBlueId = 'TestHandler';

const baseChannel = (order: number, path: string): ChannelContract =>
  ({ order, path }) as ChannelContract;

const baseHandler = (channel: string, order: number): HandlerContract =>
  ({ channel, order }) as HandlerContract;

const processEmbeddedMarker = (
  paths: readonly string[],
): ProcessEmbeddedMarker => ({ paths }) as ProcessEmbeddedMarker;

const checkpointMarker = (): ChannelEventCheckpoint =>
  ({ lastEvents: {}, lastSignatures: {} }) as ChannelEventCheckpoint;

describe('ContractBundle', () => {
  it('sorts channels by order then key', () => {
    const bundle = ContractBundle.builder()
      .addChannel('b', baseChannel(2, '/b'), channelBlueId)
      .addChannel('a', baseChannel(1, '/a'), channelBlueId)
      .addChannel('c', baseChannel(1, '/c'), channelBlueId)
      .build();

    const channels = bundle.channelsOfType(channelBlueId);

    expect(channels.map((binding) => binding.key())).toEqual(['a', 'c', 'b']);
  });

  it('filters channels by BlueId when requested', () => {
    const bundle = ContractBundle.builder()
      .addChannel('alpha', baseChannel(0, '/a'), 'A')
      .addChannel('beta', baseChannel(0, '/b'), 'B')
      .build();

    expect(bundle.channelsOfType('B').map((binding) => binding.key())).toEqual([
      'beta',
    ]);
  });

  it('groups handlers by channel key and sorts consistently', () => {
    const bundle = ContractBundle.builder()
      .addHandler('h2', baseHandler('channel-1', 2), handlerBlueId)
      .addHandler('h1', baseHandler('channel-1', 1), handlerBlueId)
      .addHandler('h3', baseHandler('channel-2', 1), handlerBlueId)
      .build();

    const handlers = bundle.handlersFor('channel-1');

    expect(handlers.map((binding) => binding.key())).toEqual(['h1', 'h2']);
    expect(
      bundle.handlersFor('channel-2').map((binding) => binding.key()),
    ).toEqual(['h3']);
  });

  it('tracks embedded paths and prevents duplicates', () => {
    const builder = ContractBundle.builder();
    builder.setEmbedded(processEmbeddedMarker(['/child']));
    const bundle = builder.build();

    expect(bundle.embeddedPaths()).toEqual(['/child']);
    expect(() =>
      builder.setEmbedded(processEmbeddedMarker(['/other'])),
    ).toThrow(/Multiple Process Embedded markers/);
  });

  it('validates checkpoint markers for reserved key', () => {
    const builder = ContractBundle.builder();
    const checkpointId = blueIds['Channel Event Checkpoint'];
    expect(() =>
      builder.addMarker('custom', checkpointMarker(), checkpointId),
    ).toThrow(/reserved key 'checkpoint'/i);

    builder.addMarker(KEY_CHECKPOINT, checkpointMarker(), checkpointId);
    expect(() =>
      builder.addMarker(KEY_CHECKPOINT, checkpointMarker(), checkpointId),
    ).toThrow(/Duplicate Channel Event Checkpoint/);

    const bundle = builder.build();
    expect(bundle.hasCheckpoint()).toBe(true);
  });

  it('registers checkpoint marker post-build', () => {
    const bundle = ContractBundle.builder().build();

    bundle.registerCheckpointMarker(checkpointMarker());

    expect(bundle.hasCheckpoint()).toBe(true);
    expect(bundle.marker(KEY_CHECKPOINT)).toBeDefined();
  });
});
