package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.ChannelProcessor;
import blue.language.processor.model.TimelineChannel;
import blue.language.NodeProvider;

public class TimelineChannelProcessor implements ChannelProcessor<TimelineChannel> {

    @Override
    public Class<TimelineChannel> contractType() {
        return TimelineChannel.class;
    }

    @Override
    public boolean matches(TimelineChannel contract, ChannelEvaluationContext context) {
        if (!TimelineEventSupport.isConversationTimelineEntry(context.event())) {
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
    public Node channelize(TimelineChannel contract, ChannelEvaluationContext context) {
        Node event = context.event();
        if (!TimelineEventSupport.isConversationTimelineEntry(event)) {
            return null;
        }
        return event.clone();
    }

    @Override
    public String eventId(TimelineChannel contract, ChannelEvaluationContext context) {
        return TimelineEventSupport.eventId(context.event());
    }

    @Override
    public boolean isNewerEvent(TimelineChannel contract, ChannelEvaluationContext context, Node lastEvent) {
        return TimelineEventSupport.isNewer(context.event(), lastEvent);
    }
}
