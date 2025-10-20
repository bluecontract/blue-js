import { describe, expect, it, vi } from 'vitest';
import { Blue, BlueNode } from '@blue-labs/language';

import {
  ProcessorExecutionContext,
  type ExecutionAdapter,
} from '../processor-execution-context.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { ContractBundle } from '../contract-bundle.js';
import type { JsonPatch } from '../../model/shared/json-patch.js';

const blue = new Blue();

function nodeFrom(json: unknown): BlueNode {
  return blue.jsonValueToNode(json);
}

describe('ProcessorExecutionContext', () => {
  const bundle = ContractBundle.builder().build();
  const patch: JsonPatch = { op: 'ADD', path: '/foo', val: nodeFrom('bar') };

  function createContext(overrides: Partial<ExecutionAdapter> = {}) {
    const runtime = new DocumentProcessingRuntime(new BlueNode());
    const adapter: ExecutionAdapter = {
      runtime: () => runtime,
      isScopeInactive: vi.fn().mockReturnValue(false),
      handlePatch: vi.fn(),
      resolvePointer: vi.fn((_scope, pointer) => pointer),
      enterGracefulTermination: vi.fn(),
      enterFatalTermination: vi.fn(),
      ...overrides,
    };
    const context = new ProcessorExecutionContext(
      adapter,
      bundle,
      '/',
      nodeFrom({ eventType: 'Event' }),
      false,
      false,
      blue
    );
    return { context, adapter, runtime };
  }

  it('applies patch through execution adapter when active', () => {
    const { context, adapter } = createContext();
    context.applyPatch(patch);
    expect(adapter.handlePatch).toHaveBeenCalledWith('/', bundle, patch, false);
  });

  it('skips patch when scope inactive and not allowed', () => {
    const { context, adapter } = createContext({
      isScopeInactive: vi.fn().mockReturnValue(true),
    });
    context.applyPatch(patch);
    expect(adapter.handlePatch).not.toHaveBeenCalled();
  });

  it('enqueues emitted events and records root emissions', () => {
    const { context, runtime } = createContext();
    context.emitEvent(nodeFrom({ payload: 1 }));

    const rootScope = runtime.scope('/');
    expect(rootScope.triggeredSize()).toBe(1);
    expect(runtime.rootEmissions()).toHaveLength(1);
  });

  it('consumes gas via runtime', () => {
    const { context, runtime } = createContext();
    context.consumeGas(42);
    expect(runtime.totalGas()).toBe(42);
  });

  it('delegates termination requests', () => {
    const adapter = {
      runtime: vi.fn(),
      isScopeInactive: vi.fn().mockReturnValue(false),
      handlePatch: vi.fn(),
      resolvePointer: vi.fn((_scope, pointer) => pointer),
      enterGracefulTermination: vi.fn(),
      enterFatalTermination: vi.fn(),
    } satisfies ExecutionAdapter;
    const context = new ProcessorExecutionContext(
      adapter,
      bundle,
      '/child',
      nodeFrom({}),
      true,
      false,
      blue
    );

    context.terminateGracefully('done');
    expect(adapter.enterGracefulTermination).toHaveBeenCalledWith(
      '/child',
      bundle,
      'done'
    );

    context.terminateFatally('fatal');
    expect(adapter.enterFatalTermination).toHaveBeenCalledWith(
      '/child',
      bundle,
      'fatal'
    );
  });

  it('retrieves document data through pointers', () => {
    const { context, runtime } = createContext();
    runtime.directWrite('/foo', nodeFrom({ answer: 42 }));

    const documentNode = context.documentAt('/foo');
    expect(documentNode).toBeInstanceOf(BlueNode);
    expect(context.documentContains('/foo')).toBe(true);
    expect(context.documentContains('/missing')).toBe(false);
  });
});
