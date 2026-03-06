package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

/**
 * Base contract describing deterministic logic bound to a channel.
 */
@TypeAlias("Handler")
@TypeBlueId({
        "9ZE5pGjtSGJgWJG7iAVz4iPEz5CatceX3yb3qp5MpAKJ",
        "Handler",
        "Core/Handler"
})
public abstract class HandlerContract extends Contract {

    private String channel;
    private Node event;

    public String getChannelKey() {
        return channel;
    }

    public HandlerContract setChannelKey(String channelKey) {
        this.channel = channelKey;
        return this;
    }

    public HandlerContract channelKey(String channelKey) {
        return setChannelKey(channelKey);
    }

    public String getChannel() {
        return channel;
    }

    public HandlerContract setChannel(String channel) {
        this.channel = channel;
        return this;
    }

    public HandlerContract channel(String channel) {
        return setChannel(channel);
    }

    public Node getEvent() {
        return event;
    }

    public HandlerContract setEvent(Node event) {
        this.event = event;
        return this;
    }

    public HandlerContract event(Node event) {
        return setEvent(event);
    }
}
