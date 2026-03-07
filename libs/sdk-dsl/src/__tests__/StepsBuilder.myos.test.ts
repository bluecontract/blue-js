/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderMyOsDslParityTest.java
*/

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
              grantSessionSubscriptionOnResult: true,
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
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.grantSessionSubscriptionOnResult?.getValue(),
    ).toBe(true);

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
});
