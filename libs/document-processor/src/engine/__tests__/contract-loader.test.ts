import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BlueNode } from '@blue-labs/language';
import { blueIds as myosBlueIds } from '@blue-repository/types/packages/myos/blue-ids';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { ContractLoader } from '../contract-loader.js';
import { ContractProcessorRegistry } from '../../registry/contract-processor-registry.js';
import { ContractProcessorRegistryBuilder } from '../../registry/contract-processor-registry-builder.js';
import type { HandlerContract } from '../../model/index.js';
import type { HandlerProcessor } from '../../registry/index.js';
import { MustUnderstandFailure } from '../must-understand-failure.js';
import { ProcessorFatalError } from '../processor-fatal-error.js';
import type { InvalidContractError } from '../../types/errors.js';
import { blueIds, createBlue } from '../../test-support/blue.js';
import { createBlueWithDerivedTypes } from '../../__tests__/derived-blue-types.js';

const blueIdDocumentUpdate = blueIds['Core/Document Update Channel'];
const blueIdInitialization = blueIds['Core/Processing Initialized Marker'];
const blueIdProcessEmbedded = blueIds['Core/Process Embedded'];
const blueIdCheckpoint = blueIds['Core/Channel Event Checkpoint'];
const blueIdCompositeTimeline =
  conversationBlueIds['Conversation/Composite Timeline Channel'];
const blueIdActorPolicy = conversationBlueIds['Conversation/Actor Policy'];
const blueIdDocumentSection =
  conversationBlueIds['Conversation/Document Section'];
const blueIdContractsChangePolicy =
  conversationBlueIds['Conversation/Contracts Change Policy'];

function buildScopeNode(
  blue: ReturnType<typeof createBlue>,
  contracts: Record<string, unknown>,
): BlueNode {
  return blue.jsonValueToNode({ contracts });
}

function derivedActorPolicyTypeYaml(name: string): string {
  return `name: ${name}
type:
  blueId: ${blueIdActorPolicy}
`;
}

function captureProcessorFatalError(action: () => void): ProcessorFatalError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProcessorFatalError);
    return error as ProcessorFatalError;
  }

  throw new Error('Expected ProcessorFatalError');
}

function expectInvalidContractError(
  error: ProcessorFatalError,
): InvalidContractError {
  expect(error.processorError?.kind).toBe('InvalidContract');
  if (
    !error.processorError ||
    error.processorError.kind !== 'InvalidContract'
  ) {
    throw new Error('Expected InvalidContract processor error');
  }

  return error.processorError;
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
        type: { blueId: myosBlueIds['MyOS/Document Anchors'] },
        anchorAlpha: {
          type: { blueId: myosBlueIds['MyOS/Document Anchor'] },
          description: 'Primary anchor',
        },
      },
      links: {
        type: { blueId: myosBlueIds['MyOS/Document Links'] },
        outbound: {
          type: { blueId: myosBlueIds['MyOS/Document Link'] },
          anchor: 'anchorAlpha',
          documentId: 'doc-123',
        },
        linkAgent: {
          type: { blueId: myosBlueIds['MyOS/MyOS Session Link'] },
          anchor: 'anchorA',
          sessionId: 'session-abc',
        },
      },
      participants: {
        type: { blueId: myosBlueIds['MyOS/MyOS Participants Orchestration'] },
        name: 'Orchestration',
      },
      sessionInteraction: {
        type: { blueId: myosBlueIds['MyOS/MyOS Session Interaction'] },
        name: 'Session Interaction',
      },
      workerAgency: {
        type: { blueId: myosBlueIds['MyOS/MyOS Worker Agency'] },
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

  it('loads marker subtypes without explicit marker processors', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      section: {
        type: { blueId: blueIdDocumentSection },
      },
      policy: {
        type: { blueId: blueIdContractsChangePolicy },
      },
    });

    const bundle = loader.load(scopeNode, '/');

    expect(bundle.marker('section')).toBeDefined();
    expect(bundle.marker('policy')).toBeDefined();
  });

  it('loads Actor Policy markers with parsed operations', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicy: {
        type: { blueId: blueIdActorPolicy },
        operations: {
          authorizeFunds: {
            requiresActor: 'principal',
            requiresSource: 'browserSession',
          },
        },
      },
    });

    const bundle = loader.load(scopeNode, '/');

    expect(bundle.marker('actorPolicy')).toMatchObject({
      operations: {
        authorizeFunds: {
          requiresActor: 'principal',
          requiresSource: 'browserSession',
        },
      },
    });
  });

  it('loads derived Actor Policy markers with parsed operations', () => {
    const { blue, derivedBlueIds } = createBlueWithDerivedTypes([
      {
        name: 'Derived Actor Policy',
        yaml: derivedActorPolicyTypeYaml('Derived Actor Policy'),
      },
    ]);
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicy: {
        type: { blueId: derivedBlueIds['Derived Actor Policy'] },
        operations: {
          authorizeFunds: {
            requiresActor: 'principal',
            requiresSource: 'browserSession',
          },
        },
      },
    });

    const bundle = loader.load(scopeNode, '/');

    expect(bundle.marker('actorPolicy')).toMatchObject({
      operations: {
        authorizeFunds: {
          requiresActor: 'principal',
          requiresSource: 'browserSession',
        },
      },
    });
  });

  it('rejects duplicate Actor Policy markers in one scope', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicyA: {
        type: { blueId: blueIdActorPolicy },
      },
      actorPolicyB: {
        type: { blueId: blueIdActorPolicy },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(ProcessorFatalError);
  });

  it('rejects base and derived Actor Policy markers in one scope', () => {
    const { blue, derivedBlueIds } = createBlueWithDerivedTypes([
      {
        name: 'Derived Actor Policy',
        yaml: derivedActorPolicyTypeYaml('Derived Actor Policy'),
      },
    ]);
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicyBase: {
        type: { blueId: blueIdActorPolicy },
      },
      actorPolicyDerived: {
        type: { blueId: derivedBlueIds['Derived Actor Policy'] },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(
      /Multiple Actor Policy markers declared in the same scope/,
    );
  });

  it('rejects multiple derived Actor Policy markers in one scope', () => {
    const { blue, derivedBlueIds } = createBlueWithDerivedTypes([
      {
        name: 'Derived Actor Policy A',
        yaml: derivedActorPolicyTypeYaml('Derived Actor Policy A'),
      },
      {
        name: 'Derived Actor Policy B',
        yaml: derivedActorPolicyTypeYaml('Derived Actor Policy B'),
      },
    ]);
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicyA: {
        type: { blueId: derivedBlueIds['Derived Actor Policy A'] },
      },
      actorPolicyB: {
        type: { blueId: derivedBlueIds['Derived Actor Policy B'] },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(
      /Multiple Actor Policy markers declared in the same scope/,
    );
  });

  it('rejects Actor Policy markers with unsupported rule literals', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicy: {
        type: { blueId: blueIdActorPolicy },
        operations: {
          authorizeFunds: {
            requiresActor: 'robot',
          },
        },
      },
    });

    const error = captureProcessorFatalError(() => loader.load(scopeNode, '/'));
    const processorError = expectInvalidContractError(error);

    expect(error.message).toBe(
      "Actor Policy operation 'authorizeFunds' declares unsupported requiresActor 'robot'",
    );
    expect(processorError).toMatchObject({
      kind: 'InvalidContract',
      contractId: blueIdActorPolicy,
      pointer: 'actorPolicy',
      reason:
        "Actor Policy operation 'authorizeFunds' declares unsupported requiresActor 'robot'",
    });
    expect(processorError.details).toBeInstanceOf(Error);
  });

  it('rejects derived Actor Policy markers with unsupported rule literals as invalid contracts', () => {
    const { blue, derivedBlueIds } = createBlueWithDerivedTypes([
      {
        name: 'Derived Actor Policy',
        yaml: derivedActorPolicyTypeYaml('Derived Actor Policy'),
      },
    ]);
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      actorPolicy: {
        type: { blueId: derivedBlueIds['Derived Actor Policy'] },
        operations: {
          authorizeFunds: {
            requiresActor: 'robot',
          },
        },
      },
    });

    const error = captureProcessorFatalError(() => loader.load(scopeNode, '/'));
    const processorError = expectInvalidContractError(error);

    expect(error.message).toBe(
      "Actor Policy operation 'authorizeFunds' declares unsupported requiresActor 'robot'",
    );
    expect(processorError).toMatchObject({
      kind: 'InvalidContract',
      contractId: derivedBlueIds['Derived Actor Policy'],
      pointer: 'actorPolicy',
      reason:
        "Actor Policy operation 'authorizeFunds' declares unsupported requiresActor 'robot'",
    });
    expect(processorError.details).toBeInstanceOf(Error);
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

  it('returns capability failure for marker subtypes without marker processors', () => {
    const blue = createBlue();
    const loader = new ContractLoader(new ContractProcessorRegistry(), blue);
    const scopeNode = buildScopeNode(blue, {
      section: {
        type: { blueId: blueIdDocumentSection },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(
      MustUnderstandFailure,
    );
  });

  it('prefers dedicated marker processor schema over generic marker processor', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const markerSchema = z.union([z.string(), z.number()]);
    registry.registerMarker({
      kind: 'marker',
      blueIds: [blueIdDocumentSection],
      schema: markerSchema,
    });

    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      section: {
        type: { blueId: blueIdDocumentSection },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(ProcessorFatalError);
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

  it('rejects composite channels that reference themselves', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      compositeA: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [{ value: 'compositeA' }],
        },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(/cyclic/i);
  });

  it('rejects composite channels that create a cycle', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      compositeA: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [{ value: 'compositeB' }],
        },
      },
      compositeB: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [{ value: 'compositeA' }],
        },
      },
    });

    expect(() => loader.load(scopeNode, '/')).toThrowError(/cyclic/i);
  });

  it('loads composite channels with acyclic references', () => {
    const blue = createBlue();
    const registry = ContractProcessorRegistryBuilder.create()
      .registerDefaults()
      .build();
    const loader = new ContractLoader(registry, blue);
    const scopeNode = buildScopeNode(blue, {
      compositeA: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [{ value: 'compositeB' }],
        },
      },
      compositeB: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [{ value: 'compositeC' }],
        },
      },
      compositeC: {
        type: { blueId: blueIdCompositeTimeline },
        channels: {
          items: [],
        },
      },
    });

    expect(() => loader.load(scopeNode, '/')).not.toThrow();
  });
});
