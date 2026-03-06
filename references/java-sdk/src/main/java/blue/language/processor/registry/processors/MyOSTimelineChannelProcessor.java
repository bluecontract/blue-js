package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.ChannelProcessor;
import blue.language.processor.model.MyOSTimelineChannel;
import blue.language.NodeProvider;

public class MyOSTimelineChannelProcessor implements ChannelProcessor<MyOSTimelineChannel> {

    @Override
    public Class<MyOSTimelineChannel> contractType() {
        return MyOSTimelineChannel.class;
    }

    @Override
    public boolean matches(MyOSTimelineChannel contract, ChannelEvaluationContext context) {
        if (!TimelineEventSupport.isConversationOrMyOSTimelineEntry(context.event())) {
            return false;
        }
        String expectedTimelineId = contract.getTimelineId();
        if (expectedTimelineId == null || expectedTimelineId.trim().isEmpty()) {
            return false;
        }
        String eventTimelineId = TimelineEventSupport.timelineId(context.event());
        if (!expectedTimelineId.trim().equals(eventTimelineId)) {
            return false;
        }
        NodeProvider nodeProvider = context.registry() != null ? context.registry().nodeProvider() : null;
        return WorkflowContractSupport.matchesEventFilter(context.event(), contract.getEvent(), nodeProvider);
    }

    @Override
    public Node channelize(MyOSTimelineChannel contract, ChannelEvaluationContext context) {
        Node event = context.event();
        if (!TimelineEventSupport.isConversationOrMyOSTimelineEntry(event)) {
            return null;
        }
        return event.clone();
    }

    @Override
    public String eventId(MyOSTimelineChannel contract, ChannelEvaluationContext context) {
        return TimelineEventSupport.eventId(context.event());
    }

    @Override
    public boolean isNewerEvent(MyOSTimelineChannel contract, ChannelEvaluationContext context, Node lastEvent) {
        return TimelineEventSupport.isNewer(context.event(), lastEvent);
    }
}
