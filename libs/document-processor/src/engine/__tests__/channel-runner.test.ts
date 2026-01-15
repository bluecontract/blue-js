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
import { ingestExternalEvent } from '../external-event.js';

const blue = createBlue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

function signatureFn(node: BlueNode | null): string | null {
  return canonicalSignature(blue, node);
}

describe('ChannelRunner', () => {
  const channelContract: ChannelContract = {
    path: '/events/external',
    order: 0,
  } as ChannelContract;

  const handlerContract = (key: string): HandlerContract =>
    ({
      channel: 'external',
      order: key === 'h1' ? 0 : 1,
    }) as HandlerContract;

  function createBundle(): ContractBundle {
    return ContractBundle.builder()
      .addChannel('external', channelContract, 'Custom.Channel')
      .addHandler('h1', handlerContract('h1'), 'Handler.One', new BlueNode())
      .addHandler('h2', handlerContract('h2'), 'Handler.Two', new BlueNode())
      .build();
  }

  function createRunner(
    overrides: Partial<{
      evaluateChannel: (
        event: BlueNode,
      ) => ChannelMatch | Promise<ChannelMatch>;
      isScopeInactive: () => boolean;
      onExecute: (
        handler: HandlerBinding,
        event: BlueNode,
      ) => void | Promise<void>;
      shouldRunHandler: (
        handler: HandlerBinding,
        context: ProcessorExecutionContext,
      ) => boolean | Promise<boolean>;
      handleHandlerError: (error: unknown) => void | Promise<void>;
    }> = {},
  ) {
    const runtime = new DocumentProcessingRuntime(new BlueNode(), blue);
    const bundle = createBundle();
    const checkpointManager = new CheckpointManager(runtime, signatureFn);
    const scopePath = '/';

    const isInactive = vi
      .fn()
      .mockImplementation(() => overrides.isScopeInactive?.() ?? false);
    const noopExecute = async (handler: HandlerBinding, event: BlueNode) => {
      void handler;
      void event;
    };
    const onExecute = overrides.onExecute ?? noopExecute;
    const evaluate =
      overrides.evaluateChannel ??
      ((event: BlueNode): ChannelMatch | Promise<ChannelMatch> => ({
        matches: true,
      }));

    const deps: ChannelRunnerDependencies = {
      evaluateChannel: async (
        _channel: ChannelBinding,
        currentBundle: ContractBundle,
        currentScope: string,
        event: BlueNode,
      ): Promise<ChannelMatch> => Promise.resolve(evaluate(event)),
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
      shouldRunHandler: async (
        handler: HandlerBinding,
        context: ProcessorExecutionContext,
      ): Promise<boolean> =>
        Promise.resolve(overrides.shouldRunHandler?.(handler, context) ?? true),
      executeHandler: async (
        handler: HandlerBinding,
        context: ProcessorExecutionContext,
      ): Promise<void> => {
        const eventNode = context.event();
        await onExecute(handler, eventNode as BlueNode);
      },
      handleHandlerError: async (
        _scope: string,
        _bundle: ContractBundle,
        error: unknown,
      ) => {
        await overrides.handleHandlerError?.(error);
      },
      canonicalSignature: signatureFn,
      channelProcessorFor: () => null,
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

  it('runs handlers and persists checkpoint for first event', async () => {
    const calls: string[] = [];
    const { runner, runtime, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({
        matches: true,
        eventNode: nodeFrom({ payload: 1 }),
      }),
      onExecute: (handler) => {
        calls.push(handler.key());
      },
    });

    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    const event = nodeFrom({ payload: 1 });

    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, event),
    );

    expect(calls).toEqual(['h1', 'h2']);
    const stored = runtime
      .document()
      .get('/contracts/checkpoint/lastEvents/external');
    expect(stored).toBeInstanceOf(BlueNode);
    const marker = bundle.marker(KEY_CHECKPOINT) as any;
    expect(marker.lastSignatures.external).toBeDefined();
  });

  it('resolves events before evaluating channels and persisting checkpoints', async () => {
    const { runner, runtime, bundle, scopePath } = createRunner({
      evaluateChannel: (event: BlueNode) => {
        expect(event).toBeInstanceOf(BlueNode);
        expect(event.isResolved()).toBe(true);
        return {
          matches: true,
          eventNode: event.clone(),
        };
      },
    });

    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    const unresolvedEvent = nodeFrom({ payload: 'resolve-me' });

    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, unresolvedEvent),
    );

    const stored = runtime
      .document()
      .get('/contracts/checkpoint/lastEvents/external');
    expect(stored).toBeInstanceOf(BlueNode);
    expect((stored as BlueNode).isResolved()).toBe(true);
  });

  it('skips duplicate events based on signature', async () => {
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

    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, event),
    );
    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, event),
    );

    expect(handlerSpy).toHaveBeenCalledTimes(2);
    expect(
      runtime.document().get('/contracts/checkpoint/lastEvents/external'),
    ).toBeInstanceOf(BlueNode);
    expect(
      (bundle.marker(KEY_CHECKPOINT) as ChannelEventCheckpoint)?.lastSignatures
        ?.external,
    ).toBe('event-1');
  });

  it('stops processing when scope becomes inactive', async () => {
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

    await runner.runHandlers(
      scopePath,
      bundle,
      'external',
      nodeFrom({}),
      false,
    );

    expect(handlerCalls).toEqual(['h1']);
  });

  it('forwards handler exceptions to handler error hook', async () => {
    const errorHook = vi.fn();
    const thrown = new Error('boom');
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: true, eventNode: nodeFrom({}) }),
      onExecute: () => {
        throw thrown;
      },
      handleHandlerError: (error) => errorHook(error),
    });

    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    const event = nodeFrom({ payload: 1 });

    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, event),
    );

    expect(errorHook).toHaveBeenCalledTimes(1);
    expect(errorHook).toHaveBeenCalledWith(thrown);
  });

  it('allows terminated work when flag is set', async () => {
    const handlerCalls: string[] = [];
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: true, eventNode: nodeFrom({}) }),
      isScopeInactive: () => true,
      onExecute: (handler) => {
        handlerCalls.push(handler.key());
      },
    });
    await runner.runHandlers(scopePath, bundle, 'external', nodeFrom({}), true);

    expect(handlerCalls).toEqual(['h1', 'h2']);
  });

  it('skips handlers when shouldRunHandler returns false', async () => {
    const handlerCalls: string[] = [];
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: true, eventNode: nodeFrom({}) }),
      shouldRunHandler: (handler) => handler.key() === 'h2',
      onExecute: (handler) => {
        handlerCalls.push(handler.key());
      },
    });

    await runner.runHandlers(
      scopePath,
      bundle,
      'external',
      nodeFrom({}),
      false,
    );

    expect(handlerCalls).toEqual(['h2']);
  });

  it('does nothing when channel does not match', async () => {
    const execute = vi.fn();
    const { runner, bundle, scopePath } = createRunner({
      evaluateChannel: () => ({ matches: false }),
      onExecute: execute,
    });
    const channel = bundle.channelsOfType('Custom.Channel')[0]!;
    await runner.runExternalChannel(
      scopePath,
      bundle,
      channel,
      ingestExternalEvent(blue, nodeFrom({})),
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
