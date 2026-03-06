package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.ChannelProcessorEvaluation;
import blue.language.processor.ContractBundle;
import blue.language.processor.ContractProcessorRegistry;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.model.CompositeTimelineChannel;
import blue.language.processor.model.MyOSTimelineChannel;
import blue.language.processor.model.TimelineChannel;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CompositeTimelineChannelProcessorTest {

    @Test
    void evaluateThrowsWhenReferencedChildChannelIsMissing() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(Collections.singletonList("missing"));

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("composite", composite)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                timelineEvent("alpha", 10L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalStateException.class,
                () -> processor.evaluate(composite, context));
    }

    @Test
    void evaluateReturnsNoMatchWhenNoChildrenMatchTheEvent() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(Collections.singletonList("child"));

        TimelineChannel child = new TimelineChannel();
        child.setTimelineId("expected");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("child", child)
                .addChannel("composite", composite)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                timelineEvent("other", 1L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(composite, context);

        assertFalse(evaluation.matches());
        assertTrue(evaluation.deliveries().isEmpty());
    }

    @Test
    void evaluateBuildsDeliveriesWithCompositeCheckpointKeys() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(Collections.singletonList("childA"));

        TimelineChannel child = new TimelineChannel();
        child.setTimelineId("alpha");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("childA", child)
                .addChannel("composite", composite)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        Node event = timelineEvent("alpha", 10L);
        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                event,
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(composite, context);

        assertTrue(evaluation.matches());
        assertEquals(1, evaluation.deliveries().size());
        ChannelProcessorEvaluation.ChannelDelivery delivery = evaluation.deliveries().get(0);
        assertEquals("composite::childA", delivery.checkpointKey());
        assertEquals("10", delivery.eventId());
        assertNotNull(delivery.eventNode().getProperties().get("meta").getProperties().get("compositeSourceChannelKey"));
    }

    @Test
    void evaluateMarksDeliveryAsStaleWhenCheckpointHasNewerChildEvent() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(Collections.singletonList("child"));

        MyOSTimelineChannel child = new MyOSTimelineChannel();
        child.setTimelineId("beta");

        ChannelEventCheckpoint checkpoint = new ChannelEventCheckpoint();
        checkpoint.putEvent("composite::child", timelineEvent("beta", 50L));
        checkpoint.updateSignature("composite::child", "sig");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("child", child)
                .addChannel("composite", composite)
                .addMarker("checkpoint", checkpoint)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new MyOSTimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                timelineEvent("beta", 5L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(composite, context);

        assertTrue(evaluation.matches());
        assertEquals(1, evaluation.deliveries().size());
        assertFalse(Boolean.TRUE.equals(evaluation.deliveries().get(0).shouldProcess()));
    }

    @Test
    void evaluateDeliversMultipleMatchesInDeclaredOrder() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(java.util.Arrays.asList("childA", "childB"));

        TimelineChannel childA = new TimelineChannel();
        childA.setTimelineId("alpha");
        MyOSTimelineChannel childB = new MyOSTimelineChannel();
        childB.setTimelineId("alpha");

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("childA", childA)
                .addChannel("childB", childB)
                .addChannel("composite", composite)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new MyOSTimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                timelineEvent("alpha", 9L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(composite, context);

        assertTrue(evaluation.matches());
        assertEquals(2, evaluation.deliveries().size());
        assertEquals("childA", String.valueOf(evaluation.deliveries().get(0).eventNode()
                .getProperties().get("meta").getProperties().get("compositeSourceChannelKey").getValue()));
        assertEquals("childB", String.valueOf(evaluation.deliveries().get(1).eventNode()
                .getProperties().get("meta").getProperties().get("compositeSourceChannelKey").getValue()));
    }

    @Test
    void evaluateUsesChildRecencyChecksPerCheckpointKey() {
        CompositeTimelineChannel composite = new CompositeTimelineChannel();
        composite.setChannels(java.util.Arrays.asList("childA", "childB"));

        TimelineChannel childA = new TimelineChannel();
        childA.setTimelineId("alpha");
        MyOSTimelineChannel childB = new MyOSTimelineChannel();
        childB.setTimelineId("alpha");

        ChannelEventCheckpoint checkpoint = new ChannelEventCheckpoint();
        checkpoint.putEvent("composite::childA", timelineEvent("alpha", 20L));
        checkpoint.putEvent("composite::childB", timelineEvent("alpha", 5L));

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("childA", childA)
                .addChannel("childB", childB)
                .addChannel("composite", composite)
                .addMarker("checkpoint", checkpoint)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new MyOSTimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "composite",
                timelineEvent("alpha", 12L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(composite, context);

        assertTrue(evaluation.matches());
        assertEquals(2, evaluation.deliveries().size());
        assertEquals(Boolean.FALSE, evaluation.deliveries().get(0).shouldProcess());
        assertEquals(Boolean.TRUE, evaluation.deliveries().get(1).shouldProcess());
    }

    @Test
    void evaluateRespectsInnerCompositeRecencyWhenNested() {
        CompositeTimelineChannel outer = new CompositeTimelineChannel();
        outer.setChannels(Collections.singletonList("inner"));
        CompositeTimelineChannel inner = new CompositeTimelineChannel();
        inner.setChannels(java.util.Arrays.asList("childA", "childB"));

        TimelineChannel childA = new TimelineChannel();
        childA.setTimelineId("alpha");
        MyOSTimelineChannel childB = new MyOSTimelineChannel();
        childB.setTimelineId("alpha");

        ChannelEventCheckpoint checkpoint = new ChannelEventCheckpoint();
        checkpoint.putEvent("outer::inner", timelineEvent("alpha", 8L));
        checkpoint.putEvent("inner::childA", timelineEvent("alpha", 20L));
        checkpoint.putEvent("inner::childB", timelineEvent("alpha", 20L));

        ContractBundle bundle = ContractBundle.builder()
                .addChannel("childA", childA)
                .addChannel("childB", childB)
                .addChannel("inner", inner)
                .addChannel("outer", outer)
                .addMarker("checkpoint", checkpoint)
                .build();

        ContractProcessorRegistry registry = new ContractProcessorRegistry();
        registry.registerChannel(new TimelineChannelProcessor());
        registry.registerChannel(new MyOSTimelineChannelProcessor());
        registry.registerChannel(new CompositeTimelineChannelProcessor());

        ChannelEvaluationContext context = new ChannelEvaluationContext(
                "/",
                "outer",
                timelineEvent("alpha", 12L),
                null,
                bundle.markers(),
                bundle,
                registry);

        CompositeTimelineChannelProcessor processor = new CompositeTimelineChannelProcessor();
        ChannelProcessorEvaluation evaluation = processor.evaluate(outer, context);

        assertTrue(evaluation.matches());
        assertEquals(1, evaluation.deliveries().size());
        assertEquals(Boolean.FALSE, evaluation.deliveries().get(0).shouldProcess());
    }

    private static Node timelineEvent(String timelineId, long sequence) {
        Node timeline = new Node().properties("timelineId", new Node().value(timelineId));
        return new Node()
                .type(new Node().blueId("Conversation/Timeline Entry"))
                .properties("eventId", new Node().value(String.valueOf(sequence)))
                .properties("timeline", timeline)
                .properties("sequence", new Node().value(sequence));
    }
}
