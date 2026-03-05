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
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
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
      .onSessionStarted('workerAgency', 'captureSessionStarted', (steps) =>
        steps.replaceValue('SetSessionStarted', '/granted', true),
      )
      .onParticipantResolved('captureParticipantResolved', (steps) =>
        steps.replaceValue('SetParticipantResolved', '/granted', true),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`markAccessGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Single Document Permission Granted`);
    expect(yaml).toContain(`markAgencyGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Granted`);
    expect(yaml).toContain(`captureCallResponse:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Call Operation Responded`);
    expect(yaml).toContain(`captureSessionCreated:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Subscription to Session Initiated`);
    expect(yaml).toContain(`captureLinkedDocGranted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`captureSessionStarted:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Target Document Session Started`);
    expect(yaml).toContain(`captureParticipantResolved:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Participant Resolved`);
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
            .subscribe('Conversation/Event')
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
      .done()
      .operation(
        'bootstrapAccess',
        'ownerChannel',
        Number,
        'bootstrap access',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermission(
              {
                read: true,
                write: true,
              },
              true,
            )
            .access('counterAccess')
            .subscribe('Conversation/Response'),
      )
      .buildDocument();

    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`grantSessionSubscriptionOnResult: true`);
    expect(yaml).toContain(`write: true`);
    expect(yaml).toContain(`id: SUB_COUNTER`);
    expect(yaml).toContain(`type: Conversation/Response`);
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
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
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
    expect(yaml).toContain(`onAgencyRejectedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Rejected`);
    expect(yaml).toContain(`onAgencyRevokedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Agency Permission Revoked`);
    expect(yaml).toContain(`onSessionStartingWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Worker Session Starting`);
    expect(yaml).toContain(`onSessionFailedWF:
    type: Conversation/Sequential Workflow`);
    expect(yaml).toContain(`type: MyOS/Bootstrap Failed`);
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
});
