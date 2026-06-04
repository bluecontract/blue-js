import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { DocumentProcessor } from '../../api/document-processor.js';
import { createBlue } from '../../test-support/blue.js';
import { ProcessorStatus } from '../../types/document-processing-result.js';

describe('PayNote initialization performance', () => {
  it('initializes the inherited PayNote base without pathological cost', async () => {
    const blue = createBlue();
    const document = await blue.resolve(
      blue.yamlToNode(`
name: Performance Guard PayNote
type: PayNote/PayNote
kind: PayNote
currency: USD
amount:
  expectedTotal: 15000
controls: {}
`),
    );
    const contracts = document.getContracts();
    document.setContracts({
      initLifecycleChannel: contracts?.initLifecycleChannel?.clone() ?? fail(),
      initialize: contracts?.initialize?.clone() ?? fail(),
    });
    const processor = new DocumentProcessor({ blue });

    const startedAt = performance.now();
    const result = await processor.initializeDocument(document);
    const durationMs = performance.now() - startedAt;

    console.info(
      `PayNote inherited base initialization: ${durationMs.toFixed(2)} ms`,
    );
    if (result.capabilityFailure) {
      console.info(`PayNote initialization failure: ${result.failureReason}`);
    }

    expect(result.capabilityFailure).toBe(false);
    expect(result.status).toBe(ProcessorStatus.SUCCESS);
    expect(result.document.get('/status')).toBe('Pending');
    expect(String(result.document.get('/amount/finalResolved'))).toBe('0');
    expect(String(result.document.get('/amount/secured'))).toBe('0');
    expect(result.document.get('/controls/completionLocked')).toBe(false);
    expect(durationMs).toBeLessThan(1_000);
  });
});

function fail(): never {
  throw new Error('Expected PayNote initializer contracts to resolve');
}
