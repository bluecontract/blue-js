/**
 * Java reference:
 * - references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java
 */
import { BlueNode } from '@blue-labs/language';

import { StepsBuilder } from '../../index.js';
import { createTestBlue } from '../../__tests__/support/create-blue.js';

describe('StepsBuilder core step construction', () => {
  const blue = createTestBlue();

  it('builds jsRaw and replace steps', () => {
    const steps = new StepsBuilder()
      .jsRaw('Compute', 'return 1;')
      .replaceValue('SetValue', '/counter', 5)
      .replaceExpression('SetExpr', '/total', "document('/counter') + 1")
      .build();

    expect(steps[0].getType()?.getBlueId()).toBe(
      blue
        .yamlToNode('type: Conversation/JavaScript Code')
        .getType()
        ?.getBlueId(),
    );
    expect(steps[0].getProperties()?.code?.getValue()).toBe('return 1;');

    expect(steps[1].getType()?.getBlueId()).toBe(
      blue
        .yamlToNode('type: Conversation/Update Document')
        .getType()
        ?.getBlueId(),
    );
    expect(
      steps[1]
        .getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toHaveProperty('toString');
    expect(
      String(
        steps[1]
          .getProperties()
          ?.changeset?.getItems()?.[0]
          ?.getProperties()
          ?.val?.getValue(),
      ),
    ).toBe('5');

    expect(
      steps[2]
        .getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toBe("${document('/counter') + 1}");
  });

  it('builds triggerEvent emit and emitType steps', () => {
    const steps = new StepsBuilder()
      .triggerEvent(
        'TriggerRaw',
        new BlueNode()
          .setType('Conversation/Event')
          .addProperty('kind', new BlueNode().setValue('Raw')),
      )
      .emit('EmitObject', {
        type: 'Conversation/Event',
        kind: 'Object',
      })
      .emitType('EmitTyped', 'Conversation/Event', (eventNode) => {
        eventNode.addProperty('kind', new BlueNode().setValue('Typed'));
      })
      .build();

    expect(steps).toHaveLength(3);
    expect(
      steps[0].getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Raw');
    expect(
      steps[1].getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Object');
    expect(
      steps[2].getProperties()?.event?.getProperties()?.kind?.getValue(),
    ).toBe('Typed');
  });

  it('clones raw steps before appending', () => {
    const rawStep = new BlueNode()
      .setName('RawStep')
      .setType('Conversation/JavaScript Code')
      .addProperty('code', new BlueNode().setValue('return 1;'));

    const built = new StepsBuilder().raw(rawStep).build();

    rawStep.getProperties()?.code?.setValue('return 2;');

    expect(built[0]).not.toBe(rawStep);
    expect(built[0].getProperties()?.code?.getValue()).toBe('return 1;');
  });

  it('requires a non-empty step name for triggerEvent', () => {
    expect(() =>
      new StepsBuilder().triggerEvent('   ', new BlueNode().setType('Text')),
    ).toThrow('Step name cannot be empty.');
  });
});
