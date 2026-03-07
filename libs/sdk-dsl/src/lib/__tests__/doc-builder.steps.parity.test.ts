/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
 */
import { BlueNode } from '@blue-labs/language';

import { DocBuilder, StepsBuilder } from '../../index.js';
import {
  assertDslMatchesNode,
  assertDslMatchesYaml,
} from '../../__tests__/support/dsl-parity.js';

describe('DocBuilder step parity', () => {
  it('matches step primitives and emit helpers parity', () => {
    const rawStep = new BlueNode()
      .setName('RawStep')
      .setType('Conversation/JavaScript Code')
      .addProperty('code', new BlueNode().setValue('return { done: true };'));

    const document = DocBuilder.doc()
      .name('Step primitive parity')
      .field('/counter', 1)
      .onInit('initialize', (steps) =>
        steps
          .jsRaw('Compute', 'return { nextChangeset: [] };')
          .updateDocument('ApplyPatch', (changeset) =>
            changeset
              .addValue('/items/0', 'x')
              .replaceValue('/counter', 2)
              .replaceExpression('/expr', "document('/counter') + 1")
              .remove('/obsolete'),
          )
          .updateDocumentFromExpression(
            'ApplyDynamic',
            'steps.Compute.nextChangeset',
          )
          .triggerEvent(
            'EmitTriggered',
            new BlueNode()
              .setType('Conversation/Chat Message')
              .addProperty('message', new BlueNode().setValue('from-trigger')),
          )
          .emit('EmitBean', {
            type: 'Conversation/Chat Message',
            message: 'from-bean',
          })
          .emitType('EmitTyped', 'Integer', (event) =>
            event
              .addProperty('value', new BlueNode().setValue(7))
              .addProperty(
                'total',
                new BlueNode().setValue("${document('/counter') + 3}"),
              ),
          )
          .replaceValue('ReplaceValue', '/status', 'ready')
          .replaceExpression(
            'ReplaceExpression',
            '/calc',
            "document('/counter') + 5",
          )
          .raw(rawStep),
      )
      .buildDocument();

    const expected = new BlueNode()
      .setName('Step primitive parity')
      .addProperty('counter', new BlueNode().setValue(1))
      .setContracts({
        initLifecycleChannel: new BlueNode()
          .setType('Core/Lifecycle Event Channel')
          .addProperty(
            'event',
            new BlueNode().setType('Core/Document Processing Initiated'),
          ),
        initialize: new BlueNode()
          .setType('Conversation/Sequential Workflow')
          .addProperty(
            'channel',
            new BlueNode().setValue('initLifecycleChannel'),
          )
          .addProperty(
            'steps',
            new BlueNode().setItems([
              new BlueNode()
                .setName('Compute')
                .setType('Conversation/JavaScript Code')
                .addProperty(
                  'code',
                  new BlueNode().setValue('return { nextChangeset: [] };'),
                ),
              buildUpdateDocumentStep('ApplyPatch', [
                buildPatchEntry(
                  'add',
                  '/items/0',
                  new BlueNode().setValue('x'),
                ),
                buildPatchEntry(
                  'replace',
                  '/counter',
                  new BlueNode().setValue(2),
                ),
                buildPatchEntry(
                  'replace',
                  '/expr',
                  new BlueNode().setValue("${document('/counter') + 1}"),
                ),
                new BlueNode().setProperties({
                  op: new BlueNode().setValue('remove'),
                  path: new BlueNode().setValue('/obsolete'),
                }),
              ]),
              new BlueNode()
                .setName('ApplyDynamic')
                .setType('Conversation/Update Document')
                .addProperty(
                  'changeset',
                  new BlueNode().setValue('${steps.Compute.nextChangeset}'),
                ),
              buildTriggerEventStep(
                'EmitTriggered',
                new BlueNode()
                  .setType('Conversation/Chat Message')
                  .addProperty(
                    'message',
                    new BlueNode().setValue('from-trigger'),
                  ),
              ),
              buildTriggerEventStep(
                'EmitBean',
                new BlueNode()
                  .setType('Conversation/Chat Message')
                  .addProperty('message', new BlueNode().setValue('from-bean')),
              ),
              buildTriggerEventStep(
                'EmitTyped',
                new BlueNode()
                  .setType('Integer')
                  .addProperty('value', new BlueNode().setValue(7))
                  .addProperty(
                    'total',
                    new BlueNode().setValue("${document('/counter') + 3}"),
                  ),
              ),
              buildUpdateDocumentStep('ReplaceValue', [
                buildPatchEntry(
                  'replace',
                  '/status',
                  new BlueNode().setValue('ready'),
                ),
              ]),
              buildUpdateDocumentStep('ReplaceExpression', [
                buildPatchEntry(
                  'replace',
                  '/calc',
                  new BlueNode().setValue("${document('/counter') + 5}"),
                ),
              ]),
              new BlueNode()
                .setName('RawStep')
                .setType('Conversation/JavaScript Code')
                .addProperty(
                  'code',
                  new BlueNode().setValue('return { done: true };'),
                ),
            ]),
          ),
      });

    assertDslMatchesNode(document, expected);
  });

  it('matches namedEvent helper parity with and without payload', () => {
    const document = DocBuilder.doc()
      .name('Named event step parity')
      .onInit('initialize', (steps) =>
        steps
          .namedEvent('EmitAdHoc', 'AD_HOC', (payload) =>
            payload.put('flag', true),
          )
          .namedEvent('EmitNamed', 'NAMED')
          .namedEvent('EmitNamedWithPayload', 'NAMED_PAYLOAD', (payload) =>
            payload.put('status', 'ok'),
          ),
      )
      .buildDocument();

    const expected = new BlueNode()
      .setName('Named event step parity')
      .setContracts({
        initLifecycleChannel: new BlueNode()
          .setType('Core/Lifecycle Event Channel')
          .addProperty(
            'event',
            new BlueNode().setType('Core/Document Processing Initiated'),
          ),
        initialize: new BlueNode()
          .setType('Conversation/Sequential Workflow')
          .addProperty(
            'channel',
            new BlueNode().setValue('initLifecycleChannel'),
          )
          .addProperty(
            'steps',
            new BlueNode().setItems([
              buildNamedEventStep('EmitAdHoc', 'AD_HOC', { flag: true }),
              buildNamedEventStep('EmitNamed', 'NAMED'),
              buildNamedEventStep('EmitNamedWithPayload', 'NAMED_PAYLOAD', {
                status: 'ok',
              }),
            ]),
          ),
      });

    assertDslMatchesNode(document, expected);
  });

  it('matches bootstrap document builders parity', () => {
    const child = new BlueNode().setName('Child Doc').setType('Demo/Child');

    const document = DocBuilder.doc()
      .name('Bootstrap parity')
      .onInit('bootstrap', (steps) =>
        steps
          .bootstrapDocument(
            'BootstrapNode',
            child,
            { participantA: 'aliceChannel' },
            (options) =>
              options
                .assignee('orchestratorChannel')
                .defaultMessage('You have been added.')
                .channelMessage('participantA', 'Please review and accept.'),
          )
          .bootstrapDocumentExpr(
            'BootstrapExpr',
            "document('/childTemplate')",
            { participantB: 'bobChannel' },
            (options) => options.assignee('myOsAdminChannel'),
          ),
      )
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: Bootstrap parity
contracts:
  initLifecycleChannel:
    type: Core/Lifecycle Event Channel
    event:
      type: Core/Document Processing Initiated
  bootstrap:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - name: BootstrapNode
        type: Conversation/Trigger Event
        event:
          type: Conversation/Document Bootstrap Requested
          document:
            name: Child Doc
            type: Demo/Child
          channelBindings:
            participantA: aliceChannel
          bootstrapAssignee: orchestratorChannel
          initialMessages:
            defaultMessage: You have been added.
            perChannel:
              participantA: Please review and accept.
      - name: BootstrapExpr
        type: Conversation/Trigger Event
        event:
          type: Conversation/Document Bootstrap Requested
          document: \${document('/childTemplate')}
          channelBindings:
            participantB: bobChannel
          bootstrapAssignee: myOsAdminChannel
`,
    );
  });

  it('requires explicit step names for event emit helpers', () => {
    const steps = new StepsBuilder();

    expect(() =>
      steps.triggerEvent(' ', new BlueNode().setType('Conversation/Event')),
    ).toThrow('Step name cannot be empty.');
    expect(() => steps.emit('', { type: 'Conversation/Chat Message' })).toThrow(
      'Step name cannot be empty.',
    );
    expect(() => steps.emitType('', 'Conversation/Chat Message')).toThrow(
      'Step name cannot be empty.',
    );
    expect(() => steps.namedEvent('', 'event-name')).toThrow(
      'Step name cannot be empty.',
    );
    expect(() => steps.namedEvent('Named', ' ')).toThrow(
      'Event name cannot be empty.',
    );
  });

  it('rejects null extension factories and null extensions', () => {
    const steps = new StepsBuilder();

    expect(() => steps.ext(null)).toThrow('extensionFactory cannot be null');
    expect(() => steps.ext(() => null)).toThrow(
      'extensionFactory cannot return null',
    );
  });

  it('supports custom step extensions', () => {
    const document = DocBuilder.doc()
      .name('Custom extension parity')
      .onInit('initialize', (steps) => {
        const extension = steps.ext((parent) => new DemoExtension(parent));
        extension.emitDemo('EXT_SIGNAL');
      })
      .buildDocument();

    const expected = new BlueNode()
      .setName('Custom extension parity')
      .setContracts({
        initLifecycleChannel: new BlueNode()
          .setType('Core/Lifecycle Event Channel')
          .addProperty(
            'event',
            new BlueNode().setType('Core/Document Processing Initiated'),
          ),
        initialize: new BlueNode()
          .setType('Conversation/Sequential Workflow')
          .addProperty(
            'channel',
            new BlueNode().setValue('initLifecycleChannel'),
          )
          .addProperty(
            'steps',
            new BlueNode().setItems([
              buildNamedEventStep('DemoStep', 'EXT_SIGNAL'),
            ]),
          ),
      });

    assertDslMatchesNode(document, expected);
  });
});

function buildNamedEventStep(
  stepName: string,
  eventName: string,
  payload?: Record<string, boolean | string>,
): BlueNode {
  const event = new BlueNode()
    .setType('Common/Named Event')
    .addProperty('name', new BlueNode().setValue(eventName));
  if (payload) {
    const payloadNode = new BlueNode().setProperties({});
    for (const [key, value] of Object.entries(payload)) {
      payloadNode.addProperty(key, new BlueNode().setValue(value));
    }
    event.addProperty('payload', payloadNode);
  }

  return new BlueNode()
    .setName(stepName)
    .setType('Conversation/Trigger Event')
    .addProperty('event', event);
}

function buildPatchEntry(op: string, path: string, value: BlueNode): BlueNode {
  return new BlueNode().setProperties({
    op: new BlueNode().setValue(op),
    path: new BlueNode().setValue(path),
    val: value,
  });
}

function buildUpdateDocumentStep(
  stepName: string,
  entries: BlueNode[],
): BlueNode {
  return new BlueNode()
    .setName(stepName)
    .setType('Conversation/Update Document')
    .addProperty('changeset', new BlueNode().setItems(entries));
}

function buildTriggerEventStep(stepName: string, event: BlueNode): BlueNode {
  return new BlueNode()
    .setName(stepName)
    .setType('Conversation/Trigger Event')
    .addProperty('event', event);
}

class DemoExtension {
  constructor(private readonly parent: StepsBuilder) {}

  emitDemo(signal: string): StepsBuilder {
    return this.parent.namedEvent('DemoStep', signal);
  }
}
