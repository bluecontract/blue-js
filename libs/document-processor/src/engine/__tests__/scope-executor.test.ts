import { blueIds, createBlue } from '../../test-support/blue.js';
import { describe, expect, it, vi } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { ScopeExecutor } from '../scope-executor.js';
import { ContractBundle } from '../contract-bundle.js';
import type { ContractLoader } from '../contract-loader.js';
import type { ChannelRunner } from '../channel-runner.js';
import type { ChannelContract, LifecycleChannel } from '../../model/index.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { resolvePointer } from '../../util/pointer-utils.js';

const blue = createBlue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
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
      blueIds['Lifecycle Event Channel'],
    )
    .build();
}

function externalBundle(): ContractBundle {
  return ContractBundle.builder()
    .addChannel(
      'external',
      { order: 0, path: '/events' } as ChannelContract,
      'ExternalChannel',
    )
    .build();
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

function createExecutor(bundle: ContractBundle): ExecutorFixture {
  const runtime = new DocumentProcessingRuntime(new BlueNode(), blue);
  const bundles = new Map<string, ContractBundle>();
  const loader = {
    load: vi.fn(() => bundle),
  } as unknown as ContractLoader;

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
      nodeFrom({ scopePath, path: data.path }),
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
});
