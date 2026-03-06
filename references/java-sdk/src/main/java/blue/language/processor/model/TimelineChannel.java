package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;

@TypeBlueId({"Conversation/Timeline Channel", "TimelineChannel"})
public class TimelineChannel extends ChannelContract {

    private String timelineId;
    private Node event;

    public String getTimelineId() {
        return timelineId;
    }

    public TimelineChannel setTimelineId(String timelineId) {
        this.timelineId = timelineId;
        return this;
    }

    public TimelineChannel timelineId(String timelineId) {
        return setTimelineId(timelineId);
    }

    public Node getEvent() {
        return event;
    }

    public TimelineChannel setEvent(Node event) {
        this.event = event;
        return this;
    }

    public TimelineChannel event(Node event) {
        return setEvent(event);
    }
}
