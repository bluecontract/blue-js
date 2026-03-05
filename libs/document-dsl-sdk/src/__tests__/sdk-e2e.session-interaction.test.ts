import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: session interaction marker', () => {
  it('initializes document containing MyOS session interaction marker', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Session interaction e2e')
      .contract('sessionInteraction', {
        type: 'MyOS/MyOS Session Interaction',
        operationFilter: {
          includeOperations: ['search'],
        },
      })
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetReady', '/ready', true),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(processor.isInitialized(initialized.document)).toBe(true);
    expect(initialized.document.get('/ready')).toBe(true);
  });
});
