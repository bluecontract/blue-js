import type { JsonValue } from '@blue-labs/shared-utils';
import { repository as blueRepository } from '@blue-repository/types';
import {
  Blue,
  BlueIdCalculator,
  BlueNode,
  type BlueRepository,
} from '@blue-labs/language';
import { describe, expect, it, vi } from 'vitest';

import { createDefaultMergingProcessor } from '../../merge/utils/default.js';
import { blueIds, createBlue } from '../../test-support/blue.js';

import { ScopeExecutor } from '../scope-executor.js';
import { ContractBundle } from '../contract-bundle.js';
import { ContractLoader } from '../contract-loader.js';
import type { ChannelRunner } from '../channel-runner.js';
import type { ChannelContract, LifecycleChannel } from '../../model/index.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { resolvePointer } from '../../util/pointer-utils.js';
import { ContractProcessorRegistry } from '../../registry/contract-processor-registry.js';

const blue = createBlue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

function channelNode(blueId: string): BlueNode {
  return new BlueNode().setType(new BlueNode().setBlueId(blueId));
}

function getNode(
  runtime: DocumentProcessingRuntime,
  path: string,
): BlueNode | null {
  if (path === '/') {
    return runtime.document() as BlueNode;
  }
  const value = runtime.document().get(path);
  return value instanceof BlueNode ? value : null;
}

function lifecycleBundle(): ContractBundle {
  return ContractBundle.builder()
    .addChannel(
      'lifecycle',
      { order: 0 } as LifecycleChannel,
      blueIds['Core/Lifecycle Event Channel'],
      channelNode(blueIds['Core/Lifecycle Event Channel']),
    )
    .build();
}

function externalBundle(): ContractBundle {
  return ContractBundle.builder()
    .addChannel(
      'external',
      { order: 0, path: '/events' } as ChannelContract,
      'ExternalChannel',
      channelNode('ExternalChannel'),
    )
    .build();
}

function derivedTypeYaml(name: string, baseBlueId: string): string {
  return `name: ${name}
type:
  blueId: ${baseBlueId}
`;
}

function createDerivedBlue(
  definitions: Array<{ name: string; yaml: string }>,
): { blue: Blue; derivedBlueIds: Record<string, string> } {
  const seedBlue = new Blue({
    repositories: [blueRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });

  const types = definitions.map(({ name, yaml }) => {
    const node = seedBlue.yamlToNode(yaml);
    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    return { name, blueId, json: seedBlue.nodeToJson(node) };
  });

  const derivedRepository = buildTestRepository(types);
  const blue = new Blue({
    repositories: [blueRepository, derivedRepository],
    mergingProcessor: createDefaultMergingProcessor(),
  });

  for (const { name, blueId } of types) {
    blue.registerBlueIds({ [name]: blueId });
  }

  return {
    blue,
    derivedBlueIds: Object.fromEntries(
      types.map(({ name, blueId }) => [name, blueId]),
    ),
  };
}

function buildTestRepository(
  types: Array<{ name: string; blueId: string; json: JsonValue }>,
): BlueRepository {
  const typesMeta = Object.fromEntries(
    types.map(({ name, blueId }) => [
      blueId,
      {
        status: 'stable' as const,
        name,
        versions: [
          {
            repositoryVersionIndex: 0,
            typeBlueId: blueId,
            attributesAdded: [],
          },
        ],
      },
    ]),
  );

  const contents = Object.fromEntries(
    types.map(({ blueId, json }) => [blueId, json]),
  );

  return {
    name: 'test.derived.repo',
    repositoryVersions: ['R0'],
    packages: {
      derived: {
        name: 'derived',
        aliases: {},
        typesMeta,
        contents,
        schemas: {},
      },
    },
  };
}

interface ExecutorFixture {
  executor: ScopeExecutor;
  runtime: DocumentProcessingRuntime;
  bundles: Map<string, ContractBundle>;
  loader: ContractLoader;
  channelRunner: ChannelRunner;
  channelRunnerMocks: {
    runExternalChannel: ReturnType<typeof vi.fn>;
    runHandlers: ReturnType<typeof vi.fn>;
  };
  hooks: {
    isScopeInactive: ReturnType<typeof vi.fn>;
    createContext: ReturnType<typeof vi.fn>;
    recordLifecycleForBridging: ReturnType<typeof vi.fn>;
    enterFatalTermination: ReturnType<typeof vi.fn>;
    fatalReason: ReturnType<typeof vi.fn>;
    markCutOff: ReturnType<typeof vi.fn>;
  };
}

function buildExecutor(
  runtime: DocumentProcessingRuntime,
  loader: ContractLoader,
  blueInstance: Blue,
): ExecutorFixture {
  const bundles = new Map<string, ContractBundle>();
  const runExternalChannel = vi.fn().mockResolvedValue(undefined);
  const runHandlers = vi.fn().mockResolvedValue(undefined);
  const channelRunner = {
    runExternalChannel,
    runHandlers,
  } as unknown as ChannelRunner;

  const hooks = {
    isScopeInactive: vi.fn().mockReturnValue(false),
    createContext: vi.fn(
      (
        scopePath: string,
        _bundle: ContractBundle,
        _event: BlueNode,
        _allowTerminatedWork: boolean,
      ) => ({
        resolvePointer: (relative: string) =>
          resolvePointer(scopePath, relative),
        applyPatch: async (patch: JsonPatch) => {
          if (patch.op === 'ADD' || patch.op === 'REPLACE') {
            runtime.directWrite(patch.path, patch.val ?? null);
          } else if (patch.op === 'REMOVE') {
            runtime.directWrite(patch.path, null);
          }
        },
      }),
    ),
    recordLifecycleForBridging: vi.fn().mockResolvedValue(undefined),
    enterFatalTermination: vi.fn().mockResolvedValue(undefined),
    fatalReason: vi.fn((_error: unknown, label: string) => label),
    markCutOff: vi.fn().mockResolvedValue(undefined),
  };

  const executor = new ScopeExecutor({
    runtime,
    contractLoader: loader,
    channelRunner,
    bundles,
    hooks,
    blueId: () => 'doc-id',
    nodeAt: (scopePath) => getNode(runtime, scopePath),
    createDocumentUpdateEvent: (data, scopePath) =>
      blueInstance.jsonValueToNode({ scopePath, path: data.path }),
    matchesDocumentUpdate: (_scopePath, watchPath, changedPath) => {
      if (!watchPath) {
        return true;
      }
      const resolved = resolvePointer(_scopePath, watchPath);
      return changedPath === resolved || changedPath.startsWith(`${resolved}/`);
    },
  });

  return {
    executor,
    runtime,
    bundles,
    loader,
    channelRunner,
    channelRunnerMocks: {
      runExternalChannel,
      runHandlers,
    },
    hooks: hooks as ExecutorFixture['hooks'],
  };
}

function createExecutor(
  bundle: ContractBundle,
  blueInstance: Blue = blue,
): ExecutorFixture {
  const runtime = new DocumentProcessingRuntime(new BlueNode(), blueInstance);
  const loader = {
    load: vi.fn(() => bundle),
  } as unknown as ContractLoader;
  return buildExecutor(runtime, loader, blueInstance);
}

function createExecutorFromDocument(
  documentYaml: string,
  blueInstance: Blue,
): ExecutorFixture {
  const document = blueInstance.yamlToNode(documentYaml);
  const runtime = new DocumentProcessingRuntime(document, blueInstance);
  const registry = new ContractProcessorRegistry();
  const loader = new ContractLoader(registry, blueInstance);
  return buildExecutor(runtime, loader, blueInstance);
}

describe('ScopeExecutor', () => {
  it('initializes scope and records lifecycle marker', async () => {
    const { executor, runtime, channelRunnerMocks, hooks } =
      createExecutor(lifecycleBundle());

    await executor.initializeScope('/', true);

    expect(hooks.recordLifecycleForBridging).toHaveBeenCalledWith(
      '/',
      expect.any(BlueNode),
    );
    expect(channelRunnerMocks.runHandlers).toHaveBeenCalledWith(
      '/',
      expect.any(ContractBundle),
      'lifecycle',
      expect.any(BlueNode),
      true,
    );
    const marker = runtime.document().get('/contracts/initialized');
    expect(marker).toBeInstanceOf(BlueNode);
  });

  it('processes external events via channel runner', async () => {
    const { executor, channelRunnerMocks } = createExecutor(externalBundle());
    const event = nodeFrom({ eventType: 'Event' });

    await executor.processExternalEvent('/', event);

    expect(channelRunnerMocks.runExternalChannel).toHaveBeenCalled();
    const [scopePath, bundleArg, channelBinding, passedEvent] =
      channelRunnerMocks.runExternalChannel.mock.calls[0];
    expect(scopePath).toBe('/');
    expect(bundleArg).toBeInstanceOf(ContractBundle);
    expect(channelBinding.key()).toBe('external');
    expect(passedEvent).not.toBe(event);
    expect(passedEvent).toBeInstanceOf(BlueNode);
    expect(passedEvent.isResolved()).toBe(true);
  });

  it('enters fatal termination when patch violates boundary', async () => {
    const bundle = ContractBundle.builder().build();
    const { executor, hooks } = createExecutor(bundle);
    const patch: JsonPatch = {
      op: 'ADD',
      path: '/outside',
      val: nodeFrom('value'),
    };

    await executor.handlePatch('/child', bundle, patch, false);

    expect(hooks.enterFatalTermination).toHaveBeenCalled();
  });

  it('skips derived processor-managed channels for external events', async () => {
    const derivedName = 'Derived Document Update Channel';
    const { blue: derivedBlue } = createDerivedBlue([
      {
        name: derivedName,
        yaml: derivedTypeYaml(
          derivedName,
          blueIds['Core/Document Update Channel'],
        ),
      },
    ]);

    const documentYaml = `name: Derived Update Doc
contracts:
  update:
    type: ${derivedName}
    order: 0
    path: /changes
`;

    const { executor, channelRunnerMocks } = createExecutorFromDocument(
      documentYaml,
      derivedBlue,
    );

    await executor.processExternalEvent(
      '/',
      derivedBlue.jsonValueToNode({ eventType: 'Event' }),
    );

    expect(channelRunnerMocks.runExternalChannel).not.toHaveBeenCalled();
  });

  it('runs lifecycle handlers for derived lifecycle channels', async () => {
    const derivedName = 'Derived Lifecycle Event Channel';
    const { blue: derivedBlue } = createDerivedBlue([
      {
        name: derivedName,
        yaml: derivedTypeYaml(
          derivedName,
          blueIds['Core/Lifecycle Event Channel'],
        ),
      },
    ]);

    const documentYaml = `name: Derived Lifecycle Doc
contracts:
  lifecycle:
    type: ${derivedName}
    order: 0
`;

    const { executor, channelRunnerMocks } = createExecutorFromDocument(
      documentYaml,
      derivedBlue,
    );

    await executor.initializeScope('/', true);

    expect(channelRunnerMocks.runHandlers).toHaveBeenCalledWith(
      '/',
      expect.any(ContractBundle),
      'lifecycle',
      expect.any(BlueNode),
      true,
    );
  });

  it('routes document update patches to derived update channels', async () => {
    const derivedName = 'Derived Document Update Channel';
    const { blue: derivedBlue } = createDerivedBlue([
      {
        name: derivedName,
        yaml: derivedTypeYaml(
          derivedName,
          blueIds['Core/Document Update Channel'],
        ),
      },
    ]);

    const documentYaml = `name: Derived Update Doc
contracts:
  updates:
    type: ${derivedName}
    order: 0
    path: /foo
`;

    const { executor, bundles, channelRunnerMocks } =
      createExecutorFromDocument(documentYaml, derivedBlue);
    executor.loadBundles('/');
    const bundle = bundles.get('/');
    expect(bundle).toBeInstanceOf(ContractBundle);

    const patch: JsonPatch = {
      op: 'ADD',
      path: '/foo',
      val: derivedBlue.jsonValueToNode('value'),
    };

    await executor.handlePatch('/', bundle as ContractBundle, patch, false);

    expect(channelRunnerMocks.runHandlers).toHaveBeenCalledWith(
      '/',
      bundle,
      'updates',
      expect.any(BlueNode),
      false,
    );
  });
});
