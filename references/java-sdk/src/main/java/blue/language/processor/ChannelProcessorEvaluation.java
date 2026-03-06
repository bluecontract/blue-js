package blue.language.processor;

import blue.language.model.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Channel evaluation outcome with optional channelized event details.
 */
public final class ChannelProcessorEvaluation {
    private final boolean matches;
    private final String eventId;
    private final Node eventNode;
    private final List<ChannelDelivery> deliveries;

    private ChannelProcessorEvaluation(boolean matches,
                                       String eventId,
                                       Node eventNode,
                                       List<ChannelDelivery> deliveries) {
        this.matches = matches;
        this.eventId = eventId;
        this.eventNode = eventNode;
        this.deliveries = deliveries == null
                ? Collections.<ChannelDelivery>emptyList()
                : Collections.unmodifiableList(new ArrayList<>(deliveries));
    }

    public boolean matches() {
        return matches;
    }

    public String eventId() {
        return eventId;
    }

    public Node eventNode() {
        return eventNode;
    }

    public List<ChannelDelivery> deliveries() {
        return deliveries;
    }

    public static ChannelProcessorEvaluation noMatch() {
        return new ChannelProcessorEvaluation(false, null, null, Collections.<ChannelDelivery>emptyList());
    }

    public static ChannelProcessorEvaluation matched(String eventId, Node eventNode) {
        return new ChannelProcessorEvaluation(true, eventId, eventNode, Collections.<ChannelDelivery>emptyList());
    }

    public static ChannelProcessorEvaluation matchedDeliveries(List<ChannelDelivery> deliveries) {
        return new ChannelProcessorEvaluation(true, null, null, deliveries);
    }

    public static final class ChannelDelivery {
        private final Node eventNode;
        private final String eventId;
        private final String checkpointKey;
        private final Boolean shouldProcess;

        public ChannelDelivery(Node eventNode, String eventId, String checkpointKey, Boolean shouldProcess) {
            this.eventNode = eventNode;
            this.eventId = eventId;
            this.checkpointKey = checkpointKey;
            this.shouldProcess = shouldProcess;
        }

        public Node eventNode() {
            return eventNode;
        }

        public String eventId() {
            return eventId;
        }

        public String checkpointKey() {
            return checkpointKey;
        }

        public Boolean shouldProcess() {
            return shouldProcess;
        }
    }
}
