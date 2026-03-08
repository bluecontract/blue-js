/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/structure/DocStructureTest.java
*/

import { BlueNode } from '@blue-labs/language';

import { DocBuilder, DocStructure, PayNotes } from '../lib';
import { putDocumentSection } from './editing-support';

describe('DocStructure', () => {
  it('extracts counter document root fields, channels, operations, and implementations', () => {
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
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement counter')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyDecrement',
          '/counter',
          "document('/counter') - event.message.request",
        ),
      )
      .done()
      .buildDocument();

    const structure = DocStructure.from(document);

    expect(structure.fields.map((entry) => entry.path)).toEqual(['/counter']);
    expect(
      structure.contracts
        .filter((entry) => entry.kind === 'channel')
        .map((entry) => entry.key),
    ).toEqual(['ownerChannel']);
    expect(
      structure.contracts
        .filter((entry) => entry.kind === 'operation')
        .map((entry) => entry.key),
    ).toEqual(['decrement', 'increment']);
    expect(
      structure.contracts
        .filter((entry) => entry.kind === 'operationImpl')
        .map((entry) => entry.key),
    ).toEqual(['decrementImpl', 'incrementImpl']);
  });

  it('extracts section membership, workflow channels, and deterministic summaries', () => {
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
    const repeated = DocStructure.from(document.clone());

    expect(structure.getContract('initialize')?.kind).toBe('workflow');
    expect(structure.getContract('initialize')?.channel).toBe(
      'initLifecycleChannel',
    );
    expect(structure.getContract('watchStatus')?.channel).toBe(
      'watchStatusDocUpdateChannel',
    );
    expect(structure.sections).toEqual(repeated.sections);
    expect(structure.toSummaryJson()).toEqual(repeated.toSummaryJson());
    expect(structure.toPromptText()).toContain('workflowSection');
    expect(structure.toPromptText()).toContain('watchStatusDocUpdateChannel');
  });

  it('keeps unknown contracts as kind other without throwing', () => {
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
  });

  it('extracts composite channel children and MyOS admin contracts', () => {
    const document = DocBuilder.doc()
      .name('Composite admin')
      .channels('a', 'b')
      .compositeChannel('union', 'a', 'b')
      .myOsAdmin('customAdminChannel')
      .buildDocument();

    const structure = DocStructure.from(document);

    expect(structure.getContract('union')?.kind).toBe('channel');
    expect(structure.getContract('union')?.compositeChildren).toEqual([
      'a',
      'b',
    ]);
    expect(structure.getContract('myOsAdminUpdate')?.kind).toBe('operation');
    expect(structure.getContract('myOsAdminUpdateImpl')?.kind).toBe(
      'operationImpl',
    );
  });

  it('extracts PayNote action workflows and participant channels', () => {
    const document = PayNotes.payNote('Simple capture')
      .currency('USD')
      .amountMinor(1000)
      .capture()
      .lockOnInit()
      .unlockOnOperation('unlockCapture', 'payerChannel', 'unlock capture')
      .requestOnOperation(
        'requestCapture',
        'guarantorChannel',
        'request capture',
      )
      .done()
      .buildDocument();

    const structure = DocStructure.from(document);

    expect(structure.type).toBe('PayNote/PayNote');
    expect(structure.getContract('captureLockOnInit')?.kind).toBe('workflow');
    expect(structure.getContract('initLifecycleChannel')?.kind).toBe('channel');
    expect(structure.getContract('unlockCapture')?.channel).toBe(
      'payerChannel',
    );
    expect(structure.getContract('requestCapture')?.channel).toBe(
      'guarantorChannel',
    );
  });
});
