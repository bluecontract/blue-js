import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import { getBlue, getBlueDocumentProcessor } from '../test-support/runtime.js';

describe('sdk e2e: change workflows', () => {
  it('initializes direct change workflow and surfaces unsupported extended flows', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const directYaml = DocBuilder.doc()
      .name('Direct change workflow doc')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-session',
      })
      .contractsPolicy({ requireSectionChanges: false })
      .directChange('directChange', 'ownerChannel')
      .toYaml();

    const directInitialized = await processor.initializeDocument(
      blue.resolve(blue.yamlToNode(directYaml)),
    );
    expect(directInitialized.capabilityFailure).toBe(false);
    expect(processor.isInitialized(directInitialized.document)).toBe(true);

    const extendedYaml = DocBuilder.doc()
      .name('Extended change workflow doc')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-session',
      })
      .proposeChange('proposeChange', 'ownerChannel', 'Order')
      .acceptChange('acceptChange', 'ownerChannel', 'Order')
      .rejectChange('rejectChange', 'ownerChannel', 'Order')
      .toYaml();

    const extendedInitialized = await processor.initializeDocument(
      blue.resolve(blue.yamlToNode(extendedYaml)),
    );
    expect(extendedInitialized.capabilityFailure).toBe(false);
    expect(processor.isInitialized(extendedInitialized.document)).toBe(true);
  });
});
