/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java
*/

import { DocBuilder } from '../lib';
import { createBlue } from './processor-harness';

const blue = createBlue();

describe('DocBuilder operation parity', () => {
  it('adds an implementation contract when editing an operation that previously had none', () => {
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
              blue.jsonValueToNode('Shipment Confirmed'),
            );
          })
          .jsRaw(
            'Confirm Shipment',
            `
return {
  events: [
    {
      type: "PayNote/Card Transaction Capture Unlock Requested",
      cardTransactionDetails: document('/cardTransactionDetails')
    }
  ]
};
`,
          ),
      )
      .done()
      .buildDocument();

    const implementation = edited.getContracts()?.confirmShipmentImpl;
    expect(implementation).toBeDefined();
    expect(implementation?.getProperties()?.operation?.getValue()).toBe(
      'confirmShipment',
    );
    expect(implementation?.getProperties()?.steps?.getItems()).toHaveLength(2);
    expect(
      implementation
        ?.getProperties()
        ?.steps?.getItems()?.[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.kind?.getValue(),
    ).toBe('Shipment Confirmed');
  });

  it('can append a second operation when editing a document that already contains one implementation', () => {
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

    expect(edited.getContracts()?.increment).toBeDefined();
    expect(edited.getContracts()?.incrementImpl).toBeDefined();
    expect(edited.getContracts()?.decrement).toBeDefined();
    expect(edited.getContracts()?.decrementImpl).toBeDefined();
    expect(
      edited
        .getContracts()
        ?.decrementImpl?.getProperties()
        ?.steps?.getItems()?.[0]
        ?.getProperties()
        ?.changeset?.getItems()?.[0]
        ?.getProperties()
        ?.val?.getValue(),
    ).toBe("${document('/counter') - event.message.request}");
  });

  it('accepts a plain object request schema', () => {
    const built = DocBuilder.doc()
      .name('Custom request schema')
      .channel('ownerChannel')
      .operation('emit')
      .channel('ownerChannel')
      .request({
        type: 'List',
        items: [{ type: 'Integer' }, { type: 'Conversation/Event' }],
      })
      .done()
      .buildDocument();

    const requestNode = built.getContracts()?.emit?.getProperties()?.request;
    expect(requestNode?.getProperties()?.items?.getItems()).toHaveLength(2);
  });

  it('removes request when noRequest() is used while editing an existing operation', () => {
    const base = DocBuilder.doc()
      .name('Editable operation')
      .channel('ownerChannel')
      .operation('ack')
      .channel('ownerChannel')
      .requestType('Integer')
      .done()
      .buildDocument();

    const edited = DocBuilder.edit(base)
      .operation('ack')
      .noRequest()
      .done()
      .buildDocument();

    expect(
      edited.getContracts()?.ack?.getProperties()?.request,
    ).toBeUndefined();
  });
});
