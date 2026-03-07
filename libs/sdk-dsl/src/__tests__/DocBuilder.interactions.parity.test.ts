/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderInteractionsDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderMyOsDslParityTest.java
*/

import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import { assertDslMatchesYaml } from './dsl-parity';

describe('DocBuilder interactions parity', () => {
  it('builds access permission lifecycle and subscription parity', () => {
    const built = DocBuilder.doc()
      .name('Access parity')
      .channel('ownerChannel')
      .field('/catalogSessionId', 'session-catalog-1')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .read(true)
      .operations('search', 'getDetails')
      .requestPermissionOnInit()
      .subscribeAfterGranted()
      .subscriptionEvents('MyOS/Session Epoch Advanced')
      .statusPath('/catalog/status')
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Access parity
catalogSessionId: session-catalog-1
catalog:
  status: pending
contracts:
  ownerChannel:
    type: Core/Channel
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
    description: The standard, required operation for MyOS Admin to deliver events.
    channel: myOsAdminChannel
    request:
      type: List
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    description: Implementation that re-emits the provided events
    operation: myOsAdminUpdate
    steps:
      - name: EmitAdminEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  accessCATALOGRequestPermission:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: RequestSingleDocumentPermission
        type: Conversation/Trigger Event
        event:
          type: MyOS/Single Document Permission Grant Requested
          onBehalfOf: ownerChannel
          requestId: REQ_ACCESS_CATALOG
          targetSessionId: "\${document('/catalogSessionId')}"
          permissions:
            type: MyOS/Single Document Permission Set
            read: true
            singleOps:
              - search
              - getDetails
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  accessCATALOGGranted:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Granted
      inResponseTo:
        requestId: REQ_ACCESS_CATALOG
    steps:
      - name: MarkAccessGranted
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /catalog/status
            val: granted
      - name: SubscribeToGrantedSession
        type: Conversation/Trigger Event
        event:
          type: MyOS/Subscribe to Session Requested
          targetSessionId: "\${document('/catalogSessionId')}"
          subscription:
            id: SUB_ACCESS_CATALOG
            events:
              - type: MyOS/Session Epoch Advanced
  accessCATALOGRejected:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Rejected
      inResponseTo:
        requestId: REQ_ACCESS_CATALOG
    steps:
      - name: MarkAccessRejected
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /catalog/status
            val: rejected
  accessCATALOGRevoked:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Revoked
      inResponseTo:
        requestId: REQ_ACCESS_CATALOG
    steps:
      - name: MarkAccessRevoked
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /catalog/status
            val: revoked
  accessCATALOGSubscriptionReady:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription to Session Initiated
      subscriptionId: SUB_ACCESS_CATALOG
    steps:
      - name: MarkAccessSubscribed
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /catalog/status
            val: subscribed
  accessCATALOGSubscriptionFailed:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription to Session Failed
      subscriptionId: SUB_ACCESS_CATALOG
    steps:
      - name: MarkAccessSubscriptionFailed
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /catalog/status
            val: subscription-failed
`,
    );
  });

  it('supports access event and doc-change permission timings', () => {
    const onEvent = DocBuilder.doc()
      .name('Access event timing')
      .channel('ownerChannel')
      .field('/targetSessionId', 'session-4')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
      .onBehalfOf('ownerChannel')
      .requestPermissionOnEvent('MyOS/Single Document Permission Granted')
      .done()
      .buildDocument();

    expect(
      onEvent
        .getContracts()
        ?.accessCATALOGRequestPermission?.getProperties()
        ?.channel?.getValue(),
    ).toBe('triggeredEventChannel');
    expect(
      onEvent
        .getContracts()
        ?.accessCATALOGRequestPermission?.getProperties()
        ?.event?.getType()
        ?.getBlueId(),
    ).toBe(myOsBlueIds['MyOS/Single Document Permission Granted']);

    const onDocChange = DocBuilder.doc()
      .name('Access doc-change timing')
      .channel('ownerChannel')
      .field('/targetSessionId', 'session-5')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
      .onBehalfOf('ownerChannel')
      .requestPermissionOnDocChange('/status')
      .done()
      .buildDocument();

    expect(
      onDocChange
        .getContracts()
        ?.accessCATALOGRequestPermissionDocUpdateChannel?.getType(),
    ).toBeDefined();
    expect(
      onDocChange
        .getContracts()
        ?.accessCATALOGRequestPermissionDocUpdateChannel?.getProperties()
        ?.path?.getValue(),
    ).toBe('/status');
    expect(
      onDocChange
        .getContracts()
        ?.accessCATALOGRequestPermission?.getProperties()
        ?.channel?.getValue(),
    ).toBe('accessCATALOGRequestPermissionDocUpdateChannel');
  });

  it('builds linked access permission lifecycle parity', () => {
    const built = DocBuilder.doc()
      .name('Linked access parity')
      .channel('ownerChannel')
      .field('/projectSessionId', 'session-project-1')
      .accessLinked('projectData')
      .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
      .onBehalfOf('ownerChannel')
      .statusPath('/projectData/status')
      .link('invoices')
      .read(true)
      .operations('list', 'get')
      .done()
      .link('shipments')
      .operations('track')
      .done()
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Linked access parity
projectSessionId: session-project-1
projectData:
  status: pending
contracts:
  ownerChannel:
    type: Core/Channel
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
    description: The standard, required operation for MyOS Admin to deliver events.
    channel: myOsAdminChannel
    request:
      type: List
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    description: Implementation that re-emits the provided events
    operation: myOsAdminUpdate
    steps:
      - name: EmitAdminEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  linkedAccessPROJECTDATARequestPermission:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: RequestLinkedDocumentsPermission
        type: Conversation/Trigger Event
        event:
          type: MyOS/Linked Documents Permission Grant Requested
          onBehalfOf: ownerChannel
          requestId: REQ_LINKED_ACCESS_PROJECTDATA
          targetSessionId: "\${document('/projectSessionId')}"
          links:
            type: MyOS/Linked Documents Permission Set
            invoices:
              read: true
              singleOps:
                - list
                - get
            shipments:
              singleOps:
                - track
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  linkedAccessPROJECTDATAGranted:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Linked Documents Permission Granted
      inResponseTo:
        requestId: REQ_LINKED_ACCESS_PROJECTDATA
    steps:
      - name: MarkLinkedAccessGranted
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /projectData/status
            val: granted
  linkedAccessPROJECTDATARejected:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Linked Documents Permission Rejected
      inResponseTo:
        requestId: REQ_LINKED_ACCESS_PROJECTDATA
    steps:
      - name: MarkLinkedAccessRejected
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /projectData/status
            val: rejected
  linkedAccessPROJECTDATARevoked:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Linked Documents Permission Revoked
      inResponseTo:
        requestId: REQ_LINKED_ACCESS_PROJECTDATA
    steps:
      - name: MarkLinkedAccessRevoked
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /projectData/status
            val: revoked
`,
    );
  });

  it('builds agency permission lifecycle parity', () => {
    const built = DocBuilder.doc()
      .name('Agency parity')
      .channel('ownerChannel')
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .allowedTypes('Integer', 'Conversation/Response')
      .allowedOperations('propose', 'accept')
      .statusPath('/agency/status')
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      built,
      `
name: Agency parity
agency:
  status: pending
contracts:
  ownerChannel:
    type: Core/Channel
  myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
  myOsAdminUpdate:
    type: Conversation/Operation
    description: The standard, required operation for MyOS Admin to deliver events.
    channel: myOsAdminChannel
    request:
      type: List
  myOsAdminUpdateImpl:
    type: Conversation/Sequential Workflow Operation
    description: Implementation that re-emits the provided events
    operation: myOsAdminUpdate
    steps:
      - name: EmitAdminEvents
        type: Conversation/JavaScript Code
        code: "return { events: event.message.request };"
  workerAgency:
    type: MyOS/MyOS Worker Agency
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  agencyPROCUREMENTRequestPermission:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: RequestWorkerAgencyPermission
        type: Conversation/Trigger Event
        event:
          type: MyOS/Worker Agency Permission Grant Requested
          onBehalfOf: ownerChannel
          requestId: REQ_AGENCY_PROCUREMENT
          allowedWorkerAgencyPermissions:
            - type: MyOS/Worker Agency Permission
              workerType:
                type: Integer
              permissions:
                type: MyOS/Single Document Permission Set
                singleOps:
                  - propose
                  - accept
            - type: MyOS/Worker Agency Permission
              workerType:
                type: Conversation/Response
              permissions:
                type: MyOS/Single Document Permission Set
                singleOps:
                  - propose
                  - accept
  triggeredEventChannel:
    type: Core/Triggered Event Channel
  agencyPROCUREMENTGranted:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Worker Agency Permission Granted
      inResponseTo:
        requestId: REQ_AGENCY_PROCUREMENT
    steps:
      - name: MarkAgencyGranted
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /agency/status
            val: granted
  agencyPROCUREMENTRejected:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Worker Agency Permission Rejected
      inResponseTo:
        requestId: REQ_AGENCY_PROCUREMENT
    steps:
      - name: MarkAgencyRejected
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /agency/status
            val: rejected
  agencyPROCUREMENTRevoked:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Worker Agency Permission Revoked
      inResponseTo:
        requestId: REQ_AGENCY_PROCUREMENT
    steps:
      - name: MarkAgencyRevoked
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /agency/status
            val: revoked
`,
    );
  });

  it('supports manual access steps and omits unsupported grantSessionSubscriptionOnResult', () => {
    const built = DocBuilder.doc()
      .name('Access manual parity')
      .channel('ownerChannel')
      .field('/catalogSessionId', 'session-catalog-2')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .subscribeToCreatedSessions(true)
      .requestPermissionManually()
      .done()
      .operation('activate')
      .channel('ownerChannel')
      .steps((steps) =>
        steps
          .access('catalog')
          .requestPermission('RequestCatalogPermission')
          .access('catalog')
          .call('search', DocBuilder.expr('event.message.request'))
          .access('catalog')
          .subscribe('SubscribeCatalog')
          .access('catalog')
          .revokePermission('RevokeCatalogPermission'),
      )
      .done()
      .buildDocument();

    expect(
      built.getContracts()?.accessCATALOGRequestPermission,
    ).toBeUndefined();

    const steps =
      built.getContracts()?.activateImpl?.getProperties()?.steps?.getItems() ??
      [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Single Document Permission Grant Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()
        ?.grantSessionSubscriptionOnResult,
    ).toBeUndefined();

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.operation?.getValue(),
    ).toBe('search');

    expect(steps[2]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(
      steps[2]
        ?.getProperties()
        ?.event?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_ACCESS_CATALOG');

    expect(steps[3]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Single Document Permission Revoke Requested'],
    );
    expect(
      steps[3]?.getProperties()?.event?.getProperties()?.targetSessionId,
    ).toBeUndefined();
    expect(
      steps[3]?.getProperties()?.event?.getProperties()?.onBehalfOf,
    ).toBeUndefined();
  });

  it('supports manual agency steps with runtime-correct worker-session payloads', () => {
    const built = DocBuilder.doc()
      .name('Agency manual parity')
      .channel('ownerChannel')
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .allowedOperations('propose')
      .requestPermissionManually()
      .done()
      .operation('start')
      .channel('ownerChannel')
      .steps((steps) =>
        steps
          .viaAgency('procurement')
          .requestPermission('RequestProcurement')
          .viaAgency('procurement')
          .startSession(
            'StartPurchase',
            {
              name: 'Purchase',
            },
            (bindings) =>
              bindings
                .bindFromCurrentDoc('buyerChannel', 'ownerChannel')
                .bind('sellerChannel', 'vendor@example.com'),
            (options) =>
              options
                .defaultMessage('Negotiation started')
                .capabilities((caps) => caps.participantsOrchestration(true)),
          ),
      )
      .done()
      .buildDocument();

    expect(
      built.getContracts()?.agencyPROCUREMENTRequestPermission,
    ).toBeUndefined();

    const steps =
      built.getContracts()?.startImpl?.getProperties()?.steps?.getItems() ?? [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Worker Agency Permission Grant Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_AGENCY_PROCUREMENT');

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Start Worker Session Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.onBehalfOf?.getValue(),
    ).toBe('ownerChannel');
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.document?.getName(),
    ).toBe('Purchase');
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.channelBindings?.getProperties()
        ?.buyerChannel?.getValue(),
    ).toBe("${document('/contracts/ownerChannel')}");
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.channelBindings?.getProperties()
        ?.sellerChannel?.getProperties()
        ?.email?.getValue(),
    ).toBe('vendor@example.com');
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.initialMessages?.getProperties()
        ?.defaultMessage?.getValue(),
    ).toBe('Negotiation started');
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.capabilities?.getProperties()
        ?.participantsOrchestration?.getValue(),
    ).toBe(true);
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.config,
    ).toBeUndefined();
  });

  it('tracks contracts generated by interaction builders in sections', () => {
    const built = DocBuilder.doc()
      .name('Section tracking parity')
      .section('capabilities', 'Capabilities', 'Generated contracts')
      .channel('ownerChannel')
      .field('/targetSessionId', 'session-77')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
      .onBehalfOf('ownerChannel')
      .done()
      .accessLinked('projectData')
      .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
      .onBehalfOf('ownerChannel')
      .link('invoices')
      .read(true)
      .done()
      .done()
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .done()
      .endSection()
      .buildDocument();

    const relatedContracts = built
      .getContracts()
      ?.capabilities?.getProperties()
      ?.relatedContracts?.getItems()
      ?.map((item) => item.getValue());

    expect(relatedContracts).toEqual(
      expect.arrayContaining([
        'myOsAdminChannel',
        'myOsAdminUpdate',
        'myOsAdminUpdateImpl',
        'accessCATALOGRequestPermission',
        'linkedAccessPROJECTDATARequestPermission',
        'agencyPROCUREMENTRequestPermission',
        'workerAgency',
      ]),
    );
  });

  it('supports agency doc-change permission timing', () => {
    const built = DocBuilder.doc()
      .name('Agency doc-change timing')
      .channel('ownerChannel')
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .requestPermissionOnDocChange('/status')
      .done()
      .buildDocument();

    expect(
      built
        .getContracts()
        ?.agencyPROCUREMENTRequestPermissionDocUpdateChannel?.getType(),
    ).toBeDefined();
    expect(
      built
        .getContracts()
        ?.agencyPROCUREMENTRequestPermissionDocUpdateChannel?.getProperties()
        ?.path?.getValue(),
    ).toBe('/status');
    expect(
      built
        .getContracts()
        ?.agencyPROCUREMENTRequestPermission?.getProperties()
        ?.channel?.getValue(),
    ).toBe('agencyPROCUREMENTRequestPermissionDocUpdateChannel');
  });

  it('fails fast for invalid linked access and unknown access or agency step helpers', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Invalid linked access')
        .channel('ownerChannel')
        .field('/projectSessionId', 'session-project-2')
        .accessLinked('projectData')
        .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
        .onBehalfOf('ownerChannel')
        .done()
        .buildDocument(),
    ).toThrow(
      "accessLinked('projectData'): at least one link(...) is required",
    );

    expect(() =>
      DocBuilder.doc()
        .name('Unknown access')
        .operation('run')
        .channel('ownerChannel')
        .steps((steps) => steps.access('missing').call('x', null))
        .done()
        .buildDocument(),
    ).toThrow(
      'Unknown access: \'missing\'. Define it with .access("missing")...done().',
    );

    expect(() =>
      DocBuilder.doc()
        .name('Unknown agency')
        .operation('run')
        .channel('ownerChannel')
        .steps((steps) => steps.viaAgency('missing').requestPermission())
        .done()
        .buildDocument(),
    ).toThrow(
      'Unknown agency: \'missing\'. Define it with .agency("missing")...done().',
    );
  });
});
