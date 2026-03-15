import { BlueNode } from '@blue-labs/language';
import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { putDocumentSection } from '../../../test-support/editing-support.js';
import { DocStructure } from '../doc-structure.js';

describe('DocStructure public surface', () => {
  it('extracts root fields, channels, operations, and implementations', () => {
    const document = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment counter')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyIncrement',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .done()
      .buildDocument();

    const structure = DocStructure.from(document);

    expect(structure.fields.map((entry) => entry.path)).toEqual(['/counter']);
    expect(structure.getContract('ownerChannel')?.kind).toBe('channel');
    expect(structure.getContract('increment')?.kind).toBe('operation');
    expect(structure.getContract('incrementImpl')?.kind).toBe('operationImpl');
    expect(structure.getContract('increment')?.channelBinding).toBe(
      'ownerChannel',
    );
  });

  it('accepts summary input and keeps prompt text deterministic', () => {
    const document = DocBuilder.doc()
      .name('Workflow doc')
      .field('/status', 'idle')
      .onInit('initialize', (steps) =>
        steps.replaceValue('Ready', '/status', 'ready'),
      )
      .onDocChange('watchStatus', '/status', (steps) =>
        steps.replaceValue('Mirror', '/statusObserved', true),
      )
      .buildDocument();

    putDocumentSection(document, {
      key: 'workflowSection',
      title: 'Workflow section',
      summary: 'Initialization and watchers',
      relatedFields: ['/status'],
      relatedContracts: [
        'initialize',
        'watchStatus',
        'watchStatusDocUpdateChannel',
      ],
    });

    const structure = DocStructure.from(document);
    const repeated = DocStructure.from(structure.toSummaryJson());

    expect(repeated.getSection('workflowSection')?.title).toBe(
      'Workflow section',
    );
    expect(repeated.toSummaryJson()).toEqual(structure.toSummaryJson());
    expect(repeated.toPromptText()).toEqual(structure.toPromptText());
    expect(repeated.toPromptText()).toContain('workflowSection');
    expect(repeated.toPromptText()).toContain('watchStatusDocUpdateChannel');
  });

  it('keeps unknown contracts available through the compatibility alias', () => {
    const document = DocBuilder.doc().name('Unknown contract').buildDocument();
    document.addContract(
      'mystery',
      new BlueNode()
        .setType('Custom/Mystery Contract')
        .addProperty('x', new BlueNode().setValue(1)),
    );

    const structure = DocStructure.from(document);

    expect(structure.getContract('mystery')?.kind).toBe('other');
    expect(structure.unknownContracts.map((entry) => entry.key)).toEqual([
      'mystery',
    ]);
    expect(structure.unclassifiedContracts.map((entry) => entry.key)).toEqual([
      'mystery',
    ]);
  });
});
