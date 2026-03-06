package blue.language.types.conversation;

import blue.language.model.TypeBlueId;
import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Timeline Channel")
@TypeBlueId("EvuCWsG1E6WJQg8QXmk6rwMANYTZjoLWVZ1vYQWUwdTH")
public class TimelineChannel {
    public String timelineId;
    public Node event;

    public TimelineChannel timelineId(String timelineId) {
        this.timelineId = timelineId;
        return this;
    }

    public TimelineChannel event(Node event) {
        this.event = event;
        return this;
    }
}
