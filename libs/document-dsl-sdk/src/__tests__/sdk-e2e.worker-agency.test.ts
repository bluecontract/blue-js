import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import { expr } from '../expr.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: worker agency', () => {
  it('emits worker agency grant and revoke events from init workflow', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Worker agency e2e')
      .field('/targetSessionId', 'worker-session')
      .onInit('bootstrap', (steps) =>
        steps
          .myOs()
          .grantWorkerAgencyPermission(
            'ownerChannel',
            'REQ_WORKER_GRANT',
            expr("document('/targetSessionId')"),
            {
              allowedOperations: ['propose', 'accept'],
            },
          )
          .myOs()
          .revokeWorkerAgencyPermission(
            'ownerChannel',
            'REQ_WORKER_REVOKE',
            expr("document('/targetSessionId')"),
          ),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(processor.isInitialized(initialized.document)).toBe(true);
    expect(initialized.triggeredEvents.length).toBeGreaterThan(0);
  });
});
