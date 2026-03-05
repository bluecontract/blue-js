import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: myos admin revocation', () => {
  it('handles myos permission revoke events through triggered-event workflow', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('MyOS revoke e2e')
      .field('/status', 'active')
      .onInit('emitRevokeEvent', (steps) =>
        steps.triggerEvent('EmitRevoke', {
          type: 'MyOS/Single Document Permission Revoke Requested',
        }),
      )
      .onEvent(
        'onPermissionRevoked',
        { type: 'MyOS/Single Document Permission Revoke Requested' },
        (steps) => steps.replaceValue('MarkRevoked', '/status', 'revoked'),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );
    expect(String(initialized.document.get('/status'))).toBe('revoked');
  });
});
