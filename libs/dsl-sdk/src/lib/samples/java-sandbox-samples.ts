import type { BlueNode } from '@blue-labs/language';
import { DocBuilder } from '../doc-builder/doc-builder.js';
import { SimpleDocBuilder } from '../doc-builder/simple-doc-builder.js';
import { PayNotes } from '../paynote/paynotes.js';
import type { JsonObject } from '../core/types.js';
import { fromChannel } from '../steps/bootstrap-bindings.js';

export function simpleAgentWithPermissions(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Simple Permission Agent')
    .description('Requests read access to provider session on init.')
    .channel('ownerChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/providerSessionId', 'session-abc-123')
    .onInit('requestProviderAccess', (steps) =>
      steps
        .myOs()
        .requestSingleDocPermission(
          'ownerChannel',
          'REQ_PROVIDER',
          DocBuilder.expr("document('/providerSessionId')"),
          { read: true, singleOps: ['getStatus'] },
        ),
    )
    .onMyOsResponse(
      'onProviderAccessGranted',
      'MyOS/Single Document Permission Granted',
      'REQ_PROVIDER',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr("document('/providerSessionId')"),
            'SUB_PROVIDER',
          )
          .replaceValue('MarkReady', '/status', 'ready'),
    )
    .buildDocument();
}

export function agentAddsParticipantAndWaits(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Collaboration Setup Agent')
    .description('Adds Bob as participant and marks setup progress.')
    .channel('aliceChannel')
    .myOsAdmin('myOsAdminChannel')
    .onInit('addBob', (steps) =>
      steps.myOs().addParticipant('bobChannel', 'bob@gmail.com'),
    )
    .onEvent('onBobAdded', 'MyOS/Adding Participant Requested', (steps) =>
      steps.replaceValue('MarkBobAdded', '/participants/bob', 'added'),
    )
    .onEvent('onEpochAdvanced', 'MyOS/Session Epoch Advanced', (steps) =>
      steps.replaceValue('Activate', '/status', 'active'),
    )
    .buildDocument();
}

export function agentCallsRemoteOperation(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Remote Operation Caller')
    .description('Calls operation on linked session when /trigger changes.')
    .channel('ownerChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/linkedSessionId', 'session-xyz-789')
    .onDocChange('onTriggerChanged', '/trigger', (steps) =>
      steps
        .myOs()
        .callOperation(
          'ownerChannel',
          DocBuilder.expr("document('/linkedSessionId')"),
          'processData',
        ),
    )
    .onEvent('onCallQueued', 'MyOS/Call Operation Requested', (steps) =>
      steps.replaceValue('MarkQueued', '/remoteCallStatus', 'queued'),
    )
    .buildDocument();
}

export function cvClassifierAgent(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('CV Classifier Agent')
    .description('Classifies linked CVs via llm-provider.')
    .channel('recruitmentChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/llmProviderSessionId', 'session-llm-001')
    .field('/recruitmentSessionId', 'session-recruitment-001')
    .field('/cvSubscriptionId', 'SUB_CV_UPDATES')
    .onInit('requestAccess', (steps) =>
      steps
        .myOs()
        .requestSingleDocPermission(
          'recruitmentChannel',
          'REQ_RECRUITMENT_PROVIDER',
          DocBuilder.expr("document('/llmProviderSessionId')"),
          { read: true, singleOps: ['provideInstructions'] },
        )
        .myOs()
        .requestLinkedDocsPermission(
          'recruitmentChannel',
          'REQ_RECRUITMENT_CVS',
          DocBuilder.expr("document('/recruitmentSessionId')"),
          { cvs: { read: true, allOps: true } },
        ),
    )
    .onMyOsResponse(
      'onLlmProviderAccessGranted',
      'MyOS/Single Document Permission Granted',
      'REQ_RECRUITMENT_PROVIDER',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr("document('/llmProviderSessionId')"),
            'SUB_RECRUITMENT_PROVIDER',
          ),
    )
    .buildDocument();
}

export function orchestratorWithAccessAndAgency(): BlueNode {
  return DocBuilder.doc()
    .name('Procurement Orchestrator')
    .description(
      'Accesses catalog data and starts worker sessions through agency.',
    )
    .section('participants', 'Participants', 'User-facing channels')
    .channel('userChannel')
    .endSection()
    .section('state', 'State', 'Session references and tracking')
    .field('/catalogSessionId', 'session-catalog-001')
    .field('/plannerSessionId', 'session-planner-001')
    .field('/currentTask', '')
    .field('/negotiations/count', 0)
    .endSection()
    .section('capabilities', 'Capabilities', 'Access + AI + agency')
    .access('catalog')
    .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
    .onBehalfOf('userChannel')
    .read(true)
    .operations('search', 'getDetails')
    .requestPermissionOnInit()
    .subscribeAfterGranted()
    .statusPath('/catalog/status')
    .done()
    .ai('planner')
    .sessionId(DocBuilder.expr("document('/plannerSessionId')"))
    .permissionFrom('userChannel')
    .task('findBestDeal')
    .instruction('Find the best deal across catalog results.')
    .expects('Conversation/Event')
    .done()
    .done()
    .agency('procurement')
    .onBehalfOf('userChannel')
    .allowedTypes('MyOS/MyOS Admin Base')
    .allowedOperations('proposeOffer', 'accept', 'reject')
    .requestPermissionOnInit()
    .statusPath('/agency/status')
    .done()
    .endSection()
    .section('workflow', 'Workflow', 'Find, analyze, negotiate')
    .operation('findAndBuy')
    .channel('userChannel')
    .requestType(String)
    .description('Find and buy a product')
    .steps((steps) =>
      steps
        .replaceExpression('SaveTask', '/currentTask', 'event.message.request')
        .myOs()
        .callOperation(
          'userChannel',
          DocBuilder.expr("document('/catalogSessionId')"),
          'search',
          DocBuilder.expr('event.message.request'),
        ),
    )
    .done()
    .onCallResponse('catalog', 'onSearchResults', (steps) =>
      steps
        .replaceExpression(
          'SaveResults',
          '/catalog/lastResults',
          'event.message.response',
        )
        .askAI('planner', 'Analyze', (ask) =>
          ask
            .task('findBestDeal')
            .instruction("Results: ${document('/catalog/lastResults')}")
            .instruction("User wants: ${document('/currentTask')}"),
        ),
    )
    .onAINamedResponse('planner', 'onDealFound', 'deal-found', (steps) =>
      steps
        .replaceExpression('SaveDeal', '/lastDeal', 'event.update.payload')
        .viaAgency('procurement')
        .startSessionWith(
          'userChannel',
          DocBuilder.doc()
            .name('Auto-Purchase')
            .channel('buyerChannel')
            .channel('sellerChannel')
            .field('/maxPrice', DocBuilder.expr('event.update.payload.price'))
            .buildJson(),
          (bindings) =>
            bindings
              .bind('sellerChannel', {
                accountId: 'event.update.payload.vendorEmail',
              })
              .bind('buyerChannel', { accountId: 'userChannel' }),
          (options) => options.defaultMessage('Purchase negotiation started.'),
        ),
    )
    .onSessionStarted('procurement', 'onNegotiationStarted', (steps) =>
      steps.replaceExpression(
        'Track',
        '/negotiations/count',
        "document('/negotiations/count') + 1",
      ),
    )
    .endSection()
    .buildDocument();
}

export function linkedAccessMonitor(): BlueNode {
  return DocBuilder.doc()
    .name('Linked Access Monitor')
    .channel('ownerChannel')
    .field('/projectSessionId', 'session-project-99')
    .accessLinked('projectData')
    .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
    .onBehalfOf('ownerChannel')
    .link('invoices')
    .read(true)
    .operations('list', 'get')
    .done()
    .link('shipments')
    .read(true)
    .operations('track')
    .done()
    .statusPath('/projectData/status')
    .done()
    .onLinkedAccessGranted('projectData', 'onLinkedGranted', (steps) =>
      steps.replaceValue('MarkReady', '/projectData/ready', true),
    )
    .buildDocument();
}

export function simplePermissionAndSubscribe(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Weather Monitor Agent')
    .description('Requests access and subscribes to a provider session.')
    .channel('ownerChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/weatherSessionId', 'session-weather-prod')
    .field('/status', 'initializing')
    .onInit('requestWeatherAccess', (steps) =>
      steps
        .myOs()
        .requestSingleDocPermission(
          'ownerChannel',
          'REQ_WEATHER',
          DocBuilder.expr("document('/weatherSessionId')"),
          { read: true },
        ),
    )
    .onMyOsResponse(
      'onWeatherAccessGranted',
      'MyOS/Single Document Permission Granted',
      'REQ_WEATHER',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr("document('/weatherSessionId')"),
            'SUB_WEATHER',
          )
          .replaceValue('MarkSubscribing', '/status', 'subscribing'),
    )
    .onSubscriptionUpdate(
      'onWeatherReady',
      'SUB_WEATHER',
      'MyOS/Subscription to Session Initiated',
      (steps) => steps.replaceValue('MarkReady', '/status', 'monitoring'),
    )
    .buildDocument();
}

export function callRemoteOperationSample(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Data Analyzer Agent')
    .description('Calls a provider operation after permission is granted.')
    .channel('ownerChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/llmSessionId', 'session-llm-prod')
    .field('/analysisStatus', 'idle')
    .onInit('requestLlmAccess', (steps) =>
      steps
        .myOs()
        .requestSingleDocPermission(
          'ownerChannel',
          'REQ_LLM',
          DocBuilder.expr("document('/llmSessionId')"),
          { read: true, singleOps: ['provideInstructions'] },
        ),
    )
    .onMyOsResponse(
      'onLlmAccessGranted',
      'MyOS/Single Document Permission Granted',
      'REQ_LLM',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr("document('/llmSessionId')"),
            'SUB_LLM_PROVIDER',
          ),
    )
    .operation('analyze')
    .channel('ownerChannel')
    .description('Analyze input with remote provider.')
    .steps((steps) =>
      steps
        .replaceValue('MarkAnalyzing', '/analysisStatus', 'analyzing')
        .myOs()
        .callOperation(
          'ownerChannel',
          DocBuilder.expr("document('/llmSessionId')"),
          'provideInstructions',
          {
            requestId: 'REQ_ANALYZE_001',
            requester: 'DATA_ANALYZER',
            instructions: 'Analyze the provided input.',
          },
        ),
    )
    .done()
    .onEvent('onCallResponded', 'MyOS/Call Operation Responded', (steps) =>
      steps.replaceValue('MarkDone', '/analysisStatus', 'complete'),
    )
    .onEvent('onCallFailed', 'MyOS/Call Operation Failed', (steps) =>
      steps.replaceValue('MarkFailed', '/analysisStatus', 'failed'),
    )
    .buildDocument();
}

export function addParticipantsDynamically(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Team Setup Agent')
    .description('Adds participants and marks setup progress.')
    .channel('managerChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/status', 'setting-up')
    .onInit('addTeamMembers', (steps) =>
      steps
        .myOs()
        .addParticipant('aliceChannel', 'alice@company.com')
        .myOs()
        .addParticipant('bobChannel', 'bob@company.com'),
    )
    .onEvent(
      'onParticipantAdded',
      'MyOS/Adding Participant Responded',
      (steps) =>
        steps.replaceValue(
          'MarkParticipantsAdded',
          '/status',
          'participants-added',
        ),
    )
    .onEvent('onEpochAdvanced', 'MyOS/Session Epoch Advanced', (steps) =>
      steps.replaceValue('MarkReady', '/status', 'ready'),
    )
    .buildDocument();
}

export function linkedDocsWithUpdates(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Invoice Monitor Agent')
    .description('Requests linked-docs permission and tracks invoice totals.')
    .channel('accountingChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/projectSessionId', 'session-project-42')
    .field('/invoiceSubscriptionId', 'SUB_INVOICES')
    .field('/totalInvoiced', 0)
    .onInit('requestInvoiceAccess', (steps) =>
      steps
        .myOs()
        .requestLinkedDocsPermission(
          'accountingChannel',
          'REQ_INVOICES',
          DocBuilder.expr("document('/projectSessionId')"),
          { invoices: { read: true, allOps: true } },
        ),
    )
    .onMyOsResponse(
      'onInvoiceAccessGranted',
      'MyOS/Linked Documents Permission Granted',
      'REQ_INVOICES',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr('event.targetSessionId'),
            DocBuilder.expr("document('/invoiceSubscriptionId')"),
          ),
    )
    .onSubscriptionUpdate('onInvoiceUpdate', 'SUB_INVOICES', (steps) =>
      steps
        .jsRaw(
          'ProcessInvoiceUpdate',
          "const amount = Number(event.update?.amount ?? 0); const current = Number(document('/totalInvoiced') ?? 0); return { changeset: [{ op:'replace', path:'/totalInvoiced', val: current + amount }] };",
        )
        .updateDocumentFromExpression(
          'PersistInvoiceTotal',
          'steps.ProcessInvoiceUpdate.changeset',
        ),
    )
    .buildDocument();
}

export function cvClassifierFull(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Recruitment Classifier')
    .description(
      'Requests access, subscribes, and invokes provider classification.',
    )
    .channel('recruitmentChannel')
    .myOsAdmin('myOsAdminChannel')
    .field('/recruitmentSessionId', 'session-recruitment-001')
    .field('/llmProviderSessionId', 'session-llm-001')
    .field('/cvSubscriptionId', 'SUB_RECRUITMENT_CVS')
    .onInit('requestAccess', (steps) =>
      steps
        .myOs()
        .requestSingleDocPermission(
          'recruitmentChannel',
          'REQ_RECRUITMENT_PROVIDER',
          DocBuilder.expr("document('/llmProviderSessionId')"),
          { read: true, singleOps: ['provideInstructions'] },
        )
        .myOs()
        .requestLinkedDocsPermission(
          'recruitmentChannel',
          'REQ_RECRUITMENT_CVS',
          DocBuilder.expr("document('/recruitmentSessionId')"),
          { cvs: { read: true, allOps: true } },
        ),
    )
    .onMyOsResponse(
      'onCvAccessGranted',
      'MyOS/Linked Documents Permission Granted',
      'REQ_RECRUITMENT_CVS',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr('event.targetSessionId'),
            DocBuilder.expr("document('/cvSubscriptionId')"),
          ),
    )
    .onMyOsResponse(
      'onLlmProviderAccessGranted',
      'MyOS/Single Document Permission Granted',
      'REQ_RECRUITMENT_PROVIDER',
      (steps) =>
        steps
          .myOs()
          .subscribeToSession(
            DocBuilder.expr("document('/llmProviderSessionId')"),
            'SUB_RECRUITMENT_PROVIDER',
          ),
    )
    .onSubscriptionUpdate('onCvArrived', 'SUB_RECRUITMENT_CVS', (steps) =>
      steps
        .myOs()
        .callOperation(
          'recruitmentChannel',
          DocBuilder.expr("document('/llmProviderSessionId')"),
          'provideInstructions',
          {
            requestId: 'REQ_CV_CLASSIFY',
            requester: 'RECRUITMENT_CLASSIFIER',
            instructions: 'Classify candidate seniority based on CV update.',
          },
        ),
    )
    .onSubscriptionUpdate(
      'onClassificationResult',
      'SUB_RECRUITMENT_PROVIDER',
      'Conversation/Response',
      (steps) =>
        steps
          .jsRaw(
            'ProcessResult',
            "const response = event.update ?? {}; const requestId = response.inResponseTo?.requestId ?? 'unknown'; return { changeset: [{ op:'replace', path:'/lastClassificationRequestId', val: requestId }] };",
          )
          .updateDocumentFromExpression(
            'PersistResult',
            'steps.ProcessResult.changeset',
          ),
    )
    .buildDocument();
}

export function accessAndAgencyOrchestrator(): BlueNode {
  return DocBuilder.doc()
    .name('Access + Agency Orchestrator')
    .description('Uses access(), ai(), and agency() together in one flow.')
    .channel('userChannel')
    .field('/catalogSessionId', 'session-catalog-007')
    .field('/plannerSessionId', 'session-planner-007')
    .field('/lastDeal', {})
    .access('catalog')
    .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
    .onBehalfOf('userChannel')
    .read(true)
    .operations('search', 'getDetails')
    .subscribeAfterGranted()
    .statusPath('/catalog/status')
    .done()
    .ai('planner')
    .sessionId(DocBuilder.expr("document('/plannerSessionId')"))
    .permissionFrom('userChannel')
    .task('findDeal')
    .instruction('Find the best deal from provided catalog results.')
    .expects('Conversation/Event')
    .done()
    .done()
    .agency('procurement')
    .onBehalfOf('userChannel')
    .allowedTypes('MyOS/MyOS Admin Base')
    .allowedOperations('proposeOffer', 'accept')
    .statusPath('/agency/status')
    .done()
    .operation('findAndStart')
    .channel('userChannel')
    .requestType(String)
    .description('Search catalog and start worker session for negotiation.')
    .steps((steps) =>
      steps
        .myOs()
        .callOperation(
          'userChannel',
          DocBuilder.expr("document('/catalogSessionId')"),
          'search',
          DocBuilder.expr('event.message.request'),
        ),
    )
    .done()
    .onCallResponse('catalog', 'onCatalogResults', (steps) =>
      steps
        .replaceExpression(
          'SaveResults',
          '/catalog/results',
          'event.message.response',
        )
        .askAI('planner', 'Analyze', (ask) =>
          ask
            .task('findDeal')
            .instruction("Catalog results: ${document('/catalog/results')}"),
        ),
    )
    .onAINamedResponse('planner', 'onDealFound', 'deal-found', (steps) =>
      steps
        .replaceExpression('StoreDeal', '/lastDeal', 'event.update.payload')
        .viaAgency('procurement')
        .startSessionWith(
          'userChannel',
          DocBuilder.doc()
            .name('Negotiation')
            .channel('buyerChannel')
            .channel('sellerChannel')
            .field(
              '/targetPrice',
              DocBuilder.expr('event.update.payload.price'),
            )
            .buildJson(),
          (bindings) =>
            bindings
              .bind('buyerChannel', { accountId: 'userChannel' })
              .bind('sellerChannel', {
                accountId: 'event.update.payload.vendorEmail',
              }),
        ),
    )
    .onSessionStarted('procurement', 'onSessionStarted', (steps) =>
      steps.replaceValue('MarkStarted', '/negotiation/status', 'started'),
    )
    .buildDocument();
}

export function linkedAccessPermissions(): BlueNode {
  return DocBuilder.doc()
    .name('Linked Access Permissions')
    .description('Shows accessLinked() with multiple link permission blocks.')
    .channel('ownerChannel')
    .field('/projectSessionId', 'session-project-88')
    .accessLinked('projectData')
    .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
    .onBehalfOf('ownerChannel')
    .statusPath('/projectData/status')
    .link('invoices')
    .read(true)
    .operations('list', 'get')
    .done()
    .link('shipments')
    .read(true)
    .operations('track')
    .done()
    .done()
    .onLinkedAccessGranted('projectData', 'onProjectDataGranted', (steps) =>
      steps.replaceValue('MarkGranted', '/projectData/granted', true),
    )
    .onLinkedAccessRevoked('projectData', 'onProjectDataRevoked', (steps) =>
      steps.replaceValue('MarkRevoked', '/projectData/revoked', true),
    )
    .buildDocument();
}

function balancedBowlVoucherPayNoteBuilder() {
  return PayNotes.payNote('Balanced Bowl Voucher - 100 USD')
    .description(
      'Reserve voucher budget and capture spending reported by merchant monitoring.',
    )
    .currency('USD')
    .amountMinor(10_000)
    .channel('merchantChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'merchant-timeline',
    })
    .capture()
    .lockOnInit()
    .unlockOnEvent('Conversation/Event')
    .requestPartialOnOperation(
      'captureReportedSpend',
      'merchantChannel',
      'event.message.request.amount',
      'Capture reported amount.',
    )
    .done()
    .onEvent('onMonitoringApproved', 'Conversation/Event', (steps) =>
      steps.emitType('StartMonitoring', 'Conversation/Event', (payload) => {
        payload.put('merchantId', 'balanced_bowl_001');
        payload.put('scope', 'merchant-only');
        payload.put('subject', 'payeeChannel');
      }),
    );
}

function balancedBowlVoucherPayNoteTemplateJson(): JsonObject {
  return balancedBowlVoucherPayNoteBuilder().buildJson();
}

export function balancedBowlVoucherPayNoteTemplate(): BlueNode {
  return balancedBowlVoucherPayNoteBuilder().buildDocument();
}

export function armchairProtectionWithVoucherPayNoteTemplate(): BlueNode {
  return PayNotes.payNote('Armchair Protection + Voucher')
    .description(
      'Capture unlocks after buyer satisfaction, then a voucher payment is requested.',
    )
    .currency('USD')
    .amountMinor(10_000)
    .capture()
    .lockOnInit()
    .unlockOnOperation(
      'confirmSatisfaction',
      'payerChannel',
      'Buyer confirms satisfaction.',
      (steps) => steps.emitType('SatisfactionConfirmed', 'Conversation/Event'),
    )
    .done()
    .onEvent('requestVoucherPayment', 'PayNote/Funds Captured', (steps) =>
      steps.triggerPayment('VoucherCredit', 'Conversation/Event', (payload) =>
        payload
          .processor('guarantorChannel')
          .from('payeeChannel')
          .to('payerChannel')
          .currency('USD')
          .amountMinor(10_000)
          .reason('voucher-activation')
          .attachPayNote(balancedBowlVoucherPayNoteTemplateJson()),
      ),
    )
    .buildDocument();
}

export function shipmentEscrowSimple(): BlueNode {
  return PayNotes.payNote('Shipment Escrow - Simple')
    .description('Capture is locked until guarantor confirms delivery.')
    .currency('USD')
    .amountMinor(120_000)
    .channel('shipmentCompanyChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'shipment-timeline',
    })
    .capture()
    .lockOnInit()
    .unlockOnOperation(
      'confirmDelivery',
      'shipmentCompanyChannel',
      'Shipment Company confirms delivery.',
      (steps) => steps.emitType('DeliveryConfirmed', 'Conversation/Event'),
    )
    .done()
    .buildDocument();
}

export function captureTriggeredFromChannelEvent(): BlueNode {
  return PayNotes.payNote('Capture Triggered From Channel Event')
    .description(
      'Shipment channel emits shipment confirmation, then the document captures funds.',
    )
    .currency('USD')
    .amountMinor(90_000)
    .channel('shipmentCompanyChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'shipment-timeline',
    })
    .capture()
    .lockOnInit()
    .unlockOnEvent('Conversation/Event')
    .done()
    .onChannelEvent(
      'onShipmentConfirmed',
      'shipmentCompanyChannel',
      'Conversation/Event',
      (steps) => steps.emitType('DeliveryConfirmed', 'Conversation/Event'),
    )
    .onEvent('onDeliveryConfirmed', 'Conversation/Event', (steps) =>
      steps.capture().requestNow(),
    )
    .buildDocument();
}

export function captureTriggeredFromDocUpdate(): BlueNode {
  return PayNotes.payNote('Capture Triggered From Document Update')
    .description('When delivery confirmation path appears, unlock and capture.')
    .currency('EUR')
    .amountMinor(49_900)
    .capture()
    .lockOnInit()
    .unlockOnDocPathChange('/delivery/confirmedAt')
    .done()
    .onDocChange(
      'captureAfterDeliveryPathUpdate',
      '/delivery/confirmedAt',
      (steps) => steps.capture().requestNow(),
    )
    .buildDocument();
}

export function reserveOnApprovalThenCaptureOnConfirmation(): BlueNode {
  return PayNotes.payNote('Reserve On Approval Then Capture On Confirmation')
    .description(
      'Reserve unlocks when /approved changes; capture unlocks on delivery confirmation.',
    )
    .currency('USD')
    .amountMinor(250_000)
    .reserve()
    .requestOnInit()
    .done()
    .onEvent('lockCaptureWhenReserved', 'PayNote/Funds Reserved', (steps) =>
      steps.capture().lock(),
    )
    .capture()
    .unlockOnOperation(
      'confirmDelivery',
      'payerChannel',
      'Payer confirms delivery.',
    )
    .requestOnOperation(
      'requestCapture',
      'guarantorChannel',
      'Request full capture after confirmation.',
    )
    .done()
    .buildDocument();
}

export function reserveImmediatelyReleaseOnDispute(): BlueNode {
  return PayNotes.payNote('Reserve Immediately Release On Dispute')
    .description(
      'Reserve on init; payer can open dispute for full reservation release.',
    )
    .currency('EUR')
    .amountMinor(75_000)
    .reserve()
    .requestOnInit()
    .done()
    .capture()
    .requestOnOperation(
      'capturePayment',
      'guarantorChannel',
      'Capture after service rendered.',
    )
    .done()
    .release()
    .requestOnOperation(
      'openDispute',
      'payerChannel',
      'Payer opens dispute for full release.',
    )
    .done()
    .buildDocument();
}

export function milestoneReservePartialCapture(): BlueNode {
  return PayNotes.payNote('Milestone Reserve Partial Capture')
    .description('Reserve full amount; guarantor approves milestone captures.')
    .currency('USD')
    .amountMinor(2_000_000)
    .reserve()
    .requestOnInit()
    .done()
    .capture()
    .requestPartialOnOperation(
      'approveMilestone1',
      'guarantorChannel',
      '500000',
      'Approve milestone 1 (25%)',
    )
    .requestPartialOnOperation(
      'approveMilestone2',
      'guarantorChannel',
      '500000',
      'Approve milestone 2 (25%)',
    )
    .requestPartialOnOperation(
      'approveMilestone3',
      'guarantorChannel',
      '500000',
      'Approve milestone 3 (25%)',
    )
    .requestPartialOnOperation(
      'approveMilestone4',
      'guarantorChannel',
      '500000',
      'Approve milestone 4 (25%)',
    )
    .done()
    .release()
    .requestPartialOnOperation(
      'releaseUnfinishedWork',
      'payerChannel',
      'event.message.request.amount',
      'Release unfinished work.',
    )
    .done()
    .buildDocument();
}

export function reserveLockedUntilKycThenCaptureOnSettlement(): BlueNode {
  return PayNotes.payNote('Reserve After KYC Capture On Settlement')
    .description(
      'Reserve unlocks after KYC; capture unlocks on settlement confirmation.',
    )
    .currency('CHF')
    .amountMinor(5_000_000)
    .reserve()
    .requestOnInit()
    .done()
    .capture()
    .lockOnInit()
    .unlockOnDocPathChange('/settlement/confirmed')
    .requestOnDocPathChange('/settlement/confirmed')
    .done()
    .release()
    .requestOnOperation(
      'rejectKyc',
      'guarantorChannel',
      'Reject and release if KYC fails.',
    )
    .done()
    .buildDocument();
}

export function releaseLockedUntilWindowOpens(): BlueNode {
  return PayNotes.payNote('Release Locked Until Window Opens')
    .description(
      'Capture runs on init; release unlocks only after guarantor opens a window.',
    )
    .currency('USD')
    .amountMinor(19_900)
    .reserve()
    .requestOnInit()
    .done()
    .capture()
    .requestOnInit()
    .done()
    .release()
    .requestOnOperation(
      'openReleaseWindow',
      'guarantorChannel',
      'Guarantor opens release window.',
    )
    .requestOnOperation(
      'requestRelease',
      'payerChannel',
      'Payer requests full release.',
    )
    .done()
    .buildDocument();
}

export function bootstrapVoucherOnCapture(): BlueNode {
  return PayNotes.payNote('Armchair With Voucher Bootstrap')
    .currency('USD')
    .amountMinor(80_000)
    .capture()
    .lockOnInit()
    .unlockOnOperation(
      'confirmSatisfaction',
      'payerChannel',
      'Confirm armchair is satisfactory.',
    )
    .done()
    .onEvent('bootstrapVoucher', 'PayNote/Funds Captured', (steps) =>
      steps.myOs().bootstrapDocument(
        'BootstrapVoucherDoc',
        balancedBowlVoucherPayNoteTemplateJson(),
        {
          payerChannel: {
            type: 'Conversation/Timeline Channel',
            timelineId: 'voucher-payer',
          },
          payeeChannel: {
            type: 'Conversation/Timeline Channel',
            timelineId: 'voucher-payee',
          },
          merchantChannel: {
            type: 'Conversation/Timeline Channel',
            timelineId: 'voucher-payee',
          },
        },
        'payeeChannel',
      ),
    )
    .onMyOsResponse(
      'onVoucherReady',
      'Conversation/Document Bootstrap Completed',
      (steps) =>
        steps
          .replaceExpression(
            'SaveSession',
            '/voucher/sessionId',
            'event.message.sessionId',
          )
          .replaceValue('MarkActive', '/voucher/status', 'active'),
    )
    .onMyOsResponse(
      'onVoucherFailed',
      'Conversation/Document Bootstrap Failed',
      (steps) => steps.replaceValue('MarkFailed', '/voucher/status', 'failed'),
    )
    .buildDocument();
}

export function bootstrapViaOrchestrator(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('Orchestrated Document')
    .channel('orchestratorChannel')
    .channel('aliceChannel')
    .channel('bobChannel')
    .onInit('bootstrapChild', (steps) =>
      steps.bootstrapDocument(
        'BootstrapChildDoc',
        childDoc(),
        {
          participantA: {
            type: 'Conversation/Timeline Channel',
            timelineId: 'alice-participant',
          },
          participantB: {
            type: 'Conversation/Timeline Channel',
            timelineId: 'bob-participant',
          },
        },
        'orchestratorChannel',
        (payload) => {
          payload.put('bootstrapAssignee', 'orchestratorChannel');
          payload.put('initialMessages', {
            defaultMessage: 'You have been added to a collaboration.',
          });
        },
      ),
    )
    .onEvent(
      'onChildReady',
      'Conversation/Document Bootstrap Completed',
      (steps) =>
        steps.replaceExpression(
          'SaveChild',
          '/child/sessionId',
          'event.message.sessionId',
        ),
    )
    .buildDocument();
}

export function bootstrapWithMessages(): BlueNode {
  return SimpleDocBuilder.doc()
    .name('With Messages')
    .channel('sellerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('buyerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .myOsAdmin('myOsAdminChannel')
    .onInit('bootstrapDeal', (steps) =>
      steps.myOs().bootstrapDocument(
        'BootstrapDeal',
        dealDoc(),
        {
          sellerChannel: fromChannel('sellerChannel'),
          buyerChannel: fromChannel('buyerChannel'),
        },
        'sellerChannel',
        (payload) => {
          payload.put('initialMessages', {
            defaultMessage: 'A new deal has been created.',
            perChannel: {
              buyerChannel: 'You have a new purchase to review.',
            },
          });
        },
      ),
    )
    .buildDocument();
}

function childDoc(): JsonObject {
  return SimpleDocBuilder.doc()
    .name('Child Collaboration')
    .channel('participantA')
    .channel('participantB')
    .buildJson();
}

function dealDoc(): JsonObject {
  return SimpleDocBuilder.doc()
    .name('Deal')
    .channel('sellerChannel')
    .channel('buyerChannel')
    .field('/status', 'draft')
    .buildJson();
}

export function allJavaSandboxSampleDocs(): Record<string, BlueNode> {
  return {
    simpleAgentWithPermissions: simpleAgentWithPermissions(),
    agentAddsParticipantAndWaits: agentAddsParticipantAndWaits(),
    agentCallsRemoteOperation: agentCallsRemoteOperation(),
    cvClassifierAgent: cvClassifierAgent(),
    orchestratorWithAccessAndAgency: orchestratorWithAccessAndAgency(),
    linkedAccessMonitor: linkedAccessMonitor(),
    simplePermissionAndSubscribe: simplePermissionAndSubscribe(),
    callRemoteOperation: callRemoteOperationSample(),
    addParticipantsDynamically: addParticipantsDynamically(),
    linkedDocsWithUpdates: linkedDocsWithUpdates(),
    cvClassifierFull: cvClassifierFull(),
    accessAndAgencyOrchestrator: accessAndAgencyOrchestrator(),
    linkedAccessPermissions: linkedAccessPermissions(),
    bootstrapVoucherOnCapture: bootstrapVoucherOnCapture(),
    bootstrapViaOrchestrator: bootstrapViaOrchestrator(),
    bootstrapWithMessages: bootstrapWithMessages(),
    shipmentEscrowSimple: shipmentEscrowSimple(),
    captureTriggeredFromChannelEvent: captureTriggeredFromChannelEvent(),
    captureTriggeredFromDocUpdate: captureTriggeredFromDocUpdate(),
    reserveOnApprovalThenCaptureOnConfirmation:
      reserveOnApprovalThenCaptureOnConfirmation(),
    reserveImmediatelyReleaseOnDispute: reserveImmediatelyReleaseOnDispute(),
    milestoneReservePartialCapture: milestoneReservePartialCapture(),
    reserveLockedUntilKycThenCaptureOnSettlement:
      reserveLockedUntilKycThenCaptureOnSettlement(),
    releaseLockedUntilWindowOpens: releaseLockedUntilWindowOpens(),
    armchairProtectionWithVoucherPayNoteTemplate:
      armchairProtectionWithVoucherPayNoteTemplate(),
    balancedBowlVoucherPayNoteTemplate: balancedBowlVoucherPayNoteTemplate(),
  };
}
