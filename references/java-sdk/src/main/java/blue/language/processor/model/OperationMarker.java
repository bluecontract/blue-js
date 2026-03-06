package blue.language.processor.model;

import blue.language.model.TypeBlueId;

@TypeBlueId({
        "Conversation/Operation",
        "Operation",
        "Conversation/Change Operation",
        "ChangeOperation"
})
public class OperationMarker extends MarkerContract {

    private String channel;

    public String getChannel() {
        return channel;
    }

    public OperationMarker setChannel(String channel) {
        this.channel = channel;
        return this;
    }

    public OperationMarker channel(String channel) {
        return setChannel(channel);
    }
}
