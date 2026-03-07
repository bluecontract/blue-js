/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderMyOsDslParityTest.java
*/

import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder, StepsBuilder } from '../lib';

describe('StepsBuilder MyOS helpers', () => {
  it('builds runtime-correct MyOS request events', () => {
    const built = DocBuilder.doc()
      .name('MyOS step parity')
      .field('/targetSessionId', 'session-42')
      .onInit('bootstrap', (steps) =>
        steps
          .myOs()
          .singleDocumentPermissionGrantRequested(
            'ownerChannel',
            DocBuilder.expr("document('/targetSessionId')"),
            {
              type: 'MyOS/Single Document Permission Set',
              read: true,
              singleOps: ['sync'],
            },
            {
              requestId: 'REQ_1',
            },
          )
          .myOs()
          .subscribeToSessionRequested(
            DocBuilder.expr("document('/targetSessionId')"),
            'SUB_1',
            {
              requestId: 'REQ_2',
              events: [
                'MyOS/Session Epoch Advanced',
                {
                  type: 'Conversation/Response',
                  status: 'ok',
                },
              ],
            },
          )
          .myOs()
          .callOperationRequested(
            'ownerChannel',
            DocBuilder.expr("document('/targetSessionId')"),
            'sync',
            { amount: 1 },
            {
              requestId: 'REQ_3',
            },
          ),
      )
      .buildDocument();

    const steps =
      built.getContracts()?.bootstrap?.getProperties()?.steps?.getItems() ?? [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Single Document Permission Grant Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.onBehalfOf?.getValue(),
    ).toBe('ownerChannel');
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_1');
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.targetSessionId?.getValue(),
    ).toBe("${document('/targetSessionId')}");
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.permissions?.getProperties()
        ?.read?.getValue(),
    ).toBe(true);
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.permissions?.getProperties()
        ?.singleOps?.getItems()?.[0]
        ?.getValue(),
    ).toBe('sync');
    expect(
      steps[0]?.getProperties()?.event?.getProperties()
        ?.grantSessionSubscriptionOnResult,
    ).toBeUndefined();

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_2');
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_1');
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.subscription?.getProperties()
        ?.events?.getItems()?.[0]
        ?.getType()
        ?.getBlueId(),
    ).toBe(myOsBlueIds['MyOS/Session Epoch Advanced']);
    expect(
      steps[1]
        ?.getProperties()
        ?.event?.getProperties()
        ?.subscription?.getProperties()
        ?.events?.getItems()?.[1]
        ?.getProperties()
        ?.status?.getValue(),
    ).toBe('ok');

    expect(steps[2]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.onBehalfOf?.getValue(),
    ).toBe('ownerChannel');
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.operation?.getValue(),
    ).toBe('sync');
    expect(
      String(
        steps[2]
          ?.getProperties()
          ?.event?.getProperties()
          ?.request?.getProperties()
          ?.amount?.getValue(),
      ),
    ).toBe('1');
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_3');
  });

  it('omits subscribe event filters when no filters are provided and omits null call requests', () => {
    const steps = new StepsBuilder()
      .myOs()
      .subscribeToSessionRequested('session-99', 'SUB_ALL')
      .myOs()
      .callOperationRequested('ownerChannel', 'session-99', 'sync', null)
      .build();

    const subscribeEvent = steps[0]?.getProperties()?.event;
    expect(
      subscribeEvent?.getProperties()?.subscription?.getProperties()?.events,
    ).toBeUndefined();

    const callEvent = steps[1]?.getProperties()?.event;
    expect(callEvent?.getProperties()?.request).toBeUndefined();
  });

  it('builds linked-doc, revoke, worker-agency, and worker-session helpers with runtime-correct shapes', () => {
    const built = DocBuilder.doc()
      .name('MyOS stage 4 helper parity')
      .field('/targetSessionId', 'session-77')
      .onInit('bootstrap', (steps) =>
        steps
          .myOs()
          .requestLinkedDocsPermission(
            'ownerChannel',
            'REQ_LINKS',
            DocBuilder.expr("document('/targetSessionId')"),
            {
              type: 'MyOS/Linked Documents Permission Set',
              invoices: {
                read: true,
                singleOps: ['list'],
              },
            },
          )
          .myOs()
          .revokeSingleDocPermission('REQ_REVOKE_SINGLE')
          .myOs()
          .revokeLinkedDocsPermission('REQ_REVOKE_LINKS')
          .myOs()
          .grantWorkerAgencyPermission('ownerChannel', 'REQ_WORKER_GRANT', [
            {
              type: 'MyOS/Worker Agency Permission',
              workerType: {
                type: 'Conversation/Response',
              },
              permissions: {
                type: 'MyOS/Single Document Permission Set',
                singleOps: ['run'],
              },
            },
          ])
          .myOs()
          .revokeWorkerAgencyPermission('REQ_WORKER_REVOKE')
          .myOs()
          .startWorkerSession(
            'ownerChannel',
            {
              name: 'Worker Session',
            },
            {
              buyerChannel: {
                email: 'buyer@example.com',
              },
            },
            (options) =>
              options
                .defaultMessage('Started')
                .capabilities((caps) => caps.participantsOrchestration(true)),
            'StartWorker',
          ),
      )
      .buildDocument();

    const steps =
      built.getContracts()?.bootstrap?.getProperties()?.steps?.getItems() ?? [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Linked Documents Permission Grant Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_LINKS');
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.links?.getProperties()
        ?.invoices?.getProperties()
        ?.read?.getValue(),
    ).toBe(true);

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Single Document Permission Revoke Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_REVOKE_SINGLE');
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.targetSessionId,
    ).toBeUndefined();

    expect(steps[2]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Linked Documents Permission Revoke Requested'],
    );
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_REVOKE_LINKS');

    expect(steps[3]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Worker Agency Permission Grant Requested'],
    );
    expect(
      steps[3]
        ?.getProperties()
        ?.event?.getProperties()
        ?.allowedWorkerAgencyPermissions?.getItems()?.[0]
        ?.getProperties()
        ?.workerType?.getType()
        ?.getBlueId(),
    ).toBe(conversationBlueIds['Conversation/Response']);
    expect(
      steps[3]
        ?.getProperties()
        ?.event?.getProperties()
        ?.allowedWorkerAgencyPermissions?.getItems()?.[0]
        ?.getProperties()
        ?.permissions?.getProperties()
        ?.singleOps?.getItems()?.[0]
        ?.getValue(),
    ).toBe('run');

    expect(steps[4]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Worker Agency Permission Revoke Requested'],
    );
    expect(
      steps[4]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_WORKER_REVOKE');

    expect(steps[5]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      myOsBlueIds['MyOS/Start Worker Session Requested'],
    );
    expect(
      steps[5]?.getProperties()?.event?.getProperties()?.onBehalfOf?.getValue(),
    ).toBe('ownerChannel');
    expect(
      steps[5]?.getProperties()?.event?.getProperties()?.document?.getName(),
    ).toBe('Worker Session');
    expect(
      steps[5]
        ?.getProperties()
        ?.event?.getProperties()
        ?.channelBindings?.getProperties()
        ?.buyerChannel?.getProperties()
        ?.email?.getValue(),
    ).toBe('buyer@example.com');
    expect(
      steps[5]
        ?.getProperties()
        ?.event?.getProperties()
        ?.initialMessages?.getProperties()
        ?.defaultMessage?.getValue(),
    ).toBe('Started');
    expect(
      steps[5]
        ?.getProperties()
        ?.event?.getProperties()
        ?.capabilities?.getProperties()
        ?.participantsOrchestration?.getValue(),
    ).toBe(true);
  });
});
