package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.DeriveChannelSetPropertyContractProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.processor.model.TestEvent;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocumentProcessorDerivedChannelTest {

    @Test
    void initializationSupportsDerivedHandlerChannelWhenChannelIsOmitted() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new DeriveChannelSetPropertyContractProcessor());

        Node document = blue.yamlToNode("name: Derived Channel Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  setX:\n" +
                "    type:\n" +
                "      blueId: DeriveChannelSetProperty\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 5\n");

        Node initialized = blue.initializeDocument(document).document();
        Node event = blue.objectToNode(new TestEvent().eventId("evt-1").kind("run"));
        Node processed = blue.processDocument(initialized, event).document();

        assertEquals(new BigInteger("5"), processed.getProperties().get("x").getValue());
    }

    @Test
    void initializationFailsWhenDerivedChannelDoesNotExist() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new DeriveChannelSetPropertyContractProcessor());

        Node document = blue.yamlToNode("name: Missing Derived Channel Doc\n" +
                "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  setX:\n" +
                "    type:\n" +
                "      blueId: DeriveChannelSetProperty\n" +
                "    fallbackChannel: unknown\n" +
                "    propertyKey: /x\n" +
                "    propertyValue: 5\n");

        assertThrows(IllegalStateException.class, () -> blue.initializeDocument(document));
    }
}
