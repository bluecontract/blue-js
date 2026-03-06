/*
Java references:
- references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java
*/

import { BlueNode } from '@blue-labs/language';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import { StepsBuilder } from '../lib';
import { createBlue } from './processor-harness';

const blue = createBlue();

describe('StepsBuilder core behavior', () => {
  it('builds JavaScript and update-document steps', () => {
    const steps = new StepsBuilder()
      .jsRaw('RunCode', 'return { events: [] };')
      .replaceValue('SetCounter', '/counter', 2)
      .replaceExpression(
        'EvalCounter',
        '/counter',
        "document('/counter') + event.message.request",
      )
      .build();

    expect(steps).toHaveLength(3);
    expect(steps[0]?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/JavaScript Code'],
    );
    expect(steps[1]?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Update Document'],
    );
    expect(
      steps[2]
        ?.getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toBe("${document('/counter') + event.message.request}");
  });

  it('builds trigger-event, emit, emitType, and raw steps while cloning raw inputs', () => {
    const providedEvent = blue.jsonValueToNode({
      type: 'Conversation/Event',
      kind: 'Provided Event',
    });
    const rawStep = new BlueNode()
      .setName('RawStep')
      .setType(
        blue
          .jsonValueToNode({ type: 'Conversation/JavaScript Code' })
          .getType() as BlueNode,
      )
      .addProperty('code', blue.jsonValueToNode('return { events: [] };'));

    const steps = new StepsBuilder()
      .triggerEvent('TriggerProvided', providedEvent)
      .emit('EmitObject', {
        type: 'Conversation/Event',
        kind: 'Emit Event',
      })
      .emitType('EmitTyped', 'Conversation/Event', (eventNode) => {
        eventNode.addProperty('kind', blue.jsonValueToNode('Typed Event'));
      })
      .raw(rawStep)
      .build();

    rawStep.addProperty('code', blue.jsonValueToNode('mutated'));

    expect(steps).toHaveLength(4);
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Provided Event');
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Emit Event');
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Typed Event');
    expect(steps[3]?.getProperties()?.code?.getValue()).toBe(
      'return { events: [] };',
    );
  });
});
