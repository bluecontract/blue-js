import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it, vi } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import {
  ChannelRunner,
  type ChannelMatch,
  type ChannelRunnerDependencies,
} from '../channel-runner.js';
import {
  ChannelBinding,
  ContractBundle,
  HandlerBinding,
} from '../contract-bundle.js';
import type { ProcessorExecutionContext } from '../processor-execution-context.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { CheckpointManager } from '../checkpoint-manager.js';
import { canonicalSignature } from '../../util/node-canonicalizer.js';
import type {
  ChannelContract,
  HandlerContract,
  ChannelEventCheckpoint,
} from '../../model/index.js';
import { KEY_CHECKPOINT } from '../../constants/processor-contract-constants.js';

const blue = createBlue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

function signatureFn(node: BlueNode | null): string | null {
  return canonicalSignature(blue, node);
}

describe('ChannelRunner', () => {
  const channelContract: ChannelContract = {
    key: 'external',
    path: '/events/external',
    order: 0,
  } as ChannelContract;

  const handlerContract = (key: string): HandlerContract =>
    ({
      key,
      channel: 'external',
      order: key === 'h1' ? 0 : 1,
    }) as HandlerContract;

  function createBundle(): ContractBundle {
    return ContractBundle.builder()
      .addChannel('external', channelContract, 'Custom.Channel')
      .addHandler('h1', handlerContract('h1'), 'Handler.One')
      .addHandler('h2', handlerContract('h2'), 'Handler.Two')
      .build();
  }

  function createRunner(
    overrides: Partial<{
      evaluateChannel: (event: BlueNode) => ChannelMatch;
      isScopeInactive: () => boolean;
      onExecute: (handler: HandlerBinding, event: BlueNode) => void;
    }> = {},
  ) {
    const runtime = new DocumentProcessingRuntime(new BlueNode(), blue);
    const bundle = createBundle();
    const checkpointManager = new CheckpointManager(runtime, signatureFn);
    const scopePath = '/';

    const isInactive = vi
      .fn()
      .mockImplementation(() => overrides.isScopeInactive?.() ?? false);
    const noopExecute = (handler: HandlerBinding, event: BlueNode) => {
      void handler;
      void event;
    };
    const onExecute = overrides.onExecute ?? noopExecute;
    const evaluate = overrides.evaluateChannel ?? (() => ({ matches: true }));

    const deps: ChannelRunnerDependencies = {
      evaluateChannel: (
        _channel: ChannelBinding,
        currentBundle: ContractBundle,
        currentScope: string,
        event: BlueNode,
      ): ChannelMatch => evaluate(event),
      isScopeInactive: () => isInactive(),
      createContext: (
        currentScope: string,
        currentBundle: ContractBundle,
        event: BlueNode,
        allowTerminatedWork: boolean,
      ) =>
        ({
          event: () => event,
        }) as unknown as ProcessorExecutionContext,
      executeHandler: (
        handler: HandlerBinding,
        context: ProcessorExecutionContext,
      ) => {
        const eventNode = context.event();
        onExecute(handler, eventNode as BlueNode);
      },
      canonicalSignature: signatureFn,
    };

    const runner = new ChannelRunner(runtime, checkpointManager, deps);
    return {
      runner,
      runtime,
      bundle,
      checkpointManager,
      scopePath,
      isInactive,
    };
  }

  it('runs handlers and persists checkpoint for first event', () => {
    const calls: string[] = [];
    const { runner, runtime, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({
        matches: true,
        eventNode: nodeFrom({ payload: 1 }),
      }),
      onExecute: (handler) => calls.push(handler.key()),
    });

    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    const event = nodeFrom({ payload: 1 });

    runner.runExternalChannel(scopePath, bundle, channel, event);

    expect(calls).toEqual(['h1', 'h2']);
    const stored = runtime
      .document()
      .get('/contracts/checkpoint/lastEvents/external');
    expect(stored).toBeInstanceOf(BlueNode);
    const marker = bundle.marker(KEY_CHECKPOINT) as any;
    expect(marker.lastSignatures.external).toBeDefined();
  });

  it('skips duplicate events based on signature', () => {
    const handlerSpy = vi.fn();
    const { runner, runtime, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({
        matches: true,
        eventNode: nodeFrom({ payload: 'same' }),
        eventId: 'event-1',
      }),
      onExecute: (handler) => handlerSpy(handler.key()),
    });
    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    const event = nodeFrom({ payload: 'same' });

    runner.runExternalChannel(scopePath, bundle, channel, event);
    runner.runExternalChannel(scopePath, bundle, channel, event);

    expect(handlerSpy).toHaveBeenCalledTimes(2);
    expect(
      runtime.document().get('/contracts/checkpoint/lastEvents/external'),
    ).toBeInstanceOf(BlueNode);
    expect(
      (bundle.marker(KEY_CHECKPOINT) as ChannelEventCheckpoint)?.lastSignatures
        ?.external,
    ).toBe('event-1');
  });

  it('stops processing when scope becomes inactive', () => {
    let inactive = false;
    const handlerCalls: string[] = [];
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: true, eventNode: nodeFrom({}) }),
      isScopeInactive: () => inactive,
      onExecute: (handler) => {
        handlerCalls.push(handler.key());
        inactive = true;
      },
    });

    runner.runHandlers(scopePath, bundle, 'external', nodeFrom({}), false);

    expect(handlerCalls).toEqual(['h1']);
  });

  it('allows terminated work when flag is set', () => {
    const handlerCalls: string[] = [];
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: true, eventNode: nodeFrom({}) }),
      isScopeInactive: () => true,
      onExecute: (handler) => handlerCalls.push(handler.key()),
    });
    runner.runHandlers(scopePath, bundle, 'external', nodeFrom({}), true);

    expect(handlerCalls).toEqual(['h1', 'h2']);
  });

  it('does nothing when channel does not match', () => {
    const execute = vi.fn();
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: false }),
      onExecute: execute,
    });
    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    runner.runExternalChannel(scopePath, bundle, channel, nodeFrom({}));
    expect(execute).not.toHaveBeenCalled();
  });
});
