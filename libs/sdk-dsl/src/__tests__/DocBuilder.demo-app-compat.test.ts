import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { DocBuilder } from '../lib';
import { assertDslMatchesNode, assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder demo-app compatibility helpers', () => {
  it('maps marker contract wrappers to the same shapes as direct contract(...) insertion', () => {
    const viaCompat = DocBuilder.doc()
      .sessionInteraction()
      .participantsOrchestration()
      .workerAgency()
      .buildDocument();

    const viaContracts = DocBuilder.doc()
      .contract('sessionInteraction', {
        type: 'MyOS/MyOS Session Interaction',
      })
      .contract('participantsOrchestration', {
        type: 'MyOS/MyOS Participants Orchestration',
      })
      .contract('workerAgency', {
        type: 'MyOS/MyOS Worker Agency',
      })
      .buildDocument();

    assertDslMatchesNode(viaCompat, viaContracts);
  });

  it('maps document anchor and link convenience wrappers with cumulative link insertion', () => {
    const built = DocBuilder.doc()
      .name('Demo-app link helpers')
      .documentAnchors(['primary'])
      .sessionLink('sessionRef', 'primary', 'SESSION_1')
      .documentLink('documentRef', 'primary', 'DOC_1')
      .documentTypeLink(
        'typeRef',
        'primary',
        conversationBlueIds['Conversation/Event'],
      )
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Demo-app link helpers
contracts:
  anchors:
    type: MyOS/Document Anchors
    primary:
      type: MyOS/Document Anchor
  links:
    type: MyOS/Document Links
    sessionRef:
      type: MyOS/MyOS Session Link
      anchor: primary
      sessionId: SESSION_1
    documentRef:
      type: MyOS/Document Link
      anchor: primary
      documentId: DOC_1
    typeRef:
      type: MyOS/Document Type Link
      anchor: primary
      documentType:
        type: Conversation/Event
`,
    );
  });

  it('tracks marker and anchor contracts inside sections', () => {
    const json = DocBuilder.doc()
      .section('myos', 'MyOS')
      .sessionInteraction()
      .documentAnchors(['primary'])
      .endSection()
      .buildJson();

    expect(json.contracts).toMatchObject({
      myos: {
        relatedContracts: ['sessionInteraction', 'anchors'],
      },
    });
  });

  it('aliases AI response helpers to the same document shape', () => {
    const viaCompat = createCompatibilityDocument()
      .onAIResponseForTask('assistant', 'handleTask', 'summarize', (steps) =>
        steps.replaceValue('MarkTask', '/taskHandled', true),
      )
      .onAINamedResponse(
        'assistant',
        'handleNamed',
        'assistant-approved',
        'summarize',
        (steps) => steps.replaceValue('MarkNamed', '/namedHandled', true),
      )
      .buildDocument();

    const viaMainline = createCompatibilityDocument()
      .onAIResponse(
        'assistant',
        'handleTask',
        'Conversation/Response',
        'summarize',
        (steps) => steps.replaceValue('MarkTask', '/taskHandled', true),
      )
      .onAIResponse(
        'assistant',
        'handleNamed',
        { namedEvent: 'assistant-approved' },
        'summarize',
        (steps) => steps.replaceValue('MarkNamed', '/namedHandled', true),
      )
      .buildDocument();

    assertDslMatchesNode(viaCompat, viaMainline);
  });

  it('maps onSessionCreated to the runtime-confirmed subscription initiated event', () => {
    const viaCompat = createCompatibilityDocument()
      .onSessionCreated('orders', 'captureSessionCreated', (steps) =>
        steps.replaceValue('MarkSession', '/sessionCreated', true),
      )
      .buildDocument();

    const viaMainline = createCompatibilityDocument()
      .onEvent(
        'captureSessionCreated',
        'MyOS/Subscription to Session Initiated',
        (steps) => steps.replaceValue('MarkSession', '/sessionCreated', true),
      )
      .buildDocument();

    assertDslMatchesNode(viaCompat, viaMainline);
  });

  it('maps linked-document helpers to explicit notification and lifecycle semantics', () => {
    const viaCompat = createCompatibilityDocument()
      .onLinkedDocGranted('linkedOrders', 'captureLinkedGranted', (steps) =>
        steps.replaceValue('MarkLinked', '/linkedGranted', true),
      )
      .onLinkedDocRejected('linkedOrders', 'captureLinkedRejected', (steps) =>
        steps.replaceValue('MarkLinkedRejected', '/linkedRejected', true),
      )
      .onLinkedDocRevoked('linkedOrders', 'captureLinkedRevoked', (steps) =>
        steps.replaceValue('MarkLinkedRevoked', '/linkedRevoked', true),
      )
      .buildDocument();

    const viaMainline = createCompatibilityDocument()
      .onEvent(
        'captureLinkedGranted',
        'MyOS/Single Document Permission Granted',
        (steps) => steps.replaceValue('MarkLinked', '/linkedGranted', true),
      )
      .onLinkedAccessRejected(
        'linkedOrders',
        'captureLinkedRejected',
        (steps) =>
          steps.replaceValue('MarkLinkedRejected', '/linkedRejected', true),
      )
      .onLinkedAccessRevoked('linkedOrders', 'captureLinkedRevoked', (steps) =>
        steps.replaceValue('MarkLinkedRevoked', '/linkedRevoked', true),
      )
      .buildDocument();

    assertDslMatchesNode(viaCompat, viaMainline);
  });

  it('materializes linked-document and linked-documents lifecycle helper event types explicitly', () => {
    const json = createCompatibilityDocument()
      .onLinkedDocGranted('linkedOrders', 'captureLinkedGranted', (steps) =>
        steps.replaceValue('MarkLinked', '/linkedGranted', true),
      )
      .onLinkedDocRejected('linkedOrders', 'captureLinkedRejected', (steps) =>
        steps.replaceValue('MarkLinkedRejected', '/linkedRejected', true),
      )
      .onLinkedDocRevoked('linkedOrders', 'captureLinkedRevoked', (steps) =>
        steps.replaceValue('MarkLinkedRevoked', '/linkedRevoked', true),
      )
      .buildJson();

    expect(json.contracts).toMatchObject({
      captureLinkedGranted: {
        event: {
          type: 'MyOS/Single Document Permission Granted',
        },
      },
      captureLinkedRejected: {
        event: {
          type: 'MyOS/Linked Documents Permission Rejected',
        },
      },
      captureLinkedRevoked: {
        event: {
          type: 'MyOS/Linked Documents Permission Revoked',
        },
      },
    });
  });
});

function createCompatibilityDocument() {
  return DocBuilder.doc()
    .name('Compat aliases')
    .channel('ownerChannel')
    .access('orders')
    .targetSessionId('SESSION_1')
    .onBehalfOf('ownerChannel')
    .read(true)
    .done()
    .accessLinked('linkedOrders')
    .targetSessionId('SESSION_1')
    .onBehalfOf('ownerChannel')
    .link('primary')
    .read(true)
    .done()
    .done()
    .ai('assistant')
    .sessionId('SESSION_1')
    .permissionFrom('ownerChannel')
    .task('summarize')
    .instruction('Summarize the latest update')
    .expects('Conversation/Response')
    .done()
    .done();
}
