package blue.language.types.conversation;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

import java.util.List;

@TypeAlias("Conversation/Composite Timeline Channel")
@TypeBlueId("HsNatiPt2YvmkWQoqtfrFCbdp75ZUBLBUkWeq84WTfnr")
public class CompositeTimelineChannel extends TimelineChannel {
    public List<String> channels;

    public CompositeTimelineChannel channels(List<String> channels) {
        this.channels = channels;
        return this;
    }
}
