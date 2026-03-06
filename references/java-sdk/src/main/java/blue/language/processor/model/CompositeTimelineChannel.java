package blue.language.processor.model;

import blue.language.model.TypeBlueId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@TypeBlueId({"Conversation/Composite Timeline Channel", "CompositeTimelineChannel"})
public class CompositeTimelineChannel extends ChannelContract {

    private final List<String> channels = new ArrayList<>();

    public List<String> getChannels() {
        return Collections.unmodifiableList(channels);
    }

    public CompositeTimelineChannel setChannels(List<String> channels) {
        this.channels.clear();
        if (channels == null) {
            return this;
        }
        for (String channel : channels) {
            if (channel == null) {
                continue;
            }
            String normalized = channel.trim();
            if (!normalized.isEmpty()) {
                this.channels.add(normalized);
            }
        }
        return this;
    }

    public CompositeTimelineChannel channels(List<String> channels) {
        return setChannels(channels);
    }
}
