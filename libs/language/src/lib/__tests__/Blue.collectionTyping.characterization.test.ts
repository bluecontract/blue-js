import { describe, expect, it } from 'vitest';
import { repository } from '@blue-repository/types';
import { Blue } from '../Blue';

function createBlue(): Blue {
  return new Blue({ repositories: [repository] });
}

function inspectRoundTrip(blue: Blue, value: unknown) {
  // This mirrors the suspicious runtime path used by JavaScript workflow steps:
  // a BlueNode is resolved, exposed to JS via nodeToJson(..., 'simple'), and any
  // returned event payload is rehydrated with jsonValueToNode(...). The LDPG bug
  // showed up exactly on that boundary, so the test keeps both checkpoints:
  // 1. whether the freshly resolved node is type-of its own type
  // 2. whether the same still holds after the simple JSON round-trip
  const resolved = blue.resolve(blue.jsonValueToNode(value));
  const resolvedType = resolved.getType();
  const simple = blue.nodeToJson(resolved, 'simple');
  const roundTripped = blue.jsonValueToNode(simple);
  const roundTrippedType = roundTripped.getType?.();

  return {
    resolvedSelfTypeOf: resolvedType
      ? blue.isTypeOfNode(resolved, resolvedType)
      : null,
    roundTrippedSelfTypeOf: roundTrippedType
      ? blue.isTypeOfNode(roundTripped, roundTrippedType)
      : null,
  };
}

describe('collection-backed Blue repository type characterization', () => {
  it('shows that the blanket dict/list hypothesis is false', () => {
    const blue = createBlue();

    // These types all include Dictionary/List-shaped payloads, but they do not
    // all behave the same. This disproves the coarse hypothesis that "any
    // dict/list field breaks typing".
    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Search Contract',
        q: ['/title'],
        kv: { region: '/region' },
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Call Operation Responded',
        inResponseTo: {
          requestId: 'req-op',
          incomingEvent: {
            type: 'Conversation/Request',
          },
        },
        events: [
          {
            type: 'Conversation/Response',
            result: 'ok',
          },
        ],
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });
  });

  it('isolates the narrower failing family around specific complex collection payloads', () => {
    const blue = createBlue();

    // These are the currently broken shapes we found during the LDPG
    // investigation. They all carry richer collection payloads, but the
    // failure is not universal across all dict/list usage.
    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Linked Documents Permission Set',
        orders: {
          read: true,
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: false,
      roundTrippedSelfTypeOf: false,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Document Links',
        shopOrdersLink: {
          sessionId: 'shop-session',
          anchor: 'orders',
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: false,
      roundTrippedSelfTypeOf: false,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'Conversation/Change Request',
        changeset: [
          {
            op: 'replace',
            path: '/title',
            val: 'Updated',
          },
        ],
      }),
    ).toEqual({
      resolvedSelfTypeOf: false,
      roundTrippedSelfTypeOf: false,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Worker Agency Permission Granting in Progress',
        inResponseTo: {
          requestId: 'req-worker',
        },
        targetAccountId: 'merchant-1',
        allowedWorkerAgencyPermissions: [
          {
            document: {
              read: true,
            },
          },
        ],
      }),
    ).toEqual({
      resolvedSelfTypeOf: false,
      roundTrippedSelfTypeOf: false,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Single Document Permission Granting in Progress',
        inResponseTo: {
          requestId: 'req-single',
        },
        targetSessionId: 'session-1',
        permissions: {
          read: true,
          singleOps: ['provideInstructions'],
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });
  });

  it('shows the current root cause around collection item/value typing', () => {
    const blue = createBlue();

    // Exact typed entries repair several failing cases. This shows the problem
    // is not "the collection itself", but how structured collection members are
    // checked against itemType/valueType.
    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Linked Documents Permission Set',
        orders: {
          type: 'MyOS/Single Document Permission Set',
          read: true,
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'Conversation/Change Request',
        changeset: [
          {
            type: 'Core/Json Patch Entry',
            op: 'replace',
            path: '/title',
            val: 'Updated',
          },
        ],
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Worker Agency Permission Granting in Progress',
        inResponseTo: {
          requestId: 'req-worker',
        },
        targetAccountId: 'merchant-1',
        allowedWorkerAgencyPermissions: [
          {
            type: 'MyOS/Worker Agency Permission',
            document: {
              read: true,
            },
          },
        ],
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Document Anchors',
        orders: {
          type: 'MyOS/Document Anchor',
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    // Document Links exposes the second bug: valueType is the base type
    // MyOS/Link, but a valid subtype entry is still rejected. This means the
    // collection matcher currently requires exact blueId equality instead of
    // accepting subtypes in valueType/itemType positions.
    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Document Links',
        shopOrdersLink: {
          type: 'MyOS/Link',
          anchor: 'orders',
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: true,
      roundTrippedSelfTypeOf: true,
    });

    expect(
      inspectRoundTrip(blue, {
        type: 'MyOS/Document Links',
        shopOrdersLink: {
          type: 'MyOS/MyOS Session Link',
          sessionId: 'shop-session',
          anchor: 'orders',
        },
      }),
    ).toEqual({
      resolvedSelfTypeOf: false,
      roundTrippedSelfTypeOf: false,
    });
  });
});
