package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.model.TimelineChannel;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TimelineChannelProcessorTest {

    @Test
    void matchesByTimelineIdAndClonesEventForChannelization() {
        TimelineChannelProcessor processor = new TimelineChannelProcessor();
        TimelineChannel contract = new TimelineChannel();
        contract.setTimelineId("owner-42");

        Node event = timelineEvent("owner-42", "evt-1", BigInteger.ONE);
        ChannelEvaluationContext context = new ChannelEvaluationContext("/", "timeline", event, null, null, null, null);

        assertTrue(processor.matches(contract, context));
        Node channelized = processor.channelize(contract, context);
        assertNotNull(channelized);
        assertEquals("evt-1", channelized.getProperties().get("eventId").getValue());
        assertTrue(channelized != event);
    }

    @Test
    void eventIdFallsBackToIdFieldAndRecencyComparisonUsesSequence() {
        TimelineChannelProcessor processor = new TimelineChannelProcessor();
        TimelineChannel contract = new TimelineChannel();
        contract.setTimelineId("owner-42");

        Node current = new Node()
                .properties("id", new Node().value("fallback-id"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")))
                .properties("sequence", new Node().value(new BigInteger("5")));
        ChannelEvaluationContext context = new ChannelEvaluationContext("/", "timeline", current, null, null, null, null);

        assertEquals("fallback-id", processor.eventId(contract, context));
        assertTrue(processor.isNewerEvent(contract, context, timelineEvent("owner-42", "evt-prev", new BigInteger("3"))));
        assertFalse(processor.isNewerEvent(contract, context, timelineEvent("owner-42", "evt-prev", new BigInteger("8"))));
    }

    @Test
    void rejectsMismatchedOrMissingTimelineId() {
        TimelineChannelProcessor processor = new TimelineChannelProcessor();
        TimelineChannel contract = new TimelineChannel();
        contract.setTimelineId("owner-42");

        ChannelEvaluationContext mismatch = new ChannelEvaluationContext(
                "/", "timeline", timelineEvent("owner-43", "evt-2", BigInteger.ONE), null, null, null, null);
        ChannelEvaluationContext missing = new ChannelEvaluationContext(
                "/", "timeline", new Node().properties("eventId", new Node().value("evt-3")), null, null, null, null);

        assertFalse(processor.matches(contract, mismatch));
        assertFalse(processor.matches(contract, missing));
    }

    @Test
    void rejectsNonTimelineEventsEvenWhenTimelineIdMatches() {
        TimelineChannelProcessor processor = new TimelineChannelProcessor();
        TimelineChannel contract = new TimelineChannel();
        contract.setTimelineId("owner-42");

        Node randomEvent = new Node()
                .type(new Node().blueId("RandomEvent"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")));
        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/", "timeline", randomEvent, null, null, null, null);

        assertFalse(processor.matches(contract, context));
        assertNull(processor.channelize(contract, context));
    }

    @Test
    void respectsChannelLevelEventFilters() {
        TimelineChannelProcessor processor = new TimelineChannelProcessor();
        TimelineChannel contract = new TimelineChannel();
        contract.setTimelineId("owner-42");
        contract.setEvent(new Node().properties(
                "message",
                new Node().properties("kind", new Node().value("set-price"))));

        ChannelEvaluationContext matching = new ChannelEvaluationContext(
                "/",
                "timeline",
                timelineEvent("owner-42", "evt-1", BigInteger.ONE)
                        .properties("message", new Node().properties("kind", new Node().value("set-price"))),
                null,
                null,
                null,
                null);
        ChannelEvaluationContext nonMatching = new ChannelEvaluationContext(
                "/",
                "timeline",
                timelineEvent("owner-42", "evt-2", BigInteger.TWO)
                        .properties("message", new Node().properties("kind", new Node().value("adjust-price"))),
                null,
                null,
                null,
                null);

        assertTrue(processor.matches(contract, matching));
        assertFalse(processor.matches(contract, nonMatching));
    }

    private Node timelineEvent(String timelineId, String eventId, BigInteger sequence) {
        return new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value(eventId))
                .properties("timeline", new Node().properties("timelineId", new Node().value(timelineId)))
                .properties("sequence", new Node().value(sequence));
    }
}
