import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import { toOfficialYaml } from '../../core/serialization.js';

describe('interaction builders mapping', () => {
  it('maps access and agency listener helpers', () => {
    const document = DocBuilder.doc()
      .name('Access Mapping')
      .field('/granted', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .done()
      .accessLinked('linkedCounterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .link('anchorA')
      .read(true)
      .done()
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .done()
      .onAccessGranted('counterAccess', 'markAccessGranted', (steps) =>
        steps.replaceValue('SetGranted', '/granted', true),
      )
      .onAgencyGranted('workerAgency', 'markAgencyGranted', (steps) =>
        steps.replaceValue('SetGrantedFromAgency', '/granted', true),
      )
      .onCallResponse('counterAccess', 'captureCallResponse', (steps) =>
        steps.replaceValue('SetCallResponse', '/granted', true),
      )
      .onSessionCreated('counterAccess', 'captureSessionCreated', (steps) =>
        steps.replaceValue('SetSessionCreated', '/granted', true),
      )
      .onLinkedDocGranted(
        'linkedCounterAccess',
        'captureLinkedDocGranted',
        (steps) => steps.replaceValue('SetLinkedDocGranted', '/granted', true),
      )
      .onLinkedAccessRejected(
        'linkedCounterAccess',
        'captureLinkedAccessRejected',
        (steps) =>
          steps.replaceValue('SetLinkedAccessRejected', '/granted', true),
      )
      .onLinkedDocRevoked(
        'linkedCounterAccess',
        'captureLinkedDocRevoked',
        (steps) => steps.replaceValue('SetLinkedDocRevoked', '/granted', true),
      )
      .onSessionStarted('workerAgency', 'captureSessionStarted', (steps) =>
        steps.replaceValue('SetSessionStarted', '/granted', true),
      )
      .onParticipantResolved('captureParticipantResolved', (steps) =>
        steps.replaceValue('SetParticipantResolved', '/granted', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`myOsAdminChannel:
    type: MyOS/MyOS Timeline Channel
    accountId: '0'`);
    expect(yaml).toContain(`markAccessGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Granted`);
    expect(yaml).toContain(`markAgencyGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Granted`);
    expect(yaml).toContain(`captureCallResponse:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Call Operation Responded`);
    expect(yaml).toContain(`requestId: REQ_ACCESS_COUNTERACCESS`);
    expect(yaml).toContain(`captureSessionCreated:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Subscription to Session Initiated`);
    expect(yaml).toContain(`subscriptionId: SUB_ACCESS_COUNTERACCESS`);
    expect(yaml).toContain(`captureLinkedDocGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Granted`);
    expect(yaml).toContain(`requestId: REQ_LINKED_LINKEDCOUNTERACCESS`);
    expect(yaml).toContain(`captureLinkedAccessRejected:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Linked Documents Permission Rejected`);
    expect(yaml).toContain(`captureLinkedDocRevoked:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Revoked`);
    expect(yaml).toContain(`requestId: REQ_LINKED_LINKEDCOUNTERACCESS`);
    expect(yaml).toContain(`captureSessionStarted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Target Document Session Started`);
    expect(yaml).toContain(`captureParticipantResolved:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Participant Resolved`);
  });

  it('maps typed call-response listeners through an internal envelope workflow and request correlation', () => {
    const document = DocBuilder.doc()
      .name('Typed Call Response Mapping')
      .field('/handled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .done()
      .onCallResponse(
        'counterAccess',
        'captureTypedCallResponse',
        'Conversation/Response',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`captureTypedCallResponseOnCallResponseEnvelope:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Call Operation Responded`);
    expect(yaml).toContain(`type: Conversation/JavaScript Code`);
    expect(yaml).toContain(`captureTypedCallResponse:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: Conversation/Response`);
    expect(yaml).toContain(`requestId: REQ_COUNTER`);
    expect(yaml).toContain(`inResponseTo:`);
  });

  it('maps field-only call-response matchers onto response listeners with request correlation', () => {
    const document = DocBuilder.doc()
      .name('Field Call Response Mapping')
      .field('/handled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .done()
      .onCallResponse(
        'counterAccess',
        'captureAmount42',
        { amountCaptured: 42 },
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`captureAmount42:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: Conversation/Response`);
    expect(yaml).toContain(`amountCaptured: 42`);
    expect(yaml).toContain(`requestId: REQ_COUNTER`);
    expect(yaml).toContain(`inResponseTo:`);
  });

  it('maps name-only call-response matchers onto base response listeners', () => {
    const document = DocBuilder.doc()
      .name('Named Call Response Mapping')
      .field('/handled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .done()
      .onCallResponse(
        'counterAccess',
        'captureNamedResponse',
        { name: 'CallCompletedResponse' },
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`captureNamedResponse:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:`);
    expect(yaml).toContain(`name: CallCompletedResponse
      type: Conversation/Response`);
    expect(yaml).toContain(`requestId: REQ_COUNTER`);
    expect(yaml).toContain(`inResponseTo:`);
  });

  it('reuses one call-response envelope workflow for multiple typed listeners on the same access', () => {
    const json = DocBuilder.doc()
      .name('Shared Call Response Envelope Mapping')
      .field('/approvedHandled', false)
      .field('/capturedHandled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .done()
      .onCallResponse(
        'counterAccess',
        'onApproved',
        'PayNote/PayNote Approved',
        (steps) =>
          steps.replaceValue('SetApprovedHandled', '/approvedHandled', true),
      )
      .onCallResponse(
        'counterAccess',
        'onCaptured',
        'PayNote/Funds Captured',
        (steps) =>
          steps.replaceValue('SetCapturedHandled', '/capturedHandled', true),
      )
      .buildJson();

    const envelopeWorkflows = Object.entries(json.contracts ?? {}).filter(
      ([, contract]) =>
        typeof contract === 'object' &&
        contract !== null &&
        !Array.isArray(contract) &&
        (contract as Record<string, unknown>).type ===
          'Conversation/Sequential Workflow' &&
        typeof (contract as Record<string, unknown>).event === 'object' &&
        (contract as Record<string, unknown>).event !== null &&
        ((contract as Record<string, unknown>).event as Record<string, unknown>)
          .type === 'MyOS/Call Operation Responded',
    );

    expect(envelopeWorkflows).toHaveLength(1);
  });

  it('maps linked access subscribe and call helper steps', () => {
    const document = DocBuilder.doc()
      .name('Linked Access Steps Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .accessLinked('linkedCounterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED_COUNTER')
      .subscriptionId('SUB_LINKED_COUNTER')
      .done()
      .operation(
        'bootstrapLinkedAccess',
        'ownerChannel',
        Number,
        'bootstrap linked access helpers',
        (steps) =>
          steps
            .accessLinked('linkedCounterAccess')
            .subscribe()
            .accessLinked('linkedCounterAccess')
            .call('syncLinkedState', {
              type: 'Conversation/Event',
            }),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`id: SUB_LINKED_COUNTER`);
    expect(yaml).toContain(`operation: syncLinkedState`);
    expect(yaml).toContain(`type: MyOS/Subscribe to Session Requested`);
    expect(yaml).toContain(`type: MyOS/Call Operation Requested`);
  });

  it('maps access helper permission and subscription options', () => {
    const document = DocBuilder.doc()
      .name('Access Steps Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .subscriptionId('SUB_COUNTER')
      .subscriptionEvents('Conversation/Response')
      .done()
      .operation(
        'bootstrapAccess',
        'ownerChannel',
        Number,
        'bootstrap access',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermission({
              read: true,
              share: true,
            })
            .access('counterAccess')
            .subscribe(),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).not.toContain(`grantSessionSubscriptionOnResult`);
    expect(yaml).toContain(`share: true`);
    expect(yaml).toContain(`id: SUB_COUNTER`);
    expect(yaml).toContain(`type: Conversation/Response`);
  });

  it('maps agency permission requests onto allowed worker agency permissions', () => {
    const document = DocBuilder.doc()
      .name('Agency Permission Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .allowedOperations('proposeOffer', 'accept')
      .requestId('REQ_AGENCY')
      .done()
      .buildJson();

    const contracts = document.contracts as Record<
      string,
      { steps?: Array<{ event?: Record<string, unknown> }> }
    >;
    const requestStep = Object.values(contracts)
      .flatMap((contract) => contract.steps ?? [])
      .find(
        (step) =>
          step.event?.type === 'MyOS/Worker Agency Permission Grant Requested',
      );

    expect(requestStep).toEqual(
      expect.objectContaining({
        event: {
          type: 'MyOS/Worker Agency Permission Grant Requested',
          onBehalfOf: 'ownerChannel',
          requestId: 'REQ_AGENCY',
          allowedWorkerAgencyPermissions: [
            {
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
                singleOps: ['proposeOffer', 'accept'],
              },
            },
          ],
        },
      }),
    );
    expect(requestStep?.event).not.toHaveProperty('workerAgencyPermissions');
  });

  it('keeps fluent operation builder steps scoped to registered integrations', () => {
    const document = DocBuilder.doc()
      .name('Fluent Access Steps Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .subscriptionId('SUB_COUNTER')
      .done()
      .operation('bootstrapAccess')
      .channel('ownerChannel')
      .requestType(Number)
      .description('bootstrap access')
      .steps((steps) => steps.access('counterAccess').subscribe())
      .done()
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`bootstrapAccessImpl:
    type: Conversation/Sequential Workflow Operation`);
    expect(yaml).toContain(`id: SUB_COUNTER`);
    expect(yaml).toContain(`type: MyOS/Subscribe to Session Requested`);
  });

  it('omits subscription filters for zero-arg access, linked, and agency helpers', () => {
    const document = DocBuilder.doc()
      .name('Wildcard Subscribe Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('access-target')
      .subscriptionId('SUB_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('linked-target')
      .link('anchorA')
      .read(true)
      .done()
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .targetSessionId('agency-target')
      .done()
      .operation(
        'subscribeAll',
        'ownerChannel',
        Number,
        'subscribe without filters',
        (steps) =>
          steps
            .access('counterAccess')
            .subscribe()
            .accessLinked('linkedAccess')
            .subscribe()
            .viaAgency('workerAgency')
            .subscribe('SUB_AGENCY'),
      )
      .buildJson();

    const contracts = document.contracts as Record<
      string,
      { steps?: Array<{ event?: Record<string, unknown> }> }
    >;
    const subscribeSteps = Object.values(contracts)
      .flatMap((contract) => contract.steps ?? [])
      .filter(
        (step) => step.event?.type === 'MyOS/Subscribe to Session Requested',
      );

    expect(subscribeSteps).toHaveLength(3);
    expect(subscribeSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: {
            type: 'MyOS/Subscribe to Session Requested',
            targetSessionId: 'access-target',
            subscription: {
              id: 'SUB_ACCESS',
            },
          },
        }),
        expect.objectContaining({
          event: {
            type: 'MyOS/Subscribe to Session Requested',
            targetSessionId: 'linked-target',
            subscription: {
              id: 'SUB_LINKED',
            },
          },
        }),
        expect.objectContaining({
          event: {
            type: 'MyOS/Subscribe to Session Requested',
            targetSessionId: 'agency-target',
            subscription: {
              id: 'SUB_AGENCY',
            },
          },
        }),
      ]),
    );
    for (const step of subscribeSteps) {
      expect(step.event?.subscription).not.toHaveProperty('events');
    }
  });

  it('fails fast for unsupported subscribeToCreatedSessions(true)', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Access created sessions unsupported')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .access('counterAccess')
        .permissionFrom('ownerChannel')
        .targetSessionId('target-session')
        .subscribeToCreatedSessions(true),
    ).toThrow(
      'access(...).subscribeToCreatedSessions(true) is not supported on the current public runtime',
    );
  });

  it('fails fast for access read(false)', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Access read false unsupported')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .access('counterAccess')
        .permissionFrom('ownerChannel')
        .targetSessionId('target-session')
        .read(false),
    ).toThrow(
      'access(...).read(false) is not supported; MyOS single-document permissions require read=true',
    );
  });

  it('fails fast for linked-access read(false)', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Linked access read false unsupported')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .accessLinked('linkedAccess')
        .permissionFrom('ownerChannel')
        .targetSessionId('target-session')
        .link('anchorA')
        .read(false),
    ).toThrow(
      'accessLinked(...).link(...).read(false) is not supported; MyOS linked-document permissions require read=true',
    );
  });

  it('maps rejection and revocation listeners across access variants', () => {
    const document = DocBuilder.doc()
      .name('Interaction Listener Matrix')
      .field('/status', 'pending')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_COUNTER')
      .done()
      .accessLinked('linkedCounterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .done()
      .onAccessRejected('counterAccess', 'onAccessRejectedWF', (steps) =>
        steps.replaceValue('SetRejected', '/status', 'access-rejected'),
      )
      .onAccessRevoked('counterAccess', 'onAccessRevokedWF', (steps) =>
        steps.replaceValue('SetRevoked', '/status', 'access-revoked'),
      )
      .onLinkedAccessGranted(
        'linkedCounterAccess',
        'onLinkedAccessGrantedWF',
        (steps) =>
          steps.replaceValue(
            'SetLinkedGranted',
            '/status',
            'linked-access-granted',
          ),
      )
      .onLinkedAccessRejected(
        'linkedCounterAccess',
        'onLinkedAccessRejectedWF',
        (steps) =>
          steps.replaceValue(
            'SetLinkedRejected',
            '/status',
            'linked-access-rejected',
          ),
      )
      .onLinkedAccessRevoked(
        'linkedCounterAccess',
        'onLinkedAccessRevokedWF',
        (steps) =>
          steps.replaceValue(
            'SetLinkedRevoked',
            '/status',
            'linked-access-revoked',
          ),
      )
      .onLinkedUpdate(
        'linkedCounterAccess',
        'onLinkedUpdateWF',
        'Conversation/Response',
        (steps) =>
          steps.replaceValue(
            'SetLinkedUpdated',
            '/status',
            'linked-update-received',
          ),
      )
      .onAgencyRejected('workerAgency', 'onAgencyRejectedWF', (steps) =>
        steps.replaceValue('SetAgencyRejected', '/status', 'agency-rejected'),
      )
      .onAgencyRevoked('workerAgency', 'onAgencyRevokedWF', (steps) =>
        steps.replaceValue('SetAgencyRevoked', '/status', 'agency-revoked'),
      )
      .onSessionStarting('workerAgency', 'onSessionStartingWF', (steps) =>
        steps.replaceValue('SetSessionStarting', '/status', 'session-starting'),
      )
      .onSessionFailed('workerAgency', 'onSessionFailedWF', (steps) =>
        steps.replaceValue('SetSessionFailed', '/status', 'session-failed'),
      )
      .onAgencyUpdate(
        'workerAgency',
        'onAgencyUpdateWF',
        'SUB_AGENCY',
        'Conversation/Response',
        (steps) =>
          steps.replaceValue('SetAgencyUpdated', '/status', 'agency-updated'),
      )
      .onAllParticipantsReady('onAllParticipantsReadyWF', (steps) =>
        steps.replaceValue(
          'SetParticipantsReady',
          '/status',
          'participants-ready',
        ),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`onAccessRejectedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Rejected`);
    expect(yaml).toContain(`onAccessRevokedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Revoked`);
    expect(yaml).toContain(`onLinkedAccessGrantedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Linked Documents Permission Granted`);
    expect(yaml).toContain(`onLinkedAccessRejectedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Linked Documents Permission Rejected`);
    expect(yaml).toContain(`onLinkedAccessRevokedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Linked Documents Permission Revoked`);
    expect(yaml).toContain(`onLinkedUpdateWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`subscriptionId: SUB_LINKED`);
    expect(yaml).toContain(`type: Conversation/Response`);
    expect(yaml).toContain(`onAgencyRejectedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Rejected`);
    expect(yaml).toContain(`onAgencyRevokedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Revoked`);
    expect(yaml).toContain(`onSessionStartingWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Session Starting`);
    expect(yaml).toContain(`requestId: REQ_AGENCY`);
    expect(yaml).toContain(`onSessionFailedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Bootstrap Failed`);
    expect(yaml).toContain(`onAgencyUpdateWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`subscriptionId: SUB_AGENCY`);
    expect(yaml).toContain(`onAllParticipantsReadyWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/All Participants Ready`);
  });

  it('maps agency call and subscription helper steps', () => {
    const document = DocBuilder.doc()
      .name('Agency Steps Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .operation(
        'syncAgency',
        'ownerChannel',
        Number,
        'sync agency target',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .subscribe('SUB_AGENCY', 'Conversation/Response')
            .viaAgency('workerAgency')
            .call('syncState', {
              type: 'Conversation/Event',
              payload: {
                source: 'mapping',
              },
            }),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`id: SUB_AGENCY`);
    expect(yaml).toContain(`type: MyOS/Subscribe to Session Requested`);
    expect(yaml).toContain(`operation: syncState`);
    expect(yaml).toContain(`type: MyOS/Call Operation Requested`);
  });

  it('maps agency target override helper steps', () => {
    const document = DocBuilder.doc()
      .name('Agency Override Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'syncAgencyOverride',
        'ownerChannel',
        Number,
        'sync agency with override target',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .subscribeForTarget(
              'override-target',
              'SUB_AGENCY_OVERRIDE',
              'Conversation/Response',
            )
            .viaAgency('workerAgency')
            .callOnTarget('override-target', 'syncOverride', {
              type: 'Conversation/Event',
            }),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`id: SUB_AGENCY_OVERRIDE`);
    expect(yaml).toContain(`targetSessionId: override-target`);
    expect(yaml).toContain(`operation: syncOverride`);
    expect(yaml).toContain(`type: MyOS/Subscribe to Session Requested`);
    expect(yaml).toContain(`type: MyOS/Call Operation Requested`);
  });

  it('maps access and linked-access explicit target override helper steps', () => {
    const document = DocBuilder.doc()
      .name('Access Override Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-access-target')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-linked-target')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .operation(
        'syncOverrides',
        'ownerChannel',
        Number,
        'sync with override targets',
        (steps) =>
          steps
            .access('counterAccess')
            .subscribeForTarget(
              'override-access-target',
              'SUB_ACCESS_OVERRIDE',
              'Conversation/Response',
            )
            .access('counterAccess')
            .callOnTarget('override-access-target', 'syncAccess', {
              type: 'Conversation/Event',
            })
            .accessLinked('linkedAccess')
            .subscribeForTarget(
              'override-linked-target',
              'SUB_LINKED_OVERRIDE',
              'Conversation/Event',
            )
            .accessLinked('linkedAccess')
            .callOnTarget('override-linked-target', 'syncLinked', {
              type: 'Conversation/Event',
            }),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`id: SUB_ACCESS_OVERRIDE`);
    expect(yaml).toContain(`id: SUB_LINKED_OVERRIDE`);
    expect(yaml).toContain(`targetSessionId: override-access-target`);
    expect(yaml).toContain(`targetSessionId: override-linked-target`);
    expect(yaml).toContain(`operation: syncAccess`);
    expect(yaml).toContain(`operation: syncLinked`);
  });

  it('maps access and linked-access permission/revoke target override helpers', () => {
    const document = DocBuilder.doc()
      .name('Access Permission Override Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-access-target')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-linked-target')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .operation(
        'overridePermissions',
        'ownerChannel',
        Number,
        'override permission targets',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermissionForTarget('override-access-target', {
              read: true,
              share: true,
            })
            .access('counterAccess')
            .revokePermissionForTarget('override-access-target')
            .accessLinked('linkedAccess')
            .requestPermissionForTarget('override-linked-target', {
              anchorA: { read: true },
            })
            .accessLinked('linkedAccess')
            .revokePermissionForTarget('override-linked-target'),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`targetSessionId: override-access-target`);
    expect(yaml).toContain(`targetSessionId: override-linked-target`);
    expect(yaml).not.toContain(`grantSessionSubscriptionOnResult`);
    expect(yaml).toContain(`share: true`);
    expect(yaml).toContain(
      `type: MyOS/Single Document Permission Grant Requested`,
    );
    expect(yaml).toContain(
      `type: MyOS/Single Document Permission Revoke Requested`,
    );
    expect(yaml).toContain(
      `type: MyOS/Linked Documents Permission Grant Requested`,
    );
    expect(yaml).toContain(
      `type: MyOS/Linked Documents Permission Revoke Requested`,
    );
  });

  it('maps agency permission target override helpers', () => {
    const document = DocBuilder.doc()
      .name('Agency Permission Override Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'overrideAgencyPermissions',
        'ownerChannel',
        Number,
        'override agency permission target',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .requestPermission(
              {
                type: 'MyOS/Worker Agency Permission',
                workerType: 'MyOS/MyOS Admin Base',
                permissions: {
                  read: true,
                },
              },
              'override-target',
            )
            .viaAgency('workerAgency')
            .revokePermission('override-target'),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`targetSessionId: override-target`);
    expect(yaml).toContain(
      `type: MyOS/Worker Agency Permission Grant Requested`,
    );
    expect(yaml).toContain(
      `type: MyOS/Worker Agency Permission Revoke Requested`,
    );
  });

  it('maps agency explicit target permission/revoke helper variants', () => {
    const document = DocBuilder.doc()
      .name('Agency Explicit Permission Override Mapping')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'overrideAgencyPermissionsExplicit',
        'ownerChannel',
        Number,
        'override agency permissions explicit helpers',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .requestPermissionForTarget('explicit-target', {
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
              },
            })
            .viaAgency('workerAgency')
            .revokePermissionForTarget('explicit-target'),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`targetSessionId: explicit-target`);
    expect(yaml).toContain(
      `type: MyOS/Worker Agency Permission Grant Requested`,
    );
    expect(yaml).toContain(
      `type: MyOS/Worker Agency Permission Revoke Requested`,
    );
  });

  it('fails fast for agency startWorkerSession basic helper variant', () => {
    expect(() =>
      DocBuilder.doc()
        .name('Agency Start Worker Basic Mapping')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .agency('workerAgency')
        .permissionFrom('ownerChannel')
        .allowedTypes('MyOS/MyOS Admin Base')
        .requestId('REQ_AGENCY')
        .done()
        .operation(
          'startWorkerBasic',
          'ownerChannel',
          Number,
          'start worker basic',
          (steps) =>
            steps.viaAgency('workerAgency').startWorkerSession('ownerChannel', {
              name: 'Basic Worker',
              type: 'MyOS/MyOS Admin Base',
            }),
        ),
    ).toThrow(
      'viaAgency(...).startSession(...) requires channel bindings; use startSessionWith(...)',
    );
  });
});
