package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.model.MyOSTimelineChannel;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MyOSTimelineChannelProcessorTest {

    @Test
    void matchesTimelineEventsAndUsesRecencyComparison() {
        MyOSTimelineChannelProcessor processor = new MyOSTimelineChannelProcessor();
        MyOSTimelineChannel contract = new MyOSTimelineChannel();
        contract.setTimelineId("owner-42");

        Node current = new Node()
                .type(new Node().blueId("MyOS/MyOS Timeline Entry"))
                .properties("eventId", new Node().value("evt-current"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")))
                .properties("revision", new Node().value(new BigInteger("9")));
        ChannelEvaluationContext context = new ChannelEvaluationContext("/", "myos", current, null, null, null, null);

        assertTrue(processor.matches(contract, context));
        assertEquals("evt-current", processor.eventId(contract, context));
        assertTrue(processor.isNewerEvent(contract, context,
                new Node().properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")))
                        .properties("revision", new Node().value(new BigInteger("8")))));
        assertFalse(processor.isNewerEvent(contract, context,
                new Node().properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")))
                        .properties("revision", new Node().value(new BigInteger("12")))));
    }

    @Test
    void matchesConversationTimelineEntriesInAdditionToMyOSEntries() {
        MyOSTimelineChannelProcessor processor = new MyOSTimelineChannelProcessor();
        MyOSTimelineChannel contract = new MyOSTimelineChannel();
        contract.setTimelineId("owner-42");

        Node conversationEntry = new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")));
        Node myosEntry = new Node()
                .type(new Node().blueId("MyOS/MyOS Timeline Entry"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")));

        ChannelEvaluationContext conversationContext = new ChannelEvaluationContext(
                "/", "myos", conversationEntry, null, null, null, null);
        ChannelEvaluationContext myosContext = new ChannelEvaluationContext(
                "/", "myos", myosEntry, null, null, null, null);

        assertTrue(processor.matches(contract, conversationContext));
        assertTrue(processor.matches(contract, myosContext));
    }

    @Test
    void ignoresEventsWithoutMatchingTimelineId() {
        MyOSTimelineChannelProcessor processor = new MyOSTimelineChannelProcessor();
        MyOSTimelineChannel contract = new MyOSTimelineChannel();
        contract.setTimelineId("owner-42");

        Node randomEvent = new Node().type(new Node().blueId("RandomEvent"));
        Node mismatchedTimeline = new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-7")));

        ChannelEvaluationContext randomContext = new ChannelEvaluationContext(
                "/", "myos", randomEvent, null, null, null, null);
        ChannelEvaluationContext mismatchContext = new ChannelEvaluationContext(
                "/", "myos", mismatchedTimeline, null, null, null, null);

        assertFalse(processor.matches(contract, randomContext));
        assertFalse(processor.matches(contract, mismatchContext));
    }

    @Test
    void rejectsNonTimelineEventsEvenWhenTimelineIdMatches() {
        MyOSTimelineChannelProcessor processor = new MyOSTimelineChannelProcessor();
        MyOSTimelineChannel contract = new MyOSTimelineChannel();
        contract.setTimelineId("owner-42");

        Node randomEvent = new Node()
                .type(new Node().blueId("RandomEvent"))
                .properties("timeline", new Node().properties("timelineId", new Node().value("owner-42")));
        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/", "myos", randomEvent, null, null, null, null);

        assertFalse(processor.matches(contract, context));
        assertNull(processor.channelize(contract, context));
    }
}
