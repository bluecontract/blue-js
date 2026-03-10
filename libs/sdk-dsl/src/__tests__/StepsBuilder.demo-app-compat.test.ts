import { MyOsPermissions, StepsBuilder, nodeToAliasJson } from '../lib';

describe('StepsBuilder demo-app compatibility helpers', () => {
  it('MyOsPermissions maps demo-app write(...) to runtime-correct share and preserves explicit empty singleOps', () => {
    expect(
      MyOsPermissions.create()
        .read(true)
        .write(false)
        .allOps(true)
        .singleOps(' increment ', '', undefined, 'decrement')
        .build(),
    ).toEqual({
      read: true,
      share: false,
      allOps: true,
      singleOps: ['increment', 'decrement'],
    });

    expect(
      MyOsPermissions.create().singleOps('one').singleOps().build(),
    ).toEqual({
      singleOps: [],
    });
  });

  it('requestSingleDocPermission accepts MyOsPermissions compatibility output', () => {
    const [step] = new StepsBuilder()
      .myOs()
      .requestSingleDocPermission(
        'ownerChannel',
        'REQ_1',
        'SESSION_1',
        MyOsPermissions.create()
          .read(true)
          .write(true)
          .singleOps('sync')
          .build(),
      )
      .build();

    expect(nodeToAliasJson(step!)).toMatchObject({
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

  it('subscribeToSessionWithMatchers aliases subscribeToSessionRequested with matcher arrays', () => {
    const viaCompat = new StepsBuilder()
      .myOs()
      .subscribeToSessionWithMatchers(
        'SESSION_1',
        'SUB_1',
        [
          'Conversation/Response',
          {
            type: 'Common/Named Event',
            name: 'assistant-approved',
          },
        ],
        {
          requestId: 'REQ_SUB',
        },
      )
      .build()
      .map((step) => nodeToAliasJson(step));

    const viaMainline = new StepsBuilder()
      .myOs()
      .subscribeToSessionRequested('SESSION_1', 'SUB_1', {
        requestId: 'REQ_SUB',
        events: [
          'Conversation/Response',
          {
            type: 'Common/Named Event',
            name: 'assistant-approved',
          },
        ],
      })
      .build()
      .map((step) => nodeToAliasJson(step));

    expect(viaCompat).toEqual(viaMainline);
    expect(viaCompat[0]).toMatchObject({
      event: {
        type: 'MyOS/Subscribe to Session Requested',
        targetSessionId: 'SESSION_1',
        subscription: {
          id: 'SUB_1',
        },
      },
    });
  });
});
