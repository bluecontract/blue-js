/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/structure/DocStructurePipelineTest.java
- references/java-sdk/src/test/java/blue/language/sdk/structure/CounterCreationAndEditPipelineTest.java
*/

import { BlueNode } from '@blue-labs/language';

import {
  BlueChangeCompiler,
  DocBuilder,
  DocPatch,
  DocStructure,
  PayNotes,
} from '../lib';
import { assertCanonicalNodeEquals } from './editing-support';

describe('Stage 7 editing pipeline', () => {
  function expectRoundtrip(before: BlueNode, after: BlueNode) {
    const patch = DocPatch.from(before).diff(after);
    const applied = patch.apply();
    const plan = BlueChangeCompiler.compile(before, after);

    assertCanonicalNodeEquals(applied, after);
    expect(DocStructure.from(applied).toSummaryJson()).toEqual(
      DocStructure.from(after).toSummaryJson(),
    );
    expect(plan.toSummaryJson()).toEqual(
      BlueChangeCompiler.compile(before.clone(), after.clone()).toSummaryJson(),
    );
  }

  it('roundtrips a counter document that adds a second operation', () => {
    const before = DocBuilder.doc()
      .name('Counter')
      .field('/counter', 0)
      .channel('ownerChannel')
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment')
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
    const after = DocBuilder.from(before.clone())
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement')
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

    expectRoundtrip(before, after);
  });

  it('roundtrips handler workflows with root and contract changes', () => {
    const before = DocBuilder.doc()
      .name('Workflow doc')
      .field('/status', 'idle')
      .onInit('initialize', (steps) =>
        steps.replaceValue('Ready', '/status', 'ready'),
      )
      .onDocChange('watchStatus', '/status', (steps) =>
        steps.replaceValue('Observed', '/observed', true),
      )
      .buildDocument();
    const after = DocBuilder.from(before.clone())
      .replace('/status', 'processing')
      .onEvent('markFromEvent', 'Conversation/Event', (steps) =>
        steps.replaceValue('EventProcessed', '/eventSeen', true),
      )
      .buildDocument();

    expectRoundtrip(before, after);
  });

  it('roundtrips a MyOS orchestration document', () => {
    const before = DocBuilder.doc()
      .name('Access orchestration')
      .field('/catalogSessionId', 'remote-session-1')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .read(true)
      .operations('search')
      .subscribeAfterGranted()
      .statusPath('/catalog/status')
      .done()
      .channel('myOsAdminChannel', {
        timelineId: 'editing-myos-admin',
      })
      .buildDocument();
    const after = DocBuilder.doc()
      .name('Access orchestration')
      .field('/catalogSessionId', 'remote-session-1')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .read(true)
      .operations('search')
      .subscribeAfterGranted()
      .statusPath('/catalog/status')
      .done()
      .onAccessGranted('catalog', 'markCatalogGranted', (steps) =>
        steps.replaceValue('MarkGranted', '/catalog/granted', true),
      )
      .channel('myOsAdminChannel', {
        timelineId: 'editing-myos-admin',
      })
      .buildDocument();

    expectRoundtrip(before, after);
  });

  it('roundtrips an AI orchestration document', () => {
    const before = DocBuilder.doc()
      .name('AI orchestration')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-1')
      .field('/prompt', 'Summarize the input')
      .ai('planner')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/planner/status')
      .contextPath('/planner/context')
      .task('summarize')
      .instruction('Return concise JSON')
      .expects('Conversation/Chat Message')
      .done()
      .done()
      .buildDocument();
    const after = DocBuilder.doc()
      .name('AI orchestration')
      .channel('ownerChannel')
      .field('/llmProviderSessionId', 'session-1')
      .field('/prompt', 'Summarize the input')
      .field('/secondaryProviderSessionId', 'session-2')
      .ai('planner')
      .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/planner/status')
      .contextPath('/planner/context')
      .task('summarize')
      .instruction('Return concise JSON')
      .expects('Conversation/Chat Message')
      .done()
      .done()
      .onAIResponse('planner', 'onSummaryResponse', (steps) =>
        steps.replaceValue('StoreResult', '/result/status', 'done'),
      )
      .buildDocument();

    expectRoundtrip(before, after);
  });

  it('roundtrips a PayNote document with a new reserve phase', () => {
    const before = PayNotes.payNote('Simple capture')
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
    const after = PayNotes.payNote('Simple capture')
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
      .reserve()
      .requestOnInit()
      .done()
      .buildDocument();

    expectRoundtrip(before, after);
  });
});
