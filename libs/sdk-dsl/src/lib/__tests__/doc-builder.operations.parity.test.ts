/**
 * Java reference:
 * - references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java
 */
import { BlueNode } from '@blue-labs/language';

import { DocBuilder } from '../../index.js';
import { assertDslMatchesYaml } from '../test-support/dsl-parity.js';
import { createTestBlue } from '../test-support/create-blue.js';

describe('DocBuilder operations parity', () => {
  const blue = createTestBlue();

  it('adds an implementation contract when editing an existing operation', () => {
    const base = DocBuilder.doc()
      .name('Shipment document')
      .channel('shipmentCompanyChannel')
      .operation(
        'confirmShipment',
        'shipmentCompanyChannel',
        'Integer',
        'Confirm that the shipment is complete.',
      )
      .buildDocument();

    expect(base.getContracts()?.confirmShipmentImpl).toBeUndefined();

    const edited = DocBuilder.edit(base)
      .operation('confirmShipment')
      .steps((steps) =>
        steps
          .emitType('ShipmentConfirmed', 'Conversation/Event', (eventNode) => {
            eventNode.addProperty(
              'kind',
              new BlueNode().setValue('Shipment Confirmed'),
            );
          })
          .jsRaw(
            'Confirm Shipment',
            "return { events: [{ type: 'PayNote/Card Transaction Capture Unlock Requested' }] };",
          ),
      )
      .done()
      .buildDocument();

    const implementation = edited.getContracts()?.confirmShipmentImpl;
    expect(implementation).toBeInstanceOf(BlueNode);
    expect(implementation?.getProperties()?.operation?.getValue()).toBe(
      'confirmShipment',
    );
    expect(
      implementation
        ?.getProperties()
        ?.steps?.getItems()?.[0]
        ?.getProperties()
        ?.event?.getType()
        ?.getBlueId(),
    ).toBe(blue.yamlToNode('type: Conversation/Event').getType()?.getBlueId());
    expect(
      implementation
        ?.getProperties()
        ?.steps?.getItems()?.[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.kind?.getValue(),
    ).toBe('Shipment Confirmed');
  });

  it('can append another operation while editing a document with an existing implementation', () => {
    const base = DocBuilder.doc()
      .name('Counter operations')
      .channel('ownerChannel')
      .operation(
        'increment',
        'ownerChannel',
        'Integer',
        'Increment counter',
        (steps) =>
          steps.replaceExpression(
            'ApplyIncrement',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .buildDocument();

    const edited = DocBuilder.edit(base)
      .operation('decrement')
      .channel('ownerChannel')
      .description('Decrement counter')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyDecrement',
          '/counter',
          "document('/counter') - event.message.request",
        ),
      )
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      edited,
      `
name: Counter operations
contracts:
  ownerChannel:
    type: Core/Channel
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment counter
    request:
      type: Integer
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps:
      - name: ApplyIncrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: \${document('/counter') + event.message.request}
  decrement:
    type: Conversation/Operation
    channel: ownerChannel
    description: Decrement counter
    request:
      type: Integer
  decrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: decrement
    steps:
      - name: ApplyDecrement
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: /counter
            val: \${document('/counter') - event.message.request}
`,
    );
  });

  it('accepts an object schema for operation builder request', () => {
    const document = DocBuilder.doc()
      .name('Custom request schema')
      .channel('ownerChannel')
      .operation('emit')
      .channel('ownerChannel')
      .request({
        type: 'Dictionary',
        entries: {
          amount: {
            type: 'Integer',
          },
          event: {
            type: 'Conversation/Event',
          },
        },
      })
      .done()
      .buildDocument();

    assertDslMatchesYaml(
      document,
      `
name: Custom request schema
contracts:
  ownerChannel:
    type: Core/Channel
  emit:
    type: Conversation/Operation
    channel: ownerChannel
    request:
      type: Dictionary
      entries:
        amount:
          type: Integer
        event:
          type: Conversation/Event
`,
    );
  });
});
