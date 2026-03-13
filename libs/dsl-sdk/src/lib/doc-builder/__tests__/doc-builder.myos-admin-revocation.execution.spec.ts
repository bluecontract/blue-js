import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';
import { toOfficialJson, toOfficialYaml } from '../../core/serialization.js';

describe('doc-builder MyOS admin revocation scenario', () => {
  it('tracks subscription activation and revocation state changes', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Subscription Revocation Listener')
      .field('/subscriptionStatus', 'idle')
      .field('/currentTargetSessionId', null)
      .field('/revocationReason', null)
      .field('/revocationTargetSessionId', null)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .myOsAdmin('myOsAdminChannel')
      .operation('subscribeToTarget')
      .channel('ownerChannel')
      .request({
        targetSessionId: {
          type: 'Text',
        },
      })
      .description('Target session id')
      .steps((steps) =>
        steps
          .emitType(
            'EmitSubscriptionRequest',
            'MyOS/Subscribe to Session Requested',
            (payload) => {
              payload.putExpression(
                'targetSessionId',
                'event.message.request.targetSessionId',
              );
              payload.put('subscription', {
                id: 'revocation-test',
              });
            },
          )
          .replaceExpression(
            'StoreSubscriptionTarget',
            '/currentTargetSessionId',
            'event.message.request.targetSessionId',
          )
          .replaceValue('SetPending', '/subscriptionStatus', 'pending'),
      )
      .done()
      .onEvent(
        'markSubscriptionActive',
        'MyOS/Subscription to Session Initiated',
        (steps) =>
          steps.replaceValue('SetActive', '/subscriptionStatus', 'active'),
      )
      .onEvent(
        'recordSubscriptionRevoked',
        'MyOS/Subscription to Session Revoked',
        (steps) =>
          steps
            .replaceValue('SetRevoked', '/subscriptionStatus', 'revoked')
            .replaceExpression(
              'StoreReason',
              '/revocationReason',
              'event.reason',
            )
            .replaceExpression(
              'StoreRevokedTarget',
              '/revocationTargetSessionId',
              'event.targetSessionId',
            ),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`markSubscriptionActive:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`recordSubscriptionRevoked:
    type: Conversation/Sequential Workflow`);

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'revocation listener initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'subscribeToTarget',
      request: {
        targetSessionId: 'target-session-1',
      },
      timelineId: 'owner-timeline',
      allowNewerVersion: false,
      documentBlueId,
    });
    const afterSubscribe = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'subscribeToTarget operation failed',
    );
    const afterSubscribeJson = toOfficialJson(afterSubscribe.document);
    expect(afterSubscribeJson.subscriptionStatus).toBe('pending');
    expect(afterSubscribeJson.currentTargetSessionId).toBe('target-session-1');
    const triggeredTypes = afterSubscribe.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(triggeredTypes).toContain('MyOS/Subscribe to Session Requested');
  });
});
