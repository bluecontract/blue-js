package blue.language.sdk.internal;

import blue.language.model.Node;

import java.util.LinkedHashMap;
import java.util.Map;

public final class BootstrapOptionsBuilder {

    private String assignee;
    private String defaultMessage;
    private final Map<String, String> perChannelMessages = new LinkedHashMap<String, String>();

    public BootstrapOptionsBuilder assignee(String channelKey) {
        if (channelKey == null) {
            this.assignee = null;
            return this;
        }
        String normalized = channelKey.trim();
        this.assignee = normalized.isEmpty() ? null : normalized;
        return this;
    }

    public BootstrapOptionsBuilder defaultMessage(String message) {
        this.defaultMessage = message;
        return this;
    }

    public BootstrapOptionsBuilder channelMessage(String channelKey, String message) {
        if (channelKey == null) {
            return this;
        }
        String normalizedKey = channelKey.trim();
        if (normalizedKey.isEmpty()) {
            return this;
        }
        perChannelMessages.put(normalizedKey, message);
        return this;
    }

    public void applyTo(NodeObjectBuilder payload) {
        if (payload == null) {
            throw new IllegalArgumentException("payload cannot be null");
        }
        if (assignee != null) {
            payload.put("bootstrapAssignee", assignee);
        }

        if (defaultMessage != null || !perChannelMessages.isEmpty()) {
            NodeObjectBuilder messages = NodeObjectBuilder.create();
            if (defaultMessage != null) {
                messages.put("defaultMessage", defaultMessage);
            }
            if (!perChannelMessages.isEmpty()) {
                messages.putStringMap("perChannel", perChannelMessages);
            }
            Node initialMessages = messages.build();
            payload.putNode("initialMessages", initialMessages);
        }
    }
}
