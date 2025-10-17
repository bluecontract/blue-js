import { describe, expect, it, vi } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import { ScopeExecutor } from '../scope-executor.js';
import { ContractBundle } from '../contract-bundle.js';
import type { ContractLoader } from '../contract-loader.js';
import type { ChannelRunner } from '../channel-runner.js';
import type { ChannelContract, LifecycleChannel } from '../../model/index.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { resolvePointer } from '../../util/pointer-utils.js';

const blue = new Blue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

function getNode(runtime: DocumentProcessingRuntime, path: string): BlueNode | null {
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
      { key: 'lifecycle', order: 0 } as LifecycleChannel,
      'LifecycleChannel',
    )
    .build();
}

function externalBundle(): ContractBundle {
  return ContractBundle.builder()
    .addChannel(
      'external',
      { key: 'external', order: 0, path: '/events' } as ChannelContract,
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
  const runtime = new DocumentProcessingRuntime(new BlueNode());
  const bundles = new Map<string, ContractBundle>();
  const loader = {
    load: vi.fn(() => bundle),
  } as unknown as ContractLoader;

  const channelRunner = {
    runExternalChannel: vi.fn(),
    runHandlers: vi.fn(),
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
        resolvePointer: (relative: string) => resolvePointer(scopePath, relative),
        applyPatch: (patch: JsonPatch) => {
          if (patch.op === 'ADD' || patch.op === 'REPLACE') {
            runtime.directWrite(patch.path, patch.val ?? null);
          } else if (patch.op === 'REMOVE') {
            runtime.directWrite(patch.path, null);
          }
        },
      }),
    ),
    recordLifecycleForBridging: vi.fn(),
    enterFatalTermination: vi.fn(),
    fatalReason: vi.fn((_error: unknown, label: string) => label),
    markCutOff: vi.fn(),
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
    hooks: hooks as ExecutorFixture['hooks'],
  };
}

describe('ScopeExecutor', () => {
  it('initializes scope and records lifecycle marker', () => {
    const { executor, runtime, channelRunner, hooks } = createExecutor(
      lifecycleBundle(),
    );

    executor.initializeScope('/', true);

    expect(hooks.recordLifecycleForBridging).toHaveBeenCalledWith(
      '/',
      expect.any(BlueNode),
    );
    expect(channelRunner.runHandlers).toHaveBeenCalledWith(
      '/',
      expect.any(ContractBundle),
      'lifecycle',
      expect.any(BlueNode),
      true,
    );
    const marker = runtime.document().get('/contracts/initialized');
    expect(marker).toBeInstanceOf(BlueNode);
  });

  it('processes external events via channel runner', () => {
    const { executor, channelRunner } = createExecutor(externalBundle());
    const event = nodeFrom({ eventType: 'Event' });

    executor.processExternalEvent('/', event);

    expect(channelRunner.runExternalChannel).toHaveBeenCalledWith(
      '/',
      expect.any(ContractBundle),
      expect.any(Object),
      event,
    );
  });

  it('enters fatal termination when patch violates boundary', () => {
    const bundle = ContractBundle.builder().build();
    const { executor, hooks } = createExecutor(bundle);
    const patch: JsonPatch = {
      op: 'ADD',
      path: '/outside',
      val: nodeFrom('value'),
    };

    executor.handlePatch('/child', bundle, patch, false);

    expect(hooks.enterFatalTermination).toHaveBeenCalled();
  });
});
