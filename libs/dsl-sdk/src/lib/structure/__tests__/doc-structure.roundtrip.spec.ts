import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { PayNotes } from '../../paynote/paynotes.js';
import { DocPatch } from '../../patch/doc-patch.js';
import { DocStructure } from '../doc-structure.js';

function buildCounterDocument() {
  return DocBuilder.doc()
    .name('Structure Counter')
    .description('Counter structure roundtrip')
    .field('/counter', 0)
    .channel('ownerChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'owner-timeline',
    })
    .operation(
      'increment',
      'ownerChannel',
      Number,
      'Increment counter',
      (steps) =>
        steps.replaceExpression(
          'IncrementCounter',
          '/counter',
          "document('/counter') + event.message.request",
        ),
    )
    .buildDocument();
}

function buildAiDocument() {
  // prettier-ignore
  return DocBuilder.doc()
    .name('Structure AI')
    .field('/handled', false)
    .channel('ownerChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'owner-timeline',
    })
    .ai('provider')
      .sessionId('provider-session')
      .permissionFrom('ownerChannel')
      .requestPermissionManually()
      .task('summarize')
        .instruction('Summarize user request')
        .done()
      .done()
    .onAIResponseForTask(
      'provider',
      'onSummary',
      'Conversation/Response',
      'summarize',
      (steps) => steps.replaceValue('SetHandled', '/handled', true),
    )
    .buildDocument();
}

function buildPayNoteDocument() {
  // prettier-ignore
  return PayNotes.payNote('Structure PayNote')
    .currency('USD')
    .amountMinor(9000)
    .capture()
      .lockOnInit()
      .requestOnOperation('captureNow', 'guarantorChannel', 'Capture now')
      .done()
    .buildDocument();
}

describe('DocStructure roundtrip stability', () => {
  it('keeps summary and prompt stable across DocBuilder.from rebuild for counter docs', () => {
    const original = buildCounterDocument();
    const rebuilt = DocBuilder.from(original).buildDocument();

    const originalStructure = DocStructure.from(original);
    const rebuiltStructure = DocStructure.from(rebuilt);
    expect(rebuiltStructure.toSummaryJson()).toEqual(
      originalStructure.toSummaryJson(),
    );
    expect(rebuiltStructure.toPromptText()).toEqual(
      originalStructure.toPromptText(),
    );
  });

  it('keeps summary and prompt stable across DocBuilder.from rebuild for AI docs', () => {
    const original = buildAiDocument();
    const rebuilt = DocBuilder.from(original).buildDocument();

    const originalStructure = DocStructure.from(original);
    const rebuiltStructure = DocStructure.from(rebuilt);
    expect(rebuiltStructure.toSummaryJson()).toEqual(
      originalStructure.toSummaryJson(),
    );
    expect(rebuiltStructure.toPromptText()).toEqual(
      originalStructure.toPromptText(),
    );
  });

  it('keeps summary and prompt stable across DocBuilder.from rebuild for PayNote docs', () => {
    const original = buildPayNoteDocument();
    const rebuilt = DocBuilder.from(original).buildDocument();

    const originalStructure = DocStructure.from(original);
    const rebuiltStructure = DocStructure.from(rebuilt);
    expect(rebuiltStructure.toSummaryJson()).toEqual(
      originalStructure.toSummaryJson(),
    );
    expect(rebuiltStructure.toPromptText()).toEqual(
      originalStructure.toPromptText(),
    );
  });

  it('keeps structure deterministic after DocPatch mutate roundtrip', () => {
    const original = buildCounterDocument();
    const patched = DocPatch.from(original)
      .mutate((doc) => {
        doc.field('/counter', 4);
        doc.operation('increment').description('Increment counter v2').done();
      })
      .applyTo(original, false);

    const patchedFromBuilder = DocBuilder.from(original)
      .field('/counter', 4)
      .operation('increment')
      .description('Increment counter v2')
      .done()
      .buildDocument();

    expect(DocStructure.from(patched).toSummaryJson()).toEqual(
      DocStructure.from(patchedFromBuilder).toSummaryJson(),
    );
  });

  it('classifies unknown contracts as other without throwing', () => {
    const structure = DocStructure.from({
      name: 'Unknown Contract Classification',
      contracts: {
        strangeContract: {
          foo: 'bar',
          nested: {
            any: true,
          },
        },
      },
    });

    expect(structure.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'strangeContract',
          kind: 'other',
        }),
      ]),
    );
  });
});
