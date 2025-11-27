import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BlueNode } from '@blue-labs/language';
import { blueIds as myosBlueIds } from '@blue-repository/myos';

import { ContractLoader } from '../contract-loader.js';
import { ContractProcessorRegistry } from '../../registry/contract-processor-registry.js';
import type { HandlerContract } from '../../model/index.js';
import type { HandlerProcessor } from '../../registry/index.js';
import { MustUnderstandFailure } from '../must-understand-failure.js';
import { ProcessorFatalError } from '../processor-fatal-error.js';
import { blueIds, createBlue } from '../../test-support/blue.js';

const blueIdDocumentUpdate = blueIds['Document Update Channel'];
const blueIdInitialization = blueIds['Processing Initialized Marker'];
const blueIdProcessEmbedded = blueIds['Process Embedded'];
const blueIdCheckpoint = blueIds['Channel Event Checkpoint'];

function buildScopeNode(
  blue: ReturnType<typeof createBlue>,
  contracts: Record<string, unknown>,
): BlueNode {
  return blue.jsonValueToNode({ contracts });
}

describe('ContractLoader', () => {
  it('loads built-in contracts without registry processors', () => {
    const blue = createBlue();
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

    const bundle = loader.load(scopeNode, '/');

    const channels = bundle.channelsOfType(blueIdDocumentUpdate);
    expect(channels).toHaveLength(1);
    expect(channels[0].key()).toBe('update');
    expect(channels[0].contract()).toMatchObject({
      path: '/document',
    });

    expect(bundle.embeddedPaths()).toEqual(['/children']);

    const initMarker = bundle.marker('init');
    expect(initMarker).toMatchObject({ documentId: 'doc-123' });
    expect(bundle.hasCheckpoint()).toBe(true);
  });

  it('returns capability failure when encountering unsupported contracts', () => {
    const blue = createBlue();
    const loader = new ContractLoader(new ContractProcessorRegistry(), blue);
    const scopeNode = buildScopeNode(blue, {
      unsupported: {
        type: { blueId: 'Custom.Channel' },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(
      MustUnderstandFailure,
    );
  });

  it('loads built-in MyOS marker contracts', () => {
    const blue = createBlue();
    const registry = new ContractProcessorRegistry();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      anchors: {
        type: { blueId: myosBlueIds['Document Anchors'] },
        anchorAlpha: {
          type: { blueId: myosBlueIds['Document Anchor'] },
          description: 'Primary anchor',
        },
      },
      links: {
        type: { blueId: myosBlueIds['Document Links'] },
        outbound: {
          type: { blueId: myosBlueIds['Document Link'] },
          anchor: 'anchorAlpha',
          documentId: 'doc-123',
        },
        linkAgent: {
          type: { blueId: myosBlueIds['MyOS Session Link'] },
          anchor: 'anchorA',
          sessionId: 'session-abc',
        },
      },
      participants: {
        type: { blueId: myosBlueIds['MyOS Participants Orchestration'] },
        name: 'Orchestration',
      },
      sessionInteraction: {
        type: { blueId: myosBlueIds['MyOS Session Interaction'] },
        name: 'Session Interaction',
      },
      workerAgency: {
        type: { blueId: myosBlueIds['MyOS Worker Agency'] },
        name: 'Worker Agency',
      },
    });

    const bundle = loader.load(scopeNode, '/');

    expect(bundle.marker('anchors')).toBeDefined();
    expect(bundle.marker('links')).toBeDefined();
    expect(bundle.marker('participants')).toBeDefined();
    expect(bundle.marker('sessionInteraction')).toBeDefined();
    expect(bundle.marker('workerAgency')).toBeDefined();
  });

  it('loads custom handler contracts using registry schema', () => {
    const blue = createBlue();
    const registry = new ContractProcessorRegistry();
    const handlerSchema = z.object({
      channel: z.string(),
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
      main: {
        type: { blueId: blueIdDocumentUpdate },
        path: { value: '/document' },
      },
      handler: {
        type: { blueId: 'Custom.Handler' },
        channel: { value: 'main' },
      },
    });

    const bundle = loader.load(scopeNode, '/');

    const handlers = bundle.handlersFor('main');
    expect(handlers).toHaveLength(1);
    expect(handlers[0].key()).toBe('handler');
  });

  it('surfaces illegal state when handler omits channel key', () => {
    const blue = createBlue();
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

    expect(() => loader.load(scopeNode, '/')).toThrowError(ProcessorFatalError);
  });

  it('rejects checkpoint markers that use incorrect keys', () => {
    const blue = createBlue();
    const loader = new ContractLoader(new ContractProcessorRegistry(), blue);
    const scopeNode = buildScopeNode(blue, {
      wrongCheckpoint: {
        type: { blueId: blueIdCheckpoint },
        lastEvents: {},
        lastSignatures: {},
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(ProcessorFatalError);
  });
});
