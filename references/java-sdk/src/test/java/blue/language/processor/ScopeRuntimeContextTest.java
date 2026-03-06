package blue.language.processor;

import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScopeRuntimeContextTest {

    @Test
    void enqueuesAndDrainsTriggeredQueueRespectingCutOff() {
        ScopeRuntimeContext context = new ScopeRuntimeContext("/scope");
        Node first = new Node().properties("id", new Node().value(1));
        Node second = new Node().properties("id", new Node().value(2));
        Node third = new Node().properties("id", new Node().value(3));

        context.enqueueTriggered(first);
        context.enqueueTriggered(second);
        context.markCutOff();
        context.enqueueTriggered(third);

        assertEquals(2, context.triggeredSize());
        assertEquals(first, context.pollTriggered());
        assertEquals(second, context.pollTriggered());
        assertNull(context.pollTriggered());
    }

    @Test
    void recordsBridgeableEventsWithCutOffLimit() {
        ScopeRuntimeContext context = new ScopeRuntimeContext("/scope");
        Node first = new Node().properties("id", new Node().value(0));
        Node second = new Node().properties("id", new Node().value(1));
        Node third = new Node().properties("id", new Node().value(2));

        context.recordBridgeable(first);
        context.markCutOff();
        context.recordBridgeable(second);
        context.recordBridgeable(third);

        List<Node> drained = context.drainBridgeableEvents();
        assertEquals(1, drained.size());
        assertEquals(new BigInteger("0"), drained.get(0).getProperties().get("id").getValue());
        assertTrue(context.drainBridgeableEvents().isEmpty());
    }

    @Test
    void finalizesTerminationOnceAndClearsQueue() {
        ScopeRuntimeContext context = new ScopeRuntimeContext("/scope");
        context.enqueueTriggered(new Node().properties("id", new Node().value("event")));
        context.finalizeTermination(ScopeRuntimeContext.TerminationKind.GRACEFUL, "done");
        context.finalizeTermination(ScopeRuntimeContext.TerminationKind.FATAL, "ignored");

        assertTrue(context.isTerminated());
        assertEquals(ScopeRuntimeContext.TerminationKind.GRACEFUL, context.terminationKind());
        assertEquals("done", context.terminationReason());
        assertEquals(0, context.triggeredSize());
    }
}
