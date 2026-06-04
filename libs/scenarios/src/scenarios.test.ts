import { generateKeyPairSync, sign } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { BlueNode } from '@blue-labs/language';

import {
  bool,
  createScenarioRuntime,
  eventNode,
  integer,
  list,
  obj,
  operation,
  operationRequestEvent,
  processEvent,
  putPath,
  requireEventType,
  sessionValue,
  startDocument,
  startResource,
  text,
  typeName,
  typeValue,
  valueAt,
  yamlResource,
  type ScenarioRuntime,
  type ScenarioSession,
} from './support.js';

const SCENARIO_TEST_TIMEOUT_MS = 15_000;

describe('blue-scenarios parity', { timeout: SCENARIO_TEST_TIMEOUT_MS }, () => {
  it('runs the counter scenario', async () => {
    const runtime = createScenarioRuntime();
    const session = await startResource(
      runtime,
      'counter',
      'Counter',
      'scenarios/counter.yaml',
    );

    await operation(runtime, session, 'incrementer', 'increment', integer(1));
    await operation(runtime, session, 'incrementer', 'increment', integer(1));
    await operation(runtime, session, 'decrementer', 'decrement', integer(1));

    expect(sessionValue(session, '/counter')).toBe(1);
  });

  it('runs the paynote authorization/capture scenario', async () => {
    const runtime = createScenarioRuntime();
    const session = await startResource(
      runtime,
      'paynote-auth-capture',
      'PayNote Authorization Capture',
      'scenarios/paynote-authorization-capture.yaml',
    );

    expect(sessionValue(session, '/status')).toBe('Authorization requested');

    const captured = await operation(
      runtime,
      session,
      'alice',
      'approveCapture',
    );

    expect(sessionValue(session, '/status')).toBe('Capture requested');
    expect(sessionValue(session, '/captureRequested')).toBe(true);
    requireEventType(
      runtime,
      captured.triggeredEvents,
      'PayNote/Capture Funds Requested',
      'paynote capture',
    );
  });

  it('runs repository workflow representatives', async () => {
    const runtime = createScenarioRuntime();

    const change = await startResource(
      runtime,
      'change-workflow',
      'Change Workflow BEX',
      'scenarios/repository-workflows/change-workflow-bex.yaml',
    );
    await operation(
      runtime,
      change,
      'actor',
      'change',
      changeRequest('changed', 'changedSection', 'changedMarker'),
    );
    expect(sessionValue(change, '/targetState')).toBe('changed');
    expect(sessionValue(change, '/contracts/changedMarker/marker')).toBe(
      'changed',
    );
    expect(
      typeName(
        runtime,
        change.current.document.getAsNode('/contracts/changedSection'),
      ),
    ).toBe('Workflows/Document Section');

    const propose = await startResource(
      runtime,
      'propose-change-workflow',
      'Propose Change Workflow BEX',
      'scenarios/repository-workflows/propose-change-workflow-bex.yaml',
    );
    await operation(
      runtime,
      propose,
      'actor',
      'proposeChange',
      changeRequest('proposed', 'proposedSection', 'proposedMarker'),
    );
    expect(sessionValue(propose, '/targetState')).toBe('original');
    expect(sessionValue(propose, '/proposedChange/summary')).toBe(
      'Apply proposed',
    );
    expect(sessionValue(propose, '/proposedChange/changeset/0/val')).toBe(
      'proposed',
    );

    const accept = await startResource(
      runtime,
      'accept-change-workflow',
      'Accept Change Workflow BEX',
      'scenarios/repository-workflows/accept-change-workflow-bex.yaml',
    );
    await operation(runtime, accept, 'actor', 'acceptChange');
    expect(sessionValue(accept, '/targetState')).toBe('accepted');
    expect(sessionValue(accept, '/proposedChange')).toBeUndefined();
    expect(sessionValue(accept, '/contracts/acceptedMarker/marker')).toBe(
      'accepted',
    );

    const reject = await startResource(
      runtime,
      'reject-change-workflow',
      'Reject Change Workflow BEX',
      'scenarios/repository-workflows/reject-change-workflow-bex.yaml',
    );
    await operation(runtime, reject, 'actor', 'rejectChange');
    expect(sessionValue(reject, '/targetState')).toBe('original');
    expect(sessionValue(reject, '/proposedChange')).toBeUndefined();

    const consent = await startResource(
      runtime,
      'customer-consent',
      'Customer Consent BEX',
      'scenarios/repository-workflows/customer-consent-bex.yaml',
    );
    expect(sessionValue(consent, '/consentStatus')).toBe('granted');
    const revoked = await operation(
      runtime,
      consent,
      'granter',
      'revokeConsent',
      obj({
        reason: text('customer requested revocation'),
        revokedAt: text('2026-05-27T12:00:00Z'),
      }),
    );
    expect(sessionValue(consent, '/consentStatus')).toBe('revoked');
    expect(sessionValue(consent, '/revocationReason')).toBe(
      'customer requested revocation',
    );
    requireEventType(
      runtime,
      revoked.triggeredEvents,
      'Coordination/Customer Consent Revoked',
      'customer consent',
    );
  });

  it('runs PayNote BEX workflow representatives', async () => {
    const runtime = createScenarioRuntime();

    const paynote = await startResource(
      runtime,
      'paynote-main',
      'PayNote BEX',
      'scenarios/paynote-bex-workflows/paynote-bex.yaml',
    );
    expect(sessionValue(paynote, '/status')).toBe('Pending');
    expect(numberAt(paynote, '/amount/finalResolved')).toBe(0);
    expect(numberAt(paynote, '/amount/secured')).toBe(0);
    expect(sessionValue(paynote, '/controls/completionLocked')).toBe(false);

    const initiated = await operation(
      runtime,
      paynote,
      'guarantor',
      'recordTransactionInitiated',
      eventNode('PayNote/Transaction Initiated', {
        transactionId: text('txn-100'),
        processor: text('processor-a'),
        amountMinor: integer(15000),
      }),
    );
    expect(sessionValue(paynote, '/status')).toBe('Initiated');
    expect(sessionValue(paynote, '/transactionDetails/transactionId')).toBe(
      'txn-100',
    );
    requireEventType(
      runtime,
      initiated.triggeredEvents,
      'PayNote/Transaction Initiated',
      'paynote initiated',
    );

    const payee = await operation(
      runtime,
      paynote,
      'guarantor',
      'confirmPayeeAssignment',
      eventNode('PayNote/Payee Assignment Confirmed', {
        payeeRef: text('merchant-a'),
      }),
    );
    expect(sessionValue(paynote, '/transactionDetails/payeeRef')).toBe(
      'merchant-a',
    );
    requireEventType(
      runtime,
      payee.triggeredEvents,
      'PayNote/Payee Assignment Confirmed',
      'paynote payee',
    );

    const updated = await operation(
      runtime,
      paynote,
      'guarantor',
      'confirmTransactionDetailsUpdated',
      eventNode('PayNote/Transaction Details Updated', {
        transactionDetails: obj({
          processorStatus: text('matched'),
          acquirerReference: text('arn-1'),
        }),
      }),
    );
    expect(sessionValue(paynote, '/transactionDetails/transactionId')).toBe(
      'txn-100',
    );
    expect(sessionValue(paynote, '/transactionDetails/processorStatus')).toBe(
      'matched',
    );
    requireEventType(
      runtime,
      updated.triggeredEvents,
      'PayNote/Transaction Details Updated',
      'paynote details',
    );

    const rejected = await operation(
      runtime,
      paynote,
      'guarantor',
      'rejectPayNote',
      eventNode('PayNote/PayNote Rejected', {
        reason: text('payer declined'),
      }),
    );
    expect(sessionValue(paynote, '/status')).toBe('Rejected');
    requireEventType(
      runtime,
      rejected.triggeredEvents,
      'PayNote/PayNote Rejected',
      'paynote rejected',
    );

    await runPaynoteDelivery(runtime);
    await runPaymentMandate(runtime);
  });

  it('runs MyOS BEX workflow representatives', async () => {
    const runtime = createScenarioRuntime();
    await runMyOsAdmin(runtime);
    await runMyOsBootstrap(runtime);
    await runSingleDocumentGrantToAccount(runtime);
    await runSingleDocumentGrantToDocument(runtime);
    await runLinkedDocumentsGrantToAccount(runtime);
    await runLinkedDocumentsGrantToDocument(runtime);
    await runWorkerAgencyGrant(runtime);
  });

  it('runs the reseller package scenario', async () => {
    const runtime = createScenarioRuntime();

    const hotelAgreement = await startResource(
      runtime,
      'hotel-agreement-a',
      'Hotel Agreement',
      'scenarios/reseller-package/hotel-agreement.yaml',
    );
    const restaurantAgreement = await startResource(
      runtime,
      'restaurant-agreement-a',
      'Restaurant Agreement',
      'scenarios/reseller-package/restaurant-agreement.yaml',
    );
    expect(sessionValue(hotelAgreement, '/status')).toBe('active');
    expect(sessionValue(restaurantAgreement, '/status')).toBe('active');

    const packageOrder = await startResource(
      runtime,
      'package-order-a',
      'Package Order',
      'scenarios/reseller-package/package-order.yaml',
    );
    await operation(runtime, packageOrder, 'investor', 'confirmOrder');
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachPaymentToken',
      obj({ paymentToken: text('customer-checkout-token-a') }),
    );

    const customerPayNote = await startResource(
      runtime,
      'customer-paynote-a',
      'Customer Package PayNote',
      'scenarios/reseller-package/customer-paynote.yaml',
    );
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachPayNote',
      customerPayNote.current.document.clone(),
    );

    const secureFundsEvent = nextOperationEvent(
      runtime,
      customerPayNote,
      'card-processor',
      'secureFunds',
    );
    await processEvent(
      runtime,
      customerPayNote,
      secureFundsEvent,
      'secureFunds standalone PayNote',
    );
    await processEvent(
      runtime,
      packageOrder,
      secureFundsEvent,
      'secureFunds package',
    );
    expect(sessionValue(customerPayNote, '/status')).toBe('Secured');
    expect(
      sessionValue(packageOrder, '/embeddedDocs/packagePayNote/status'),
    ).toBe('Secured');

    const authorizations = createCustomerAuthorizations();
    const hotelOrder = await startAuthorizedOrder(
      runtime,
      'hotel-order-package-order-a',
      'Hotel Component Order',
      'scenarios/reseller-package/hotel-order.yaml',
      authorizations.hotel,
    );
    const restaurantOrder = await startAuthorizedOrder(
      runtime,
      'restaurant-order-package-order-a',
      'Restaurant Component Order',
      'scenarios/reseller-package/restaurant-order.yaml',
      authorizations.restaurant,
    );

    await operation(
      runtime,
      hotelOrder,
      'hotel',
      'attachPaymentToken',
      obj({ paymentToken: text('hotel-payment-token-a') }),
    );
    await operation(
      runtime,
      restaurantOrder,
      'restaurant',
      'attachPaymentToken',
      obj({ paymentToken: text('restaurant-payment-token-a') }),
    );

    await operation(
      runtime,
      customerPayNote,
      'investor',
      'attachHotelOrderToPayNote',
      hotelOrder.current.document.clone(),
    );
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachHotelOrder',
      hotelOrder.current.document.clone(),
    );
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachHotelOrderToPayNote',
      hotelOrder.current.document.clone(),
    );
    await operation(
      runtime,
      customerPayNote,
      'investor',
      'attachRestaurantOrderToPayNote',
      restaurantOrder.current.document.clone(),
    );
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachRestaurantOrder',
      restaurantOrder.current.document.clone(),
    );
    await operation(
      runtime,
      packageOrder,
      'investor',
      'attachRestaurantOrderToPayNote',
      restaurantOrder.current.document.clone(),
    );

    const hotelConfirm = nextOperationEvent(
      runtime,
      hotelOrder,
      'hotel',
      'confirmOrder',
    );
    const hotelOrderResult = await processEvent(
      runtime,
      hotelOrder,
      hotelConfirm,
      'hotel confirm standalone',
    );
    expect(
      hasConversationEvent(
        hotelOrderResult.triggeredEvents,
        'Order Confirmed',
        'hotel',
      ),
    ).toBe(true);
    await processEvent(
      runtime,
      customerPayNote,
      hotelConfirm,
      'hotel confirm PayNote',
    );
    await processEvent(
      runtime,
      packageOrder,
      hotelConfirm,
      'hotel confirm package',
    );

    const restaurantConfirm = nextOperationEvent(
      runtime,
      restaurantOrder,
      'restaurant',
      'confirmOrder',
    );
    const restaurantOrderResult = await processEvent(
      runtime,
      restaurantOrder,
      restaurantConfirm,
      'restaurant confirm standalone',
    );
    expect(
      hasConversationEvent(
        restaurantOrderResult.triggeredEvents,
        'Order Confirmed',
        'restaurant',
      ),
    ).toBe(true);
    await processEvent(
      runtime,
      customerPayNote,
      restaurantConfirm,
      'restaurant confirm PayNote',
    );
    await processEvent(
      runtime,
      packageOrder,
      restaurantConfirm,
      'restaurant confirm package',
    );
    expect(sessionValue(customerPayNote, '/captureRequested')).toBe(true);
    expect(
      sessionValue(
        packageOrder,
        '/embeddedDocs/packagePayNote/captureRequested',
      ),
    ).toBe(true);

    const confirmCapture = nextOperationEvent(
      runtime,
      customerPayNote,
      'card-processor',
      'confirmCapture',
    );
    await processEvent(
      runtime,
      customerPayNote,
      confirmCapture,
      'confirmCapture PayNote',
    );
    await processEvent(
      runtime,
      packageOrder,
      confirmCapture,
      'confirmCapture package',
    );
    expect(sessionValue(customerPayNote, '/captured')).toBe(true);

    const hotelMerchantPayNote = await startMerchantPayNote(
      runtime,
      'hotel-merchant-paynote-a',
      'Investor To Hotel PayNote',
      'scenarios/reseller-package/hotel-merchant-paynote.yaml',
      hotelOrder.current.document.clone(),
    );
    const restaurantMerchantPayNote = await startMerchantPayNote(
      runtime,
      'restaurant-merchant-paynote-a',
      'Investor To Restaurant PayNote',
      'scenarios/reseller-package/restaurant-merchant-paynote.yaml',
      restaurantOrder.current.document.clone(),
    );

    const invalidHotelFulfillment = nextOperationEvent(
      runtime,
      hotelOrder,
      'hotel',
      'confirm',
      invalidAuthorizationRequest(
        authorizations.hotel,
        authorizations.restaurant.signature,
      ),
    );
    const rejectedHotelMerchant = await processEvent(
      runtime,
      hotelMerchantPayNote,
      invalidHotelFulfillment,
      'invalid hotel fulfillment merchant PayNote',
    );
    expect(
      hasConversationEvent(
        rejectedHotelMerchant.triggeredEvents,
        'Hotel Check-In Confirmed',
        'hotel',
      ),
    ).toBe(false);
    expect(
      hasEventType(
        runtime,
        rejectedHotelMerchant.triggeredEvents,
        'PayNote/Capture Funds Requested',
      ),
    ).toBe(false);

    const hotelFulfillment = nextOperationEvent(
      runtime,
      hotelOrder,
      'hotel',
      'confirm',
      authorizationRequest(authorizations.hotel),
    );
    const hotelFulfillmentOrder = await processEvent(
      runtime,
      hotelOrder,
      hotelFulfillment,
      'hotel fulfillment standalone',
    );
    expect(
      hasConversationEvent(
        hotelFulfillmentOrder.triggeredEvents,
        'Hotel Check-In Confirmed',
        'hotel',
      ),
    ).toBe(true);
    await processEvent(
      runtime,
      packageOrder,
      hotelFulfillment,
      'hotel fulfillment package',
    );
    const hotelMerchantCaptureRequest = await processEvent(
      runtime,
      hotelMerchantPayNote,
      hotelFulfillment,
      'hotel fulfillment merchant PayNote',
    );
    requireEventType(
      runtime,
      hotelMerchantCaptureRequest.triggeredEvents,
      'PayNote/Capture Funds Requested',
      'hotel merchant capture',
    );

    const hotelMerchantCaptured = await operation(
      runtime,
      hotelMerchantPayNote,
      'card-processor',
      'confirmCapture',
    );
    requireEventType(
      runtime,
      hotelMerchantCaptured.triggeredEvents,
      'PayNote/Payment Completed',
      'hotel merchant completed',
    );

    const restaurantFulfillment = nextOperationEvent(
      runtime,
      restaurantOrder,
      'restaurant',
      'confirm',
      authorizationRequest(authorizations.restaurant),
    );
    const restaurantFulfillmentOrder = await processEvent(
      runtime,
      restaurantOrder,
      restaurantFulfillment,
      'restaurant fulfillment standalone',
    );
    expect(
      hasConversationEvent(
        restaurantFulfillmentOrder.triggeredEvents,
        'Restaurant Visit Confirmed',
        'restaurant',
      ),
    ).toBe(true);
    await processEvent(
      runtime,
      packageOrder,
      restaurantFulfillment,
      'restaurant fulfillment package',
    );
    const restaurantMerchantCaptureRequest = await processEvent(
      runtime,
      restaurantMerchantPayNote,
      restaurantFulfillment,
      'restaurant fulfillment merchant PayNote',
    );
    requireEventType(
      runtime,
      restaurantMerchantCaptureRequest.triggeredEvents,
      'PayNote/Capture Funds Requested',
      'restaurant merchant capture',
    );

    const restaurantMerchantCaptured = await operation(
      runtime,
      restaurantMerchantPayNote,
      'card-processor',
      'confirmCapture',
    );
    requireEventType(
      runtime,
      restaurantMerchantCaptured.triggeredEvents,
      'PayNote/Payment Completed',
      'restaurant merchant completed',
    );
  });
});

async function runPaynoteDelivery(runtime: ScenarioRuntime): Promise<void> {
  const accepted = await startResource(
    runtime,
    'paynote-delivery-accepted',
    'PayNote Delivery BEX',
    'scenarios/paynote-bex-workflows/paynote-delivery-bex.yaml',
  );
  expect(sessionValue(accepted, '/transactionIdentificationStatus')).toBe(
    'pending',
  );
  expect(sessionValue(accepted, '/clientDecisionStatus')).toBe('pending');

  const identified = await operation(
    runtime,
    accepted,
    'paynote-deliverer',
    'updateTransactionIdentificationStatus',
    bool(true),
  );
  expect(sessionValue(accepted, '/transactionIdentificationStatus')).toBe(
    'identified',
  );
  expect(statusType(runtime, accepted, '/deliveryStatus')).toBe(
    'Coordination/Status In Progress',
  );
  requireEventType(
    runtime,
    identified.triggeredEvents,
    'PayNote/Transaction Identified',
    'delivery identified',
  );

  const clientAccepted = await operation(
    runtime,
    accepted,
    'paynote-deliverer',
    'acceptPayNote',
    obj({ acceptedAt: text('2026-05-27T10:15:00Z') }),
  );
  expect(sessionValue(accepted, '/clientDecisionStatus')).toBe('accepted');
  expect(sessionValue(accepted, '/clientAcceptedAt')).toBe(
    '2026-05-27T10:15:00Z',
  );
  expect(statusType(runtime, accepted, '/deliveryStatus')).toBe(
    'Coordination/Status Completed',
  );
  requireEventType(
    runtime,
    clientAccepted.triggeredEvents,
    'PayNote/PayNote Accepted By Client',
    'delivery accepted',
  );
  requireEventType(
    runtime,
    clientAccepted.triggeredEvents,
    'Coordination/Document Bootstrap Requested',
    'delivery bootstrap',
  );

  const discarded = await startResource(
    runtime,
    'paynote-delivery-discarded',
    'PayNote Delivery BEX discarded',
    'scenarios/paynote-bex-workflows/paynote-delivery-bex.yaml',
  );
  const rejectedTooEarly = await operation(
    runtime,
    discarded,
    'paynote-deliverer',
    'rejectPayNote',
    obj({
      reason: text('client said no'),
      rejectedAt: text('2026-05-27T10:20:00Z'),
    }),
  );
  expect(sessionValue(discarded, '/clientDecisionStatus')).toBe('pending');
  requireEventType(
    runtime,
    rejectedTooEarly.triggeredEvents,
    'PayNote/PayNote Client Decision Discarded',
    'delivery discarded',
  );
  expect(
    hasEventReason(
      rejectedTooEarly.triggeredEvents,
      'Transaction not identified',
    ),
  ).toBe(true);

  const failed = await operation(
    runtime,
    discarded,
    'paynote-deliverer',
    'updateTransactionIdentificationStatus',
    bool(false),
  );
  expect(sessionValue(discarded, '/transactionIdentificationStatus')).toBe(
    'failed',
  );
  expect(sessionValue(discarded, '/deliveryError')).toBe(
    'Transaction identification failed',
  );
  requireEventType(
    runtime,
    failed.triggeredEvents,
    'PayNote/Transaction Identification Failed',
    'delivery failed',
  );

  const deliveryError = await operation(
    runtime,
    discarded,
    'paynote-deliverer',
    'reportDeliveryError',
    text('issuer network unavailable'),
  );
  expect(sessionValue(discarded, '/deliveryError')).toBe(
    'issuer network unavailable',
  );
  requireEventType(
    runtime,
    deliveryError.triggeredEvents,
    'PayNote/PayNote Delivery Failed',
    'delivery error',
  );
}

async function runPaymentMandate(runtime: ScenarioRuntime): Promise<void> {
  const mandate = await startResource(
    runtime,
    'payment-mandate',
    'Payment Mandate BEX',
    'scenarios/paynote-bex-workflows/payment-mandate-bex.yaml',
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(0);
  expect(numberAt(mandate, '/amountCaptured')).toBe(0);

  const approved = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'authorizeSpend',
    authorizationRequest(
      'auth-1',
      15000,
      'USD',
      'merchantId',
      'merchant-a',
      'authorize_and_capture',
      '2026-05-27T10:30:00Z',
    ),
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(15000);
  expect(
    sessionValue(mandate, '/chargeAttempts/auth-1/authorizationStatus'),
  ).toBe('approved');
  expect(
    hasEventStatus(
      runtime,
      approved.triggeredEvents,
      'PayNote/Payment Mandate Spend Authorization Responded',
      'approved',
    ),
  ).toBe(true);

  const duplicate = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'authorizeSpend',
    authorizationRequest(
      'auth-1',
      5000,
      'USD',
      'merchantId',
      'merchant-a',
      'authorize_only',
      '2026-05-27T10:31:00Z',
    ),
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(15000);
  expect(
    hasEventStatus(
      runtime,
      duplicate.triggeredEvents,
      'PayNote/Payment Mandate Spend Authorization Responded',
      'approved',
    ),
  ).toBe(true);

  const overLimit = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'authorizeSpend',
    authorizationRequest(
      'auth-2',
      6000,
      'USD',
      'merchantId',
      'merchant-a',
      'authorize_only',
      '2026-05-27T10:32:00Z',
    ),
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(15000);
  expect(
    sessionValue(mandate, '/chargeAttempts/auth-2/authorizationStatus'),
  ).toBe('rejected');
  expect(
    hasEventReason(overLimit.triggeredEvents, 'Mandate amount limit exceeded.'),
  ).toBe(true);

  const settled = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'settleSpend',
    settlementRequest(
      'auth-1',
      'settle-1',
      'succeeded',
      -15000,
      15000,
      'hold-1',
      'txn-100',
      '2026-05-27T10:40:00Z',
      '',
    ),
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(0);
  expect(numberAt(mandate, '/amountCaptured')).toBe(15000);
  expect(sessionValue(mandate, '/chargeAttempts/auth-1/settled')).toBe(true);
  expect(
    hasEventStatus(
      runtime,
      settled.triggeredEvents,
      'PayNote/Payment Mandate Spend Settlement Responded',
      'accepted',
    ),
  ).toBe(true);

  const repeated = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'settleSpend',
    settlementRequest(
      'auth-1',
      'settle-1-repeat',
      'succeeded',
      -15000,
      15000,
      'hold-1',
      'txn-100',
      '2026-05-27T10:41:00Z',
      '',
    ),
  );
  expect(numberAt(mandate, '/amountReserved')).toBe(0);
  expect(numberAt(mandate, '/amountCaptured')).toBe(15000);
  expect(
    hasEventReason(repeated.triggeredEvents, 'Authorization already settled.'),
  ).toBe(true);

  const unknown = await operation(
    runtime,
    mandate,
    'mandate-guarantor',
    'settleSpend',
    settlementRequest(
      'missing-auth',
      'settle-missing',
      'succeeded',
      0,
      100,
      'hold-missing',
      'txn-missing',
      '2026-05-27T10:42:00Z',
      '',
    ),
  );
  expect(
    hasEventReason(unknown.triggeredEvents, 'Authorization is not approved.'),
  ).toBe(true);
}

async function runMyOsAdmin(runtime: ScenarioRuntime): Promise<void> {
  const session = await startResource(
    runtime,
    'myos-admin-base',
    'MyOS Admin Base BEX',
    'scenarios/myos-bex-workflows/myos-admin-base-bex.yaml',
  );
  const result = await operation(
    runtime,
    session,
    'myOsAdmin',
    'myOsAdminUpdate',
    list([
      eventNode('MyOS/Call Operation Accepted', {
        targetSessionId: text('target-a'),
        operation: text('sync'),
      }),
      eventNode('MyOS/Call Operation Failed', {
        targetSessionId: text('target-b'),
        operation: text('sync'),
        reason: text('permission_denied'),
      }),
    ]),
  );
  requireEventType(
    runtime,
    result.triggeredEvents,
    'MyOS/Call Operation Accepted',
    'admin accepted',
  );
  requireEventType(
    runtime,
    result.triggeredEvents,
    'MyOS/Call Operation Failed',
    'admin failed',
  );
  const empty = await operation(
    runtime,
    session,
    'myOsAdmin',
    'myOsAdminUpdate',
    list([]),
  );
  expect(empty.triggeredEvents).toHaveLength(0);
}

async function runMyOsBootstrap(runtime: ScenarioRuntime): Promise<void> {
  const session = await startResource(
    runtime,
    'document-session-bootstrap',
    'Document Session Bootstrap BEX',
    'scenarios/myos-bex-workflows/document-session-bootstrap-bex.yaml',
  );
  expect(statusType(runtime, session, '/bootstrapStatus')).toBe(
    'Coordination/Status In Progress',
  );

  await adminEvents(
    runtime,
    session,
    eventNode('MyOS/Participant Resolved', {
      channelName: text('buyer'),
      participant: obj({
        status: obj({ accountStatus: text('Active') }),
      }),
    }),
  );
  expect(sessionValue(session, '/participantsState/buyer/accountStatus')).toBe(
    'Active',
  );

  await adminEvents(
    runtime,
    session,
    eventNode('MyOS/Participant Resolved', {
      channelName: text('seller'),
      participant: obj({ status: obj({}) }),
    }),
  );
  expect(sessionValue(session, '/participantsState/seller/accountStatus')).toBe(
    'Unknown',
  );

  const started = await adminEvents(
    runtime,
    session,
    eventNode('MyOS/Target Document Session Started', {
      initiatorSessionIds: list([text('session-1'), text('session-2')]),
    }),
  );
  expect(sessionValue(session, '/initiatorSessionIds/0')).toBe('session-1');
  requireEventType(
    runtime,
    started.triggeredEvents,
    'Coordination/Status Change',
    'bootstrap status',
  );

  const failed = await adminEvents(
    runtime,
    session,
    eventNode('MyOS/Bootstrap Failed', {
      reason: text('provider unavailable'),
    }),
  );
  expect(sessionValue(session, '/bootstrapError')).toBe('provider unavailable');
  requireEventType(
    runtime,
    failed.triggeredEvents,
    'Coordination/Status Change',
    'bootstrap failed status',
  );

  await adminEvents(
    runtime,
    session,
    eventNode('Coordination/Status Change', {
      status: statusNode('Coordination/Status Failed', 'terminated'),
    }),
  );
  expect(statusType(runtime, session, '/bootstrapStatus')).toBe(
    'Coordination/Status Failed',
  );
}

async function runSingleDocumentGrantToAccount(
  runtime: ScenarioRuntime,
): Promise<void> {
  const valid = await startResource(
    runtime,
    'single-account-valid',
    'Single Document Grant To Account BEX',
    'scenarios/myos-bex-workflows/single-document-permission-grant-to-account-bex.yaml',
  );
  requireEventType(
    runtime,
    valid.current.triggeredEvents,
    'MyOS/Single Document Permission Validated',
    'single account valid',
  );
  const revoke = await operation(
    runtime,
    valid,
    'grantee',
    'revoke',
    text('no longer needed'),
  );
  requireEventType(
    runtime,
    revoke.triggeredEvents,
    'MyOS/Single Document Permission Revoke Requested',
    'single account revoke',
  );
  expect(hasEventReason(revoke.triggeredEvents, 'no longer needed')).toBe(true);

  const invalid = await startVariant(
    runtime,
    'single-account-invalid',
    'scenarios/myos-bex-workflows/single-document-permission-grant-to-account-bex.yaml',
    (doc) => {
      putPath(doc, '/permissions/read', bool(false));
      putPath(doc, '/permissions/allOps', bool(true));
    },
  );
  requireEventType(
    runtime,
    invalid.current.triggeredEvents,
    'MyOS/Single Document Permission Invalid',
    'single account invalid',
  );
  expect(
    hasIssueContaining(
      invalid.current.triggeredEvents,
      'permissions.read must be true',
    ),
  ).toBe(true);
}

async function runSingleDocumentGrantToDocument(
  runtime: ScenarioRuntime,
): Promise<void> {
  const valid = await startResource(
    runtime,
    'single-document-valid',
    'Single Document Grant To Document BEX',
    'scenarios/myos-bex-workflows/single-document-permission-grant-to-document-bex.yaml',
  );
  requireEventType(
    runtime,
    valid.current.triggeredEvents,
    'MyOS/Single Document Permission Validated',
    'single document valid',
  );
  const revoke = await operation(
    runtime,
    valid,
    'granter',
    'revoke',
    text('document rotated'),
  );
  requireEventType(
    runtime,
    revoke.triggeredEvents,
    'MyOS/Single Document Permission Revoke Requested',
    'single document revoke',
  );

  const invalid = await startVariant(
    runtime,
    'single-document-invalid',
    'scenarios/myos-bex-workflows/single-document-permission-grant-to-document-bex.yaml',
    (doc) => {
      putPath(doc, '/granteeDocumentId', text(''));
      putPath(doc, '/permissions/singleOps/1', text(''));
    },
  );
  requireEventType(
    runtime,
    invalid.current.triggeredEvents,
    'MyOS/Single Document Permission Invalid',
    'single document invalid',
  );
  expect(
    hasIssueContaining(invalid.current.triggeredEvents, 'granteeDocumentId'),
  ).toBe(true);

  const skipped = await startVariant(
    runtime,
    'single-document-skip',
    'scenarios/myos-bex-workflows/single-document-permission-grant-to-document-bex.yaml',
    (doc) => putPath(doc, '/skipValidation', bool(true)),
  );
  expect(
    hasEventType(
      runtime,
      skipped.current.triggeredEvents,
      'MyOS/Single Document Permission Validated',
    ),
  ).toBe(false);
  expect(
    hasEventType(
      runtime,
      skipped.current.triggeredEvents,
      'MyOS/Single Document Permission Invalid',
    ),
  ).toBe(false);
}

async function runLinkedDocumentsGrantToAccount(
  runtime: ScenarioRuntime,
): Promise<void> {
  const valid = await startResource(
    runtime,
    'linked-account-valid',
    'Linked Documents Grant To Account BEX',
    'scenarios/myos-bex-workflows/linked-documents-permission-grant-to-account-bex.yaml',
  );
  requireEventType(
    runtime,
    valid.current.triggeredEvents,
    'MyOS/Linked Documents Permission Validated',
    'linked account valid',
  );
  const revoke = await operation(
    runtime,
    valid,
    'granter',
    'revoke',
    text('anchor removed'),
  );
  requireEventType(
    runtime,
    revoke.triggeredEvents,
    'MyOS/Linked Documents Permission Revoke Requested',
    'linked account revoke',
  );

  const invalid = await startVariant(
    runtime,
    'linked-account-invalid',
    'scenarios/myos-bex-workflows/linked-documents-permission-grant-to-account-bex.yaml',
    (doc) => {
      putPath(doc, '/links/invoice/read', bool(false));
      putPath(doc, '/links/invoice/allOps', bool(true));
      putPath(doc, '/links/invoice/singleOps/1', text(''));
    },
  );
  requireEventType(
    runtime,
    invalid.current.triggeredEvents,
    'MyOS/Linked Documents Permission Invalid',
    'linked account invalid',
  );
  expect(
    hasIssueContaining(invalid.current.triggeredEvents, 'read must be true'),
  ).toBe(true);
}

async function runLinkedDocumentsGrantToDocument(
  runtime: ScenarioRuntime,
): Promise<void> {
  const valid = await startResource(
    runtime,
    'linked-document-valid',
    'Linked Documents Grant To Document BEX',
    'scenarios/myos-bex-workflows/linked-documents-permission-grant-to-document-bex.yaml',
  );
  requireEventType(
    runtime,
    valid.current.triggeredEvents,
    'MyOS/Linked Documents Permission Validated',
    'linked document valid',
  );
  const revoke = await operation(
    runtime,
    valid,
    'granter',
    'revoke',
    text('document revoked'),
  );
  requireEventType(
    runtime,
    revoke.triggeredEvents,
    'MyOS/Linked Documents Permission Revoke Requested',
    'linked document revoke',
  );

  const invalid = await startVariant(
    runtime,
    'linked-document-invalid',
    'scenarios/myos-bex-workflows/linked-documents-permission-grant-to-document-bex.yaml',
    (doc) => {
      putPath(doc, '/granteeDocumentId', text(''));
      putPath(doc, '/links/invoice/singleOps/1', text(''));
    },
  );
  requireEventType(
    runtime,
    invalid.current.triggeredEvents,
    'MyOS/Linked Documents Permission Invalid',
    'linked document invalid',
  );
  expect(
    hasIssueContaining(invalid.current.triggeredEvents, 'granteeDocumentId'),
  ).toBe(true);

  const skipped = await startVariant(
    runtime,
    'linked-document-skip',
    'scenarios/myos-bex-workflows/linked-documents-permission-grant-to-document-bex.yaml',
    (doc) => putPath(doc, '/skipValidation', bool(true)),
  );
  expect(
    hasEventType(
      runtime,
      skipped.current.triggeredEvents,
      'MyOS/Linked Documents Permission Validated',
    ),
  ).toBe(false);
  expect(
    hasEventType(
      runtime,
      skipped.current.triggeredEvents,
      'MyOS/Linked Documents Permission Invalid',
    ),
  ).toBe(false);
}

async function runWorkerAgencyGrant(runtime: ScenarioRuntime): Promise<void> {
  const valid = await startResource(
    runtime,
    'worker-valid',
    'Worker Agency Grant BEX',
    'scenarios/myos-bex-workflows/worker-agency-permission-grant-bex.yaml',
  );
  requireEventType(
    runtime,
    valid.current.triggeredEvents,
    'MyOS/Worker Agency Permission Validated',
    'worker valid',
  );
  const revoke = await operation(
    runtime,
    valid,
    'granter',
    'revoke',
    text('agency disabled'),
  );
  requireEventType(
    runtime,
    revoke.triggeredEvents,
    'MyOS/Worker Agency Permission Revoke Requested',
    'worker revoke',
  );

  const invalid = await startVariant(
    runtime,
    'worker-invalid',
    'scenarios/myos-bex-workflows/worker-agency-permission-grant-bex.yaml',
    (doc) =>
      putPath(
        doc,
        '/allowedWorkerAgencyPermissions/1',
        obj({
          workerType: text('EmailAssistant'),
          permissions: obj({
            read: bool(false),
            allOps: bool(true),
            singleOps: list([text('draft')]),
          }),
        }),
      ),
  );
  requireEventType(
    runtime,
    invalid.current.triggeredEvents,
    'MyOS/Worker Agency Permission Invalid',
    'worker invalid',
  );
  expect(
    hasIssueContaining(invalid.current.triggeredEvents, 'duplicate workerType'),
  ).toBe(true);
}

function changeRequest(
  targetValue: string,
  sectionKey: string,
  markerKey: string,
): BlueNode {
  return obj({
    summary: text(`Apply ${targetValue}`),
    changeset: list([patch('replace', '/targetState', text(targetValue))]),
    sectionChanges: obj({
      add: list([
        obj({
          sectionKey: text(sectionKey),
          section: obj({ title: text(`Section ${targetValue}`) }),
          contracts: obj({
            [markerKey]: markerContract(targetValue),
          }),
        }),
      ]),
    }),
  });
}

function markerContract(markerValue: string): BlueNode {
  return eventNode('Workflows/Document Section', {
    kind: text('workflow proof marker'),
    marker: text(markerValue),
  });
}

function patch(op: string, path: string, val: BlueNode): BlueNode {
  return obj({ op: text(op), path: text(path), val });
}

function settlementRequest(
  authorizationId: string,
  settlementId: string,
  status: string,
  reservedDeltaMinor: number,
  capturedDeltaMinor: number,
  holdId: string,
  transactionId: string,
  settledAt: string,
  reason: string,
): BlueNode {
  return eventNode('PayNote/Payment Mandate Spend Settled', {
    authorizationId: text(authorizationId),
    settlementId: text(settlementId),
    status: text(status),
    reservedDeltaMinor: integer(reservedDeltaMinor),
    capturedDeltaMinor: integer(capturedDeltaMinor),
    holdId: text(holdId),
    transactionId: text(transactionId),
    settledAt: text(settledAt),
    reason: text(reason),
  });
}

function statusNode(qualifiedType: string, mode: string): BlueNode {
  return obj({ mode: text(mode) }).setType(typeValue(qualifiedType));
}

async function adminEvents(
  runtime: ScenarioRuntime,
  session: ScenarioSession,
  ...events: BlueNode[]
) {
  return operation(
    runtime,
    session,
    'myOsAdmin',
    'myOsAdminUpdate',
    list(events),
  );
}

async function startVariant(
  runtime: ScenarioRuntime,
  sessionId: string,
  resource: string,
  mutator: (document: BlueNode) => void,
): Promise<ScenarioSession> {
  const document = yamlResource(runtime, resource);
  mutator(document);
  return startDocument(runtime, sessionId, sessionId, document);
}

interface OrderAuthorization {
  readonly publicKey: string;
  readonly customerId: string;
  readonly orderKind: string;
  readonly orderSessionId: string;
  readonly nonce: string;
  readonly expires: number;
  readonly signature: string;
}

interface CustomerAuthorizations {
  readonly publicKey: string;
  readonly hotel: OrderAuthorization;
  readonly restaurant: OrderAuthorization;
}

function createCustomerAuthorizations(): CustomerAuthorizations {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyText = rawEd25519PublicKey(
    publicKey.export({
      format: 'der',
      type: 'spki',
    }),
  );
  const hotel = createOrderAuthorization(
    privateKey,
    publicKeyText,
    'hotel',
    'hotel-order-package-order-a',
    'hotel-fulfillment-nonce-a',
  );
  const restaurant = createOrderAuthorization(
    privateKey,
    publicKeyText,
    'restaurant',
    'restaurant-order-package-order-a',
    'restaurant-fulfillment-nonce-a',
  );
  return { publicKey: publicKeyText, hotel, restaurant };
}

function createOrderAuthorization(
  privateKey: Parameters<typeof sign>[2],
  publicKey: string,
  orderKind: string,
  orderSessionId: string,
  nonce: string,
): OrderAuthorization {
  const customerId = 'customer-a-uid';
  const expires = 1000;
  const message = fulfillmentMessage(
    orderKind,
    orderSessionId,
    customerId,
    nonce,
    expires,
  );
  const signature = sign(
    null,
    Buffer.from(message, 'utf8'),
    privateKey,
  ).toString('base64url');
  return {
    publicKey,
    customerId,
    orderKind,
    orderSessionId,
    nonce,
    expires,
    signature,
  };
}

function rawEd25519PublicKey(der: Buffer): string {
  return der.subarray(der.length - 32).toString('base64url');
}

function fulfillmentMessage(
  orderKind: string,
  orderSessionId: string,
  customerId: string,
  nonce: string,
  expires: number,
): string {
  return `action=component.fulfillment.confirm
orderKind=${orderKind}
orderSessionId=${orderSessionId}
customerId=${customerId}
nonce=${nonce}
expires=${expires}`;
}

async function startAuthorizedOrder(
  runtime: ScenarioRuntime,
  sessionId: string,
  label: string,
  resourcePath: string,
  authorization: OrderAuthorization,
): Promise<ScenarioSession> {
  const document = yamlResource(runtime, resourcePath);
  putPath(
    document,
    '/customerAuthorization/customerId',
    text(authorization.customerId),
  );
  putPath(
    document,
    '/customerAuthorization/publicKey',
    text(authorization.publicKey),
  );
  return startDocument(runtime, sessionId, label, document);
}

async function startMerchantPayNote(
  runtime: ScenarioRuntime,
  sessionId: string,
  label: string,
  resourcePath: string,
  orderSnapshot: BlueNode,
): Promise<ScenarioSession> {
  const document = yamlResource(runtime, resourcePath);
  putPath(document, '/embeddedDocs/order', orderSnapshot);
  return startDocument(runtime, sessionId, label, document);
}

function authorizationRequest(authorization: OrderAuthorization): BlueNode;
function authorizationRequest(
  authorizationId: string,
  amountMinor: number,
  currency: string,
  counterpartyType: string,
  counterpartyId: string,
  chargeMode: string,
  requestedAt: string,
): BlueNode;
function authorizationRequest(
  first: OrderAuthorization | string,
  amountMinor?: number,
  currency?: string,
  counterpartyType?: string,
  counterpartyId?: string,
  chargeMode?: string,
  requestedAt?: string,
): BlueNode {
  if (typeof first !== 'string') {
    return obj({
      customerId: text(first.customerId),
      nonce: text(first.nonce),
      expires: integer(first.expires),
      signature: text(first.signature),
    });
  }
  return eventNode('PayNote/Payment Mandate Spend Authorization Requested', {
    authorizationId: text(first),
    amountMinor: integer(required(amountMinor)),
    currency: text(required(currency)),
    counterpartyType: text(required(counterpartyType)),
    counterpartyId: text(required(counterpartyId)),
    chargeMode: text(required(chargeMode)),
    requestedAt: text(required(requestedAt)),
  });
}

function invalidAuthorizationRequest(
  authorization: OrderAuthorization,
  wrongSignature: string,
): BlueNode {
  return obj({
    customerId: text(authorization.customerId),
    nonce: text(authorization.nonce),
    expires: integer(authorization.expires),
    signature: text(wrongSignature),
  });
}

function nextOperationEvent(
  runtime: ScenarioRuntime,
  session: ScenarioSession,
  timelineId: string,
  operationName: string,
  request: BlueNode = new BlueNode(),
): BlueNode {
  return operationRequestEvent(
    runtime,
    timelineId,
    operationName,
    request,
    session.nextTimestamp++,
  );
}

function hasEventType(
  runtime: ScenarioRuntime,
  events: readonly BlueNode[],
  expectedType: string,
): boolean {
  return events.some((event) => typeName(runtime, event) === expectedType);
}

function hasEventStatus(
  runtime: ScenarioRuntime,
  events: readonly BlueNode[],
  expectedType: string,
  expectedStatus: string,
): boolean {
  return events.some(
    (event) =>
      typeName(runtime, event) === expectedType &&
      valueAt(event, '/status') === expectedStatus,
  );
}

function hasEventReason(
  events: readonly BlueNode[],
  expectedReason: string,
): boolean {
  return events.some((event) => valueAt(event, '/reason') === expectedReason);
}

function hasIssueContaining(
  events: readonly BlueNode[],
  expectedFragment: string,
): boolean {
  return events.some((event) => {
    const issues = valueAt(event, '/issues');
    if (Array.isArray(issues)) {
      return issues.some((issue) => String(issue).includes(expectedFragment));
    }
    if (issues instanceof BlueNode) {
      return (issues.getItems() ?? []).some((issue) =>
        String(issue.getValue() ?? issue).includes(expectedFragment),
      );
    }
    return false;
  });
}

function hasConversationEvent(
  events: readonly BlueNode[],
  kind: string,
  orderKind: string,
): boolean {
  return events.some(
    (event) =>
      valueAt(event, '/kind') === kind &&
      valueAt(event, '/orderKind') === orderKind,
  );
}

function statusType(
  runtime: ScenarioRuntime,
  session: ScenarioSession,
  path: string,
): string {
  const node = session.current.document.getAsNode(path);
  return typeName(runtime, node);
}

function numberAt(session: ScenarioSession, path: string): number | undefined {
  const value = sessionValue(session, path);
  return typeof value === 'number' ? value : undefined;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Missing required scenario value');
  }
  return value;
}
