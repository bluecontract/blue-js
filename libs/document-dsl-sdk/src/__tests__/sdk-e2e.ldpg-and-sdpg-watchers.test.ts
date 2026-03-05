import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
} from '../test-support/runtime.js';

describe('sdk e2e: LDPG and SDPG watchers', () => {
  it('reacts to single and linked document permission grant events', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Permission watcher e2e')
      .field('/singleGranted', false)
      .field('/linkedGranted', false)
      .onInit('emitPermissionGrantedEvents', (steps) =>
        steps
          .triggerEvent('EmitSingleGranted', {
            type: 'MyOS/Single Document Permission Granted',
          })
          .triggerEvent('EmitLinkedGranted', {
            type: 'MyOS/Linked Documents Permission Granted',
          }),
      )
      .onEvent(
        'onSingleGranted',
        { type: 'MyOS/Single Document Permission Granted' },
        (steps) =>
          steps.replaceValue('MarkSingleGranted', '/singleGranted', true),
      )
      .onEvent(
        'onLinkedGranted',
        { type: 'MyOS/Linked Documents Permission Granted' },
        (steps) =>
          steps.replaceValue('MarkLinkedGranted', '/linkedGranted', true),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    expect(initialized.document.get('/singleGranted')).toBe(true);
    expect(initialized.document.get('/linkedGranted')).toBe(true);
  });
});
