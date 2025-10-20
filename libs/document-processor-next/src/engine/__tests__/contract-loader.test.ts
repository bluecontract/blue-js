import { describe, expect, it } from 'vitest';
import { Blue } from '@blue-labs/language';
import { z } from 'zod';

import { ContractLoader } from '../contract-loader.js';
import { ContractProcessorRegistry } from '../../registry/contract-processor-registry.js';
import type { Node } from '../../types/index.js';
import type { HandlerContract } from '../../model/index.js';
import type { HandlerProcessor } from '../../registry/index.js';

const blueIdDocumentUpdate = 'DocumentUpdateChannel';
const blueIdInitialization = 'InitializationMarker';
const blueIdProcessEmbedded = 'ProcessEmbedded';
const blueIdCheckpoint = 'ChannelEventCheckpoint';

function buildScopeNode(blue: Blue, contracts: Record<string, unknown>): Node {
  return blue.jsonValueToNode({ contracts });
}

describe('ContractLoader', () => {
  it('loads built-in contracts without registry processors', () => {
    const blue = new Blue();
    const registry = new ContractProcessorRegistry();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      update: {
        type: { blueId: blueIdDocumentUpdate },
        path: { value: '/document' },
      },
      embedded: {
        type: { blueId: blueIdProcessEmbedded },
        paths: {
          items: [{ value: '/children' }],
        },
      },
      init: {
        type: { blueId: blueIdInitialization },
        documentId: { value: 'doc-123' },
      },
      checkpoint: {
        type: { blueId: blueIdCheckpoint },
        lastEvents: {},
        lastSignatures: {},
      },
    });

    const result = loader.load(scopeNode, '/');

    expect(result.ok).toBe(true);
    if (!result.ok) return; // type guard for TS
    const bundle = result.value;

    const channels = bundle.channelsOfType(blueIdDocumentUpdate);
    expect(channels).toHaveLength(1);
    expect(channels[0].contract()).toMatchObject({ path: '/document', key: 'update' });

    expect(bundle.embeddedPaths()).toEqual(['/children']);

    const initMarker = bundle.marker('init');
    expect(initMarker).toMatchObject({ documentId: 'doc-123' });
    expect(bundle.hasCheckpoint()).toBe(true);
  });

  it('returns capability failure when encountering unsupported contracts', () => {
    const blue = new Blue();
    const loader = new ContractLoader(new ContractProcessorRegistry(), blue);
    const scopeNode = buildScopeNode(blue, {
      unsupported: {
        type: { blueId: 'Custom.Channel' },
      },
    });

    const result = loader.load(scopeNode, '/');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('CapabilityFailure');
  });

  it('loads custom handler contracts using registry schema', () => {
    const blue = new Blue();
    const registry = new ContractProcessorRegistry();
    const handlerSchema = z.object({
      channelKey: z.string(),
      config: z.string().optional(),
    });
    const handlerProcessor: HandlerProcessor<HandlerContract> = {
      kind: 'handler',
      blueIds: ['Custom.Handler'],
      schema: handlerSchema as z.ZodType<HandlerContract>,
      execute: (contract, context) => {
        void contract;
        void context;
      },
    };
    registry.registerHandler(handlerProcessor);

    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      handler: {
        type: { blueId: 'Custom.Handler' },
        channelKey: { value: 'main' },
      },
    });

    const result = loader.load(scopeNode, '/');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bundle = result.value;

    const handlers = bundle.handlersFor('main');
    expect(handlers).toHaveLength(1);
    expect(handlers[0].contract()).toMatchObject({ key: 'handler' });
  });

  it('surfaces illegal state when handler omits channel key', () => {
    const blue = new Blue();
    const registry = new ContractProcessorRegistry();
    const handlerSchema = z.object({ order: z.number().optional() });
    const handlerProcessor: HandlerProcessor<HandlerContract> = {
      kind: 'handler',
      blueIds: ['Custom.Handler'],
      schema: handlerSchema as z.ZodType<HandlerContract>,
      execute: (contract, context) => {
        void contract;
        void context;
      },
    };
    registry.register(handlerProcessor);

    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      badHandler: {
        type: { blueId: 'Custom.Handler' },
      },
    });

    const result = loader.load(scopeNode, '/');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('IllegalState');
  });

  it('rejects checkpoint markers that use incorrect keys', () => {
    const blue = new Blue();
    const loader = new ContractLoader(new ContractProcessorRegistry(), blue);
    const scopeNode = buildScopeNode(blue, {
      wrongCheckpoint: {
        type: { blueId: blueIdCheckpoint },
        lastEvents: {},
        lastSignatures: {},
      },
    });

    const result = loader.load(scopeNode, '/');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('IllegalState');
  });
});
