package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.IncrementPropertyContractProcessor;
import blue.language.processor.contracts.SetPropertyContractProcessor;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class MyOSTimelineChannelIntegrationParityTest {

    @Test
    void processesMyOSTimelineEntriesWhenTimelineIdsAlign() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseMyOSTimelineDocument(blue));

        Node myosEntry = timelineEntryEvent(blue, "MyOS/MyOS Timeline Entry", "evt-1", "alice-timeline");
        DocumentProcessingResult result = blue.processDocument(initialized.document().clone(), myosEntry);

        assertEquals(new BigInteger("1500"), result.document().getProperties().get("price").getValue());
        assertEquals(new BigInteger("1"), result.document().getProperties().get("count").getValue());

        Node storedEvent = ProcessorEngine.nodeAt(result.document(), "/contracts/checkpoint/lastEvents/myosTimelineChannel");
        assertNotNull(storedEvent);
        assertEquals("MyOS/MyOS Timeline Entry", typeBlueId(storedEvent));
    }

    @Test
    void matchesConversationTimelineEntriesInAdditionToMyOSEntries() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseMyOSTimelineDocument(blue));

        Node conversationEntry = timelineEntryEvent(blue, "Conversation/Timeline Entry", "evt-1", "alice-timeline");
        DocumentProcessingResult result = blue.processDocument(initialized.document().clone(), conversationEntry);

        assertEquals(new BigInteger("1500"), result.document().getProperties().get("price").getValue());
        assertEquals(new BigInteger("1"), result.document().getProperties().get("count").getValue());
    }

    @Test
    void ignoresEventsThatAreNotTimelineEntriesOrHaveMismatchedIds() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseMyOSTimelineDocument(blue));

        Node randomEvent = blue.yamlToNode("type:\n" +
                "  blueId: RandomEvent\n");
        DocumentProcessingResult afterRandom = blue.processDocument(initialized.document().clone(), randomEvent);
        assertNull(afterRandom.document().getProperties().get("price"));
        assertNull(afterRandom.document().getProperties().get("count"));

        Node randomWithTimeline = blue.yamlToNode("type:\n" +
                "  blueId: RandomEvent\n" +
                "timeline:\n" +
                "  timelineId: alice-timeline\n");
        DocumentProcessingResult afterRandomWithTimeline = blue.processDocument(afterRandom.document().clone(), randomWithTimeline);
        assertNull(afterRandomWithTimeline.document().getProperties().get("price"));
        assertNull(afterRandomWithTimeline.document().getProperties().get("count"));

        Node mismatchedMyOS = timelineEntryEvent(blue, "MyOS/MyOS Timeline Entry", "evt-2", "bob-timeline");
        DocumentProcessingResult afterMyOSMismatch = blue.processDocument(afterRandomWithTimeline.document().clone(), mismatchedMyOS);
        assertNull(afterMyOSMismatch.document().getProperties().get("price"));
        assertNull(afterMyOSMismatch.document().getProperties().get("count"));

        Node mismatchedConversation = timelineEntryEvent(
                blue,
                "Conversation/Timeline Entry",
                "evt-3",
                "charlie-timeline");
        DocumentProcessingResult afterConversationMismatch = blue.processDocument(
                afterMyOSMismatch.document().clone(),
                mismatchedConversation);
        assertNull(afterConversationMismatch.document().getProperties().get("price"));
        assertNull(afterConversationMismatch.document().getProperties().get("count"));
    }

    private Blue createBlueWithTimelineTestProcessors() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new SetPropertyContractProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());
        return blue;
    }

    private Node baseMyOSTimelineDocument(Blue blue) {
        return blue.yamlToNode("name: MyOS Timeline Test\n" +
                "contracts:\n" +
                "  myosTimelineChannel:\n" +
                "    type:\n" +
                "      blueId: MyOS/MyOS Timeline Channel\n" +
                "    timelineId: alice-timeline\n" +
                "  setPrice:\n" +
                "    channel: myosTimelineChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /price\n" +
                "    propertyValue: 1500\n" +
                "  bumpCount:\n" +
                "    channel: myosTimelineChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /count\n");
    }

    private Node timelineEntryEvent(Blue blue, String entryTypeBlueId, String eventId, String timelineId) {
        return blue.yamlToNode("type:\n" +
                "  blueId: " + entryTypeBlueId + "\n" +
                "eventId: " + eventId + "\n" +
                "timeline:\n" +
                "  timelineId: " + timelineId + "\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: SetPrice\n" +
                "  kind: set-price\n" +
                "  amount: 1500\n" +
                "actor:\n" +
                "  name: System\n" +
                "timestamp: 1700000000\n");
    }

    private String typeBlueId(Node node) {
        if (node == null) {
            return null;
        }
        if (node.getType() != null && node.getType().getBlueId() != null) {
            return node.getType().getBlueId();
        }
        if (node.getProperties() != null && node.getProperties().get("type") != null) {
            Node type = node.getProperties().get("type");
            if (type.getProperties() != null && type.getProperties().get("blueId") != null) {
                Object value = type.getProperties().get("blueId").getValue();
                return value != null ? String.valueOf(value) : null;
            }
            if (type.getValue() != null) {
                return String.valueOf(type.getValue());
            }
        }
        return null;
    }
}
