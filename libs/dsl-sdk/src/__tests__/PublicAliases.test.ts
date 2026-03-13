import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import {
  DocBuilder,
  MyOsPermissions,
  StepsBuilder,
  toOfficialJson,
  toOfficialYaml,
} from '../index.js';
import { assertCanonicalNodeEquals } from '../test-support/editing-support.js';

describe('public convenience aliases', () => {
  it('maps marker contract wrappers to the same shapes as direct contract insertion', () => {
    const viaAliases = DocBuilder.doc()
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

    assertCanonicalNodeEquals(viaAliases, viaContracts);
  });

  it('maps document anchor and link wrappers with cumulative link insertion', () => {
    const json = toOfficialJson(
      DocBuilder.doc()
        .name('Public link helpers')
        .documentAnchors(['primary'])
        .sessionLink('sessionRef', 'primary', 'SESSION_1')
        .documentLink('documentRef', 'primary', 'DOC_1')
        .documentTypeLink(
          'typeRef',
          'primary',
          conversationBlueIds['Conversation/Event'],
        ),
    );

    expect(json).toMatchObject({
      name: 'Public link helpers',
      contracts: {
        anchors: {
          type: 'MyOS/Document Anchors',
          primary: {
            type: 'MyOS/Document Anchor',
          },
        },
        links: {
          type: 'MyOS/Document Links',
          sessionRef: {
            type: 'MyOS/MyOS Session Link',
            anchor: 'primary',
            sessionId: 'SESSION_1',
          },
          documentRef: {
            type: 'MyOS/Document Link',
            anchor: 'primary',
            documentId: 'DOC_1',
          },
          typeRef: {
            type: 'MyOS/Document Type Link',
            anchor: 'primary',
            documentType: {
              blueId: conversationBlueIds['Conversation/Event'],
            },
          },
        },
      },
    });
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

  it('maps onSessionCreated to the runtime-confirmed subscription initiated event', () => {
    const viaAliases = createPublicAliasDocument()
      .onSessionCreated('orders', 'captureSessionCreated', (steps) =>
        steps.replaceValue('MarkSession', '/sessionCreated', true),
      )
      .buildDocument();

    const viaExplicit = createPublicAliasDocument()
      .onEvent(
        'captureSessionCreated',
        'MyOS/Subscription to Session Initiated',
        (steps) => steps.replaceValue('MarkSession', '/sessionCreated', true),
      )
      .buildDocument();

    assertCanonicalNodeEquals(viaAliases, viaExplicit);
  });

  it('keeps AI response convenience listeners on the public surface', () => {
    const yaml = toOfficialYaml(
      createPublicAliasDocument()
        .onAIResponseForTask('assistant', 'handleTask', 'summarize', (steps) =>
          steps.replaceValue('MarkTask', '/taskHandled', true),
        )
        .onAINamedResponse(
          'assistant',
          'handleNamed',
          'assistant-approved',
          'summarize',
          (steps) => steps.replaceValue('MarkNamed', '/namedHandled', true),
        ),
    );

    expect(yaml).toContain('handleTask:');
    expect(yaml).toContain('taskName: summarize');
    expect(yaml).toContain('handleNamed:');
    expect(yaml).toContain('name: assistant-approved');
  });

  it('maps linked-document helpers to explicit notification and lifecycle semantics', () => {
    const viaAliases = createPublicAliasDocument()
      .onLinkedDocGranted('linkedOrders', 'captureLinkedGranted', (steps) =>
        steps.replaceValue('MarkLinked', '/linkedGranted', true),
      )
      .onLinkedDocRevoked('linkedOrders', 'captureLinkedRevoked', (steps) =>
        steps.replaceValue('MarkLinkedRevoked', '/linkedRevoked', true),
      )
      .buildDocument();

    const viaExplicit = createPublicAliasDocument()
      .onEvent(
        'captureLinkedGranted',
        'MyOS/Single Document Permission Granted',
        (steps) => steps.replaceValue('MarkLinked', '/linkedGranted', true),
      )
      .onEvent(
        'captureLinkedRevoked',
        'MyOS/Single Document Permission Revoked',
        (steps) =>
          steps.replaceValue('MarkLinkedRevoked', '/linkedRevoked', true),
      )
      .buildDocument();

    assertCanonicalNodeEquals(viaAliases, viaExplicit);
  });

  it('materializes linked-document notification helpers with explicit runtime event types', () => {
    const json = createPublicAliasDocument()
      .onLinkedDocGranted('linkedOrders', 'captureLinkedGranted', (steps) =>
        steps.replaceValue('MarkLinked', '/linkedGranted', true),
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
      captureLinkedRevoked: {
        event: {
          type: 'MyOS/Single Document Permission Revoked',
        },
      },
    });
  });

  it('keeps MyOsPermissions and request helpers aligned with public runtime semantics', () => {
    expect(
      MyOsPermissions.create()
        .read(true)
        .share(false)
        .allOps(true)
        .singleOps(' increment ', '', undefined, 'decrement')
        .build(),
    ).toEqual({
      read: true,
      share: false,
      allOps: true,
      singleOps: ['increment', 'decrement'],
    });

    const [step] = new StepsBuilder()
      .myOs()
      .requestSingleDocPermission(
        'ownerChannel',
        'REQ_1',
        'SESSION_1',
        MyOsPermissions.create()
          .read(true)
          .share(true)
          .singleOps('sync')
          .build(),
      )
      .build();

    expect(toOfficialJson(step!)).toMatchObject({
      type: 'Conversation/Trigger Event',
      event: {
        type: 'MyOS/Single Document Permission Grant Requested',
        onBehalfOf: 'ownerChannel',
        requestId: 'REQ_1',
        targetSessionId: 'SESSION_1',
        permissions: {
          read: true,
          share: true,
          singleOps: ['sync'],
        },
      },
    });
  });

  it('keeps matcher-array subscription helpers on the public surface', () => {
    const built = new StepsBuilder()
      .myOs()
      .subscribeToSessionWithMatchers('SESSION_1', 'SUB_1', [
        'Conversation/Response',
        {
          type: 'Common/Named Event',
          name: 'assistant-approved',
        },
      ])
      .build()
      .map((step) => toOfficialJson(step));

    expect(built[0]).toMatchObject({
      event: {
        type: 'MyOS/Subscribe to Session Requested',
        targetSessionId: 'SESSION_1',
        subscription: {
          id: 'SUB_1',
          events: [
            {
              type: 'Conversation/Response',
            },
            {
              type: 'Common/Named Event',
              name: 'assistant-approved',
            },
          ],
        },
      },
    });
  });
});

function createPublicAliasDocument() {
  return DocBuilder.doc()
    .name('Public aliases')
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
