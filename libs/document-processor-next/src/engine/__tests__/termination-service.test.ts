import { createBlue } from '../../test-support/blue.js';
import { describe, expect, it, vi } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { TerminationService } from '../termination-service.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { ContractBundle } from '../contract-bundle.js';
import { RunTerminationError } from '../run-termination-error.js';
import type { TerminationExecutionAdapter } from '../termination-service.js';
import { typeBlueId } from '../../__tests__/test-utils.js';
import { blueIds } from '@blue-repository/core';

describe('TerminationService', () => {
  function createFixture() {
    const blue = createBlue();
    const runtime = new DocumentProcessingRuntime(new BlueNode(), blue);
    const service = new TerminationService(runtime);
    const adapter: TerminationExecutionAdapter = {
      recordPendingTermination: vi.fn(),
      normalizeScope: vi.fn((scope) => scope),
      bundleForScope: vi.fn().mockReturnValue(ContractBundle.builder().build()),
      deliverLifecycle: vi.fn(),
      clearPendingTermination: vi.fn(),
    };
    return { runtime, service, adapter };
  }

  it('writes termination marker and charges gas', () => {
    const { runtime, service, adapter } = createFixture();
    service.terminateScope(adapter, '/scope', null, 'GRACEFUL', 'done');

    const marker = runtime.document().get('/scope/contracts/terminated');
    expect(marker).toBeInstanceOf(BlueNode);
    expect(adapter.deliverLifecycle).toHaveBeenCalled();
    expect(adapter.clearPendingTermination).toHaveBeenCalledWith('/scope');
  });

  it('throws RunTerminationError on root fatal', () => {
    const { runtime, service, adapter } = createFixture();
    expect(() =>
      service.terminateScope(adapter, '/', null, 'FATAL', 'bad')
    ).toThrow(RunTerminationError);
    expect(adapter.deliverLifecycle).toHaveBeenCalled();
    const deliverLifecycleMock = adapter.deliverLifecycle as ReturnType<
      typeof vi.fn
    >;
    const lifecycleEvent = deliverLifecycleMock.mock.calls[0]?.[2] as BlueNode;
    expect(lifecycleEvent).toBeInstanceOf(BlueNode);
    expect(typeBlueId(lifecycleEvent)).toBe(
      blueIds['Document Processing Terminated']
    );
    const props = lifecycleEvent.getProperties() ?? {};

    expect(props.cause?.getValue()).toBe('fatal');
    expect(props.reason?.getValue()).toBe('bad');
    expect(runtime.rootEmissions()).toHaveLength(0);
  });
});
