package blue.language.sdk;

import blue.language.model.Node;
import blue.language.sdk.internal.NodeObjectBuilder;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

public final class AgencyOptionsBuilder {

    private String initiatorChannel;
    private String defaultMessage;
    private final Map<String, String> perChannelMessages = new LinkedHashMap<String, String>();
    private Node capabilities;

    public AgencyOptionsBuilder initiator(String channelKey) {
        this.initiatorChannel = normalize(channelKey);
        return this;
    }

    public AgencyOptionsBuilder defaultMessage(String message) {
        this.defaultMessage = normalize(message);
        return this;
    }

    public AgencyOptionsBuilder channelMessage(String channelKey, String message) {
        String normalizedKey = normalize(channelKey);
        String normalizedMessage = normalize(message);
        if (normalizedKey != null && normalizedMessage != null) {
            this.perChannelMessages.put(normalizedKey, normalizedMessage);
        }
        return this;
    }

    public AgencyOptionsBuilder capabilities(Consumer<CapabilitiesBuilder> customizer) {
        if (customizer == null) {
            return this;
        }
        CapabilitiesBuilder builder = new CapabilitiesBuilder();
        customizer.accept(builder);
        this.capabilities = builder.buildNode();
        return this;
    }

    void applyTo(NodeObjectBuilder payload) {
        if (initiatorChannel != null) {
            payload.put("initiatorChannel", initiatorChannel);
        }
        if (defaultMessage != null || !perChannelMessages.isEmpty()) {
            Node initialMessages = new Node().properties(new LinkedHashMap<String, Node>());
            if (defaultMessage != null) {
                initialMessages.properties("defaultMessage", new Node().value(defaultMessage));
            }
            if (!perChannelMessages.isEmpty()) {
                Node perChannel = new Node().properties(new LinkedHashMap<String, Node>());
                for (Map.Entry<String, String> entry : perChannelMessages.entrySet()) {
                    perChannel.properties(entry.getKey(), new Node().value(entry.getValue()));
                }
                initialMessages.properties("perChannel", perChannel);
            }
            payload.putNode("initialMessages", initialMessages);
        }
        if (capabilities != null) {
            payload.putNode("capabilities", capabilities);
        }
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
