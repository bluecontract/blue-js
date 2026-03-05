import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: filtered subscriptions', () => {
  it('matches subscription updates by subscription id and update type', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Filtered subscription e2e')
      .field('/received', false)
      .onInit('emitSubscriptionUpdate', (steps) =>
        steps.triggerEvent('EmitSubscriptionUpdate', {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_CATALOG',
          update: {
            type: 'MyOS/Call Operation Responded',
          },
        }),
      )
      .onSubscriptionUpdate(
        'onCatalogUpdate',
        'SUB_CATALOG',
        'MyOS/Call Operation Responded',
        (steps) => steps.replaceValue('MarkReceived', '/received', true),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(initialized.document.get('/received')).toBe(true);
  });
});
