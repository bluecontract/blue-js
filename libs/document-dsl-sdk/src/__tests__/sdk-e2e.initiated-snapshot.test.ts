import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: initiated snapshot', () => {
  it('creates initialized marker and stable snapshot id on initialization', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Initialized snapshot e2e')
      .field('/counter', 1)
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(processor.isInitialized(initialized.document)).toBe(true);
    const documentId = initialized.document.get(
      '/contracts/initialized/documentId',
    );
    expect(typeof documentId === 'string' && documentId.length > 0).toBe(true);
  });
});
