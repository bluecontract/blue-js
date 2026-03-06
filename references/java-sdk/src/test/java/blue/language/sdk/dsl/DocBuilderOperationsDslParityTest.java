package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.types.conversation.Event;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DocBuilderOperationsDslParityTest {

    @Test
    void operationWithoutStepsThenEditAddsImplementationContract() {
        Node base = DocBuilder.doc()
                .name("Shipment document")
                .channel("shipmentCompanyChannel")
                .operation(
                        "confirmShipment",
                        "shipmentCompanyChannel",
                        Integer.class,
                        "Confirm that the shipment is complete.")
                .buildDocument();

        assertNull(base.getAsNode("/contracts").getProperties().get("confirmShipmentImpl"));
        assertEquals("Conversation/Operation", base.getAsText("/contracts/confirmShipment/type/value"));
        assertEquals("shipmentCompanyChannel", base.getAsText("/contracts/confirmShipment/channel/value"));
        assertEquals("Integer", base.getAsText("/contracts/confirmShipment/request/type/value"));

        Node edited = DocBuilder.edit(base)
                .operation("confirmShipment")
                .steps(steps -> steps
                        .emitType("ShipmentConfirmed", Event.class,
                                payload -> payload.put("kind", "Shipment Confirmed"))
                        .jsRaw("Confirm Shipment", """
                                return {
                                  events: [
                                    {
                                      type: "PayNote/Card Transaction Capture Unlock Requested",
                                      cardTransactionDetails: document('/cardTransactionDetails')
                                    }
                                  ]
                                };
                                """))
                .done()
                .buildDocument();

        assertNotNull(edited.getAsNode("/contracts/confirmShipmentImpl"));
        assertEquals("Conversation/Sequential Workflow Operation",
                edited.getAsText("/contracts/confirmShipmentImpl/type/value"));
        assertEquals("confirmShipment",
                edited.getAsText("/contracts/confirmShipmentImpl/operation/value"));
        assertEquals("Conversation/Trigger Event",
                edited.getAsText("/contracts/confirmShipmentImpl/steps/0/type/value"));
        assertEquals("Conversation/Event",
                edited.getAsText("/contracts/confirmShipmentImpl/steps/0/event/type/value"));
        assertEquals("Shipment Confirmed",
                edited.getAsText("/contracts/confirmShipmentImpl/steps/0/event/kind/value"));
    }

    @Test
    void operationWithStepThenEditCanAppendAnotherOperation() {
        Node base = DocBuilder.doc()
                .name("Counter operations")
                .channel("ownerChannel")
                .operation(
                        "increment",
                        "ownerChannel",
                        Integer.class,
                        "Increment counter",
                        steps -> steps.replaceExpression("ApplyIncrement",
                                "/counter",
                                "document('/counter') + event.message.request"))
                .buildDocument();

        Node edited = DocBuilder.edit(base)
                .operation("decrement")
                .channel("ownerChannel")
                .description("Decrement counter")
                .requestType(Integer.class)
                .steps(steps -> steps.replaceExpression("ApplyDecrement",
                        "/counter",
                        "document('/counter') - event.message.request"))
                .done()
                .buildDocument();

        assertEquals("Conversation/Operation", edited.getAsText("/contracts/increment/type/value"));
        assertEquals("Conversation/Sequential Workflow Operation", edited.getAsText("/contracts/incrementImpl/type/value"));
        assertEquals("Conversation/Operation", edited.getAsText("/contracts/decrement/type/value"));
        assertEquals("Conversation/Sequential Workflow Operation", edited.getAsText("/contracts/decrementImpl/type/value"));
        assertEquals("${document('/counter') - event.message.request}",
                edited.getAsText("/contracts/decrementImpl/steps/0/changeset/0/val/value"));
    }

    @Test
    void operationBuilderRequestAcceptsObjectSchema() {
        Node requestSchema = new Node()
                .type("List")
                .properties("items", new Node().items(
                        new Node().type("Integer"),
                        new Node().type("Conversation/Event")));

        Node built = DocBuilder.doc()
                .name("Custom request schema")
                .channel("ownerChannel")
                .operation("emit")
                .channel("ownerChannel")
                .request(requestSchema)
                .done()
                .buildDocument();

        assertEquals("List", built.getAsText("/contracts/emit/request/type/value"));
        assertEquals("Integer", built.getAsText("/contracts/emit/request/items/0/type/value"));
        assertEquals("Conversation/Event", built.getAsText("/contracts/emit/request/items/1/type/value"));
    }

    @Test
    void canEmitCreatesOperationAndImplContracts() {
        Node built = DocBuilder.doc()
                .name("Can emit parity")
                .channels("aliceChannel", "bobChannel", "celineChannel")
                .canEmit("aliceChannel")
                .canEmit("bobChannel", Integer.class, Event.class)
                .canEmit("celineChannel",
                        new Node().type("Conversation/Event").properties("kind", new Node().value("Ev1")),
                        new Node().type("Conversation/Event").properties("kind", new Node().value("Ev2")))
                .buildDocument();

        assertEquals("Conversation/Operation", built.getAsText("/contracts/aliceEmit/type/value"));
        assertEquals("List", built.getAsText("/contracts/aliceEmit/request/type/value"));
        assertEquals("Conversation/Sequential Workflow Operation", built.getAsText("/contracts/aliceEmitImpl/type/value"));
        assertEquals("return { events: event };", built.getAsText("/contracts/aliceEmitImpl/steps/0/code/value"));

        assertEquals("Integer", built.getAsText("/contracts/bobEmit/request/items/0/type/value"));
        assertEquals("Conversation/Event", built.getAsText("/contracts/bobEmit/request/items/1/type/value"));

        assertEquals("Ev1", built.getAsText("/contracts/celineEmit/request/items/0/kind/value"));
        assertEquals("Ev2", built.getAsText("/contracts/celineEmit/request/items/1/kind/value"));
    }
}
