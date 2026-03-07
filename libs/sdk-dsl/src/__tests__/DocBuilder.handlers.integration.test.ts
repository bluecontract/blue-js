/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
*/

import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { DocBuilder } from '../lib';
import {
  initializeDocument,
  makeTimelineEntryEvent,
  processExternalEvent,
} from './processor-harness';

describe('DocBuilder handler integration', () => {
  it('runs onInit workflows during document initialization', async () => {
    const built = DocBuilder.doc()
      .name('On init integration')
      .field('/status', 'pending')
      .onInit('initialize', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'ready'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);

    expect(String(initialized.document.get('/status'))).toBe('ready');
  });

  it('reacts to emitted typed events via onEvent workflows', async () => {
    const built = DocBuilder.doc()
      .name('On event integration')
      .field('/status', 'pending')
      .onInit('bootstrap', (steps) =>
        steps.emitType('EmitCompleted', 'Conversation/Status Completed'),
      )
      .onEvent('onCompleted', 'Conversation/Status Completed', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'done'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const completedEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        conversationBlueIds['Conversation/Status Completed'],
    );

    expect(String(initialized.document.get('/status'))).toBe('done');
    expect(completedEvent).toBeDefined();
  });

  it('reacts to emitted named events via onNamedEvent workflows', async () => {
    const built = DocBuilder.doc()
      .name('On named event integration')
      .field('/status', 'pending')
      .onInit('bootstrap', (steps) => steps.namedEvent('EmitReady', 'READY'))
      .onNamedEvent('onReady', 'READY', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'ready'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const namedEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getValue() === 'Common/Named Event' &&
        event.getProperties()?.name?.getValue() === 'READY',
    );

    expect(String(initialized.document.get('/status'))).toBe('ready');
    expect(namedEvent).toBeDefined();
  });

  it('reacts to watched document updates via onDocChange workflows', async () => {
    const built = DocBuilder.doc()
      .name('On doc change integration')
      .field('/watched', 0)
      .field('/status', 'pending')
      .onInit('bootstrap', (steps) =>
        steps.replaceValue('SetWatched', '/watched', 1),
      )
      .onDocChange('whenWatchedChanges', '/watched', (steps) =>
        steps.replaceValue('SetStatus', '/status', 'updated'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);

    expect(initialized.document.getAsInteger('/watched')).toBe(1);
    expect(String(initialized.document.get('/status'))).toBe('updated');
  });

  it('applies dynamic changesets through updateDocumentFromExpression', async () => {
    const built = DocBuilder.doc()
      .name('Dynamic changeset integration')
      .field('/counter', 0)
      .onInit('bootstrap', (steps) =>
        steps
          .jsRaw(
            'ComputeChangeset',
            `
return {
  nextChangeset: [
    { op: 'replace', path: '/counter', val: 2 }
  ]
};
`,
          )
          .updateDocumentFromExpression(
            'ApplyDynamic',
            'steps.ComputeChangeset.nextChangeset',
          ),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);

    expect(initialized.document.getAsInteger('/counter')).toBe(2);
  });

  it('emits bootstrap request events with document bindings and options', async () => {
    const child = new BlueNode()
      .setName('Child Doc')
      .setType(new BlueNode().setValue('Demo/Child').setInlineValue(true));

    const built = DocBuilder.doc()
      .name('Bootstrap integration')
      .onInit('bootstrap', (steps) =>
        steps.bootstrapDocument(
          'BootstrapChild',
          child,
          {
            participantA: 'aliceChannel',
          },
          (options) =>
            options
              .assignee('orchestratorChannel')
              .defaultMessage('You have been added.')
              .channelMessage('participantA', 'Please review and accept.'),
        ),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const bootstrapEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );

    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent?.getProperties()?.document?.getName()).toBe(
      'Child Doc',
    );
    expect(
      bootstrapEvent
        ?.getProperties()
        ?.channelBindings?.getProperties()
        ?.participantA?.getValue(),
    ).toBe('aliceChannel');
    expect(bootstrapEvent?.getProperties()?.bootstrapAssignee?.getValue()).toBe(
      'orchestratorChannel',
    );
  });

  it('emits bootstrap request events from bootstrapDocumentExpr expressions', async () => {
    const childTemplate = new BlueNode()
      .setName('Child Template')
      .setType(new BlueNode().setValue('Custom/Type').setInlineValue(true))
      .addProperty('initialCounter', new BlueNode().setValue(1));

    const built = DocBuilder.doc()
      .name('Bootstrap expr integration')
      .field('/childTemplate', childTemplate)
      .onInit('bootstrap', (steps) =>
        steps.bootstrapDocumentExpr(
          'BootstrapExpr',
          "document('/childTemplate')",
          {
            participantB: 'bobChannel',
          },
          (options) => options.assignee('myOsAdminChannel'),
        ),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const bootstrapEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );

    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent?.getProperties()?.document?.getName()).toBe(
      'Child Template',
    );
    expect(
      bootstrapEvent
        ?.getProperties()
        ?.channelBindings?.getProperties()
        ?.participantB?.getValue(),
    ).toBe('bobChannel');
    expect(bootstrapEvent?.getProperties()?.bootstrapAssignee?.getValue()).toBe(
      'myOsAdminChannel',
    );
  });

  it('preserves the current runtime limitation for onChannelEvent message matchers on timeline channels', async () => {
    const timelineId = 'owner-timeline-42';
    const built = DocBuilder.doc()
      .name('On channel event integration')
      .field('/status', 'idle')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId,
      })
      .onChannelEvent(
        'onOwnerMessage',
        'ownerChannel',
        'Conversation/Chat Message',
        (steps) => steps.replaceValue('SetStatus', '/status', 'seen'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const event = makeTimelineEntryEvent(initialized.blue, {
      timelineId,
      message: {
        type: 'Conversation/Chat Message',
        message: 'hello',
      },
    });
    const processed = await processExternalEvent({
      processor: initialized.processor,
      document: initialized.document,
      event,
    });

    expect(String(processed.document.get('/status'))).toBe('idle');
  });
});
