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
});
