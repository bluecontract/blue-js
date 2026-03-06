package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.contracts.IncrementPropertyContractProcessor;
import blue.language.processor.contracts.SetPropertyContractProcessor;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TimelineChannelProcessorIntegrationParityTest {

    @Test
    void ignoresNonTimelineEventsAndMismatchedTimelineIds() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseTimelineDocument(blue));

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

        Node mismatched = timelineEntryEvent(blue, "evt-1", "bob-timeline", "set-price", 1500, 1700000000L);
        DocumentProcessingResult afterMismatch = blue.processDocument(afterRandomWithTimeline.document().clone(), mismatched);
        assertNull(afterMismatch.document().getProperties().get("price"));
        assertNull(afterMismatch.document().getProperties().get("count"));
    }

    @Test
    void deliversTimelineEntriesToHandlersAndStoresCheckpointMetadata() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseTimelineDocument(blue));

        Node matchingEntry = timelineEntryEvent(blue, "evt-1", "alice-timeline", "set-price", 1500, 1700000000L);
        DocumentProcessingResult afterMatching = blue.processDocument(initialized.document().clone(), matchingEntry);

        assertFalse(afterMatching.capabilityFailure());
        assertEquals(new BigInteger("1500"), afterMatching.document().getProperties().get("price").getValue());
        assertEquals(new BigInteger("1"), afterMatching.document().getProperties().get("count").getValue());

        Node storedEvent = ProcessorEngine.nodeAt(afterMatching.document(), "/contracts/checkpoint/lastEvents/timelineChannel");
        assertNotNull(storedEvent);
        assertEquals("Conversation/Timeline Entry", typeBlueId(storedEvent));
        assertEquals("alice-timeline",
                String.valueOf(storedEvent.getProperties().get("timeline").getProperties().get("timelineId").getValue()));
        assertEquals(new BigInteger("1700000000"), storedEvent.getProperties().get("timestamp").getValue());
    }

    @Test
    void skipsDuplicateTimelineEntriesUsingEntryEventId() {
        Blue blue = createBlueWithTimelineTestProcessors();
        DocumentProcessingResult initialized = blue.initializeDocument(baseTimelineDocument(blue));

        Node firstEntry = timelineEntryEvent(blue, "evt-1", "alice-timeline", "set-price", 1500, 1700000000L);
        DocumentProcessingResult afterFirst = blue.processDocument(initialized.document().clone(), firstEntry);
        assertEquals(new BigInteger("1"), afterFirst.document().getProperties().get("count").getValue());

        DocumentProcessingResult afterDuplicate = blue.processDocument(afterFirst.document().clone(), firstEntry.clone());
        assertEquals(new BigInteger("1"), afterDuplicate.document().getProperties().get("count").getValue());
    }

    @Test
    void respectsChannelLevelEventFiltersWhenProvided() {
        Blue blue = createBlueWithTimelineTestProcessors();
        Node filteredDocument = blue.yamlToNode("name: Timeline Channel Filter Test\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice-timeline\n" +
                "    event:\n" +
                "      message:\n" +
                "        kind: set-price\n" +
                "  setPrice:\n" +
                "    channel: timelineChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /price\n" +
                "    propertyValue: 1500\n" +
                "  bumpCount:\n" +
                "    channel: timelineChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /count\n");

        DocumentProcessingResult initialized = blue.initializeDocument(filteredDocument);
        Node matchingEntry = timelineEntryEvent(blue, "evt-1", "alice-timeline", "set-price", 1500, 1700000000L);
        DocumentProcessingResult afterMatching = blue.processDocument(initialized.document().clone(), matchingEntry);
        assertEquals(new BigInteger("1"), afterMatching.document().getProperties().get("count").getValue());

        Node nonMatchingEntry = timelineEntryEvent(blue, "evt-2", "alice-timeline", "adjust-price", 1500, 1700000100L);
        DocumentProcessingResult afterNonMatching = blue.processDocument(afterMatching.document().clone(), nonMatchingEntry);
        assertEquals(new BigInteger("1"), afterNonMatching.document().getProperties().get("count").getValue());
    }

    private Blue createBlueWithTimelineTestProcessors() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new SetPropertyContractProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());
        return blue;
    }

    private Node baseTimelineDocument(Blue blue) {
        return blue.yamlToNode("name: Timeline Test\n" +
                "contracts:\n" +
                "  timelineChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Timeline Channel\n" +
                "    timelineId: alice-timeline\n" +
                "  setPrice:\n" +
                "    channel: timelineChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /price\n" +
                "    propertyValue: 1500\n" +
                "  bumpCount:\n" +
                "    channel: timelineChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /count\n");
    }

    private Node timelineEntryEvent(Blue blue,
                                    String eventId,
                                    String timelineId,
                                    String kind,
                                    int amount,
                                    long timestamp) {
        return blue.yamlToNode("type:\n" +
                "  blueId: Conversation/Timeline Entry\n" +
                "eventId: " + eventId + "\n" +
                "timeline:\n" +
                "  timelineId: " + timelineId + "\n" +
                "message:\n" +
                "  type:\n" +
                "    blueId: SetPrice\n" +
                "  kind: " + kind + "\n" +
                "  amount: " + amount + "\n" +
                "actor:\n" +
                "  name: System\n" +
                "timestamp: " + timestamp + "\n");
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
