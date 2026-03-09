/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
*/

import { BlueNode } from '@blue-labs/language';
import { blueIds as commonBlueIds } from '@blue-repository/types/packages/common/blue-ids';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { DocBuilder, StepsBuilder } from '../lib';
import { createBlue } from './processor-harness';

const blue = createBlue();

describe('DocBuilder step parity', () => {
  it('builds the stage-2 step primitives and emit helpers', () => {
    const rawStep = new BlueNode()
      .setName('RawStep')
      .setType(
        blue
          .jsonValueToNode({ type: 'Conversation/JavaScript Code' })
          .getType() as BlueNode,
      )
      .addProperty('code', blue.jsonValueToNode('return { done: true };'));

    const built = DocBuilder.doc()
      .name('Step primitive parity')
      .field('/counter', 1)
      .onInit('initialize', (steps) =>
        steps
          .jsRaw('Compute', 'return { next: 2 };')
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
            blue.jsonValueToNode({
              type: 'Conversation/Chat Message',
              message: 'from-trigger',
            }),
          )
          .emit('EmitObject', {
            type: 'Conversation/Chat Message',
            message: 'from-bean',
          })
          .emitType('EmitTyped', 'Integer', (payload) =>
            payload
              .put('value', 7)
              .putExpression('total', "document('/counter') + 3"),
          )
          .namedEvent('EmitAdHoc', 'AD_HOC', (payload) =>
            payload.put('flag', true),
          )
          .namedEvent('EmitNamed', 'NAMED')
          .namedEvent('EmitNamedWithPayload', 'NAMED_PAYLOAD', (payload) =>
            payload.put('status', 'ok'),
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

    const steps =
      built.getContracts()?.initialize?.getProperties()?.steps?.getItems() ??
      [];

    expect(steps).toHaveLength(12);
    expect(steps[0]?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/JavaScript Code'],
    );
    expect(steps[0]?.getProperties()?.code?.getValue()).toBe(
      'return { next: 2 };',
    );

    const applyPatch = steps[1]?.getProperties()?.changeset?.getItems() ?? [];
    expect(applyPatch[0]?.getProperties()?.op?.getValue()).toBe('add');
    expect(applyPatch[0]?.getProperties()?.path?.getValue()).toBe('/items/0');
    expect(applyPatch[1]?.getProperties()?.op?.getValue()).toBe('replace');
    expect(applyPatch[2]?.getProperties()?.val?.getValue()).toBe(
      "${document('/counter') + 1}",
    );
    expect(applyPatch[3]?.getProperties()?.op?.getValue()).toBe('remove');

    expect(steps[2]?.getProperties()?.changeset?.getValue()).toBe(
      '${steps.Compute.nextChangeset}',
    );

    expect(steps[3]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    expect(
      steps[3]?.getProperties()?.event?.getProperties()?.message?.getValue(),
    ).toBe('from-trigger');
    expect(steps[4]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    expect(
      steps[4]?.getProperties()?.event?.getProperties()?.message?.getValue(),
    ).toBe('from-bean');

    expect(
      String(
        steps[5]?.getProperties()?.event?.getProperties()?.value?.getValue(),
      ),
    ).toBe('7');
    expect(
      steps[5]?.getProperties()?.event?.getProperties()?.total?.getValue(),
    ).toBe("${document('/counter') + 3}");

    expect(steps[6]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      commonBlueIds['Common/Named Event'],
    );
    expect(steps[6]?.getProperties()?.event?.getName()).toBe('AD_HOC');
    expect(
      steps[6]?.getProperties()?.event?.getProperties()?.flag?.getValue(),
    ).toBe(true);
    expect(steps[7]?.getProperties()?.event?.getName()).toBe('NAMED');
    expect(steps[8]?.getProperties()?.event?.getName()).toBe('NAMED_PAYLOAD');
    expect(
      steps[8]?.getProperties()?.event?.getProperties()?.status?.getValue(),
    ).toBe('ok');

    expect(
      steps[9]
        ?.getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toBe('ready');
    expect(
      steps[10]
        ?.getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toBe("${document('/counter') + 5}");
    expect(steps[11]?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/JavaScript Code'],
    );
    expect(steps[11]?.getProperties()?.code?.getValue()).toBe(
      'return { done: true };',
    );
  });

  it('maps bootstrap document bindings and options', () => {
    const child = new BlueNode()
      .setName('Child Doc')
      .setType(new BlueNode().setValue('Demo/Child').setInlineValue(true));

    const built = DocBuilder.doc()
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

    const steps =
      built.getContracts()?.bootstrap?.getProperties()?.steps?.getItems() ?? [];

    const firstEvent = steps[0]?.getProperties()?.event;
    expect(firstEvent?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );
    expect(firstEvent?.getProperties()?.document?.getName()).toBe('Child Doc');
    expect(
      firstEvent
        ?.getProperties()
        ?.channelBindings?.getProperties()
        ?.participantA?.getValue(),
    ).toBe('aliceChannel');
    expect(firstEvent?.getProperties()?.bootstrapAssignee?.getValue()).toBe(
      'orchestratorChannel',
    );
    expect(
      firstEvent
        ?.getProperties()
        ?.initialMessages?.getProperties()
        ?.defaultMessage?.getValue(),
    ).toBe('You have been added.');
    expect(
      firstEvent
        ?.getProperties()
        ?.initialMessages?.getProperties()
        ?.perChannel?.getProperties()
        ?.participantA?.getValue(),
    ).toBe('Please review and accept.');

    const secondEvent = steps[1]?.getProperties()?.event;
    expect(secondEvent?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );
    expect(secondEvent?.getProperties()?.document?.getValue()).toBe(
      "${document('/childTemplate')}",
    );
    expect(
      secondEvent
        ?.getProperties()
        ?.channelBindings?.getProperties()
        ?.participantB?.getValue(),
    ).toBe('bobChannel');
    expect(secondEvent?.getProperties()?.bootstrapAssignee?.getValue()).toBe(
      'myOsAdminChannel',
    );
  });

  it('requires explicit step names for event emit helpers', () => {
    const steps = new StepsBuilder();

    expect(() =>
      steps.triggerEvent(
        null as unknown as string,
        blue.jsonValueToNode({ type: 'Conversation/Event' }),
      ),
    ).toThrowError('step name is required');
    expect(() =>
      steps.emit(' ', {
        type: 'Conversation/Chat Message',
        message: 'x',
      }),
    ).toThrowError('step name is required');
    expect(() =>
      steps.emitType('', 'Conversation/Chat Message', (payload) =>
        payload.put('message', 'x'),
      ),
    ).toThrowError('step name is required');
    expect(() => steps.namedEvent('', 'event-name')).toThrowError(
      'step name is required',
    );
    expect(() => steps.namedEvent('Named', ' ')).toThrowError(
      'eventName cannot be blank',
    );
  });

  it('rejects blank bootstrap document expressions', () => {
    const steps = new StepsBuilder();

    expect(() =>
      steps.bootstrapDocumentExpr('BootstrapExpr', ' ', {
        participantA: 'aliceChannel',
      }),
    ).toThrowError('documentExpression cannot be blank');
  });

  it('rejects null extension factories and null extension returns', () => {
    const steps = new StepsBuilder();

    expect(() =>
      steps.ext(null as unknown as (steps: StepsBuilder) => unknown),
    ).toThrowError('extensionFactory cannot be null');
    expect(() => steps.ext(() => null)).toThrowError(
      'extensionFactory cannot return null',
    );
  });

  it('supports custom step extensions', () => {
    class DemoExtension {
      constructor(private readonly parent: StepsBuilder) {}

      emitDemo(signal: string) {
        return this.parent.namedEvent('DemoStep', signal);
      }
    }

    const built = DocBuilder.doc()
      .name('Custom extension parity')
      .onInit('initialize', (steps) => {
        const extension = steps.ext((parent) => new DemoExtension(parent));
        extension.emitDemo('EXT_SIGNAL');
      })
      .buildDocument();

    const event =
      built
        .getContracts()
        ?.initialize?.getProperties()
        ?.steps?.getItems()?.[0]
        ?.getProperties()?.event ?? null;

    expect(event?.getType()?.getBlueId()).toBe(
      commonBlueIds['Common/Named Event'],
    );
    expect(event?.getName()).toBe('EXT_SIGNAL');
  });
});
