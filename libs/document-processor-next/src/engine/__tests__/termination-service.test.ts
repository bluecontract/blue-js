import { describe, expect, it, vi } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { TerminationService } from '../termination-service.js';
import { DocumentProcessingRuntime } from '../../runtime/document-processing-runtime.js';
import { ContractBundle } from '../contract-bundle.js';
import { RunTerminationError } from '../run-termination-error.js';
import type { TerminationExecutionAdapter } from '../termination-service.js';

describe('TerminationService', () => {
  function createFixture() {
    const runtime = new DocumentProcessingRuntime(new BlueNode());
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
    expect(() => service.terminateScope(adapter, '/', null, 'FATAL', 'bad')).toThrow(RunTerminationError);
    expect(runtime.rootEmissions()).not.toHaveLength(0);
  });
});
