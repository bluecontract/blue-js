package blue.language.processor.contracts;

import blue.language.model.Node;
import blue.language.processor.ChannelEvaluationContext;
import blue.language.processor.ChannelProcessor;
import blue.language.processor.model.RecencyTestChannel;

public class RecencyTestChannelProcessor implements ChannelProcessor<RecencyTestChannel> {

    @Override
    public Class<RecencyTestChannel> contractType() {
        return RecencyTestChannel.class;
    }

    @Override
    public boolean matches(RecencyTestChannel contract, ChannelEvaluationContext context) {
        return "TestEvent".equals(resolveEventType(context.event()));
    }

    @Override
    public Node channelize(RecencyTestChannel contract, ChannelEvaluationContext context) {
        Node event = context.event();
        if (event == null) {
            return null;
        }
        Node clone = event.clone();
        clone.properties("channelized", new Node().value(true));
        return clone;
    }

    @Override
    public boolean isNewerEvent(RecencyTestChannel contract, ChannelEvaluationContext context, Node lastEvent) {
        Integer currentValue = toInteger(extractValue(context.event()));
        Integer lastValue = toInteger(extractValue(lastEvent));
        if (currentValue == null || lastValue == null) {
            return true;
        }
        int minDelta = contract != null && contract.getMinDelta() != null ? contract.getMinDelta() : 0;
        return currentValue >= lastValue + minDelta;
    }

    private String resolveEventType(Node event) {
        if (event == null) {
            return null;
        }
        Node typeNode = event.getType();
        if (typeNode == null) {
            return null;
        }
        if (typeNode.getBlueId() != null) {
            return typeNode.getBlueId();
        }
        if (typeNode.getProperties() == null) {
            return null;
        }
        Node blueIdNode = typeNode.getProperties().get("blueId");
        if (blueIdNode == null || blueIdNode.getValue() == null) {
            return null;
        }
        return String.valueOf(blueIdNode.getValue());
    }

    private Object extractValue(Node node) {
        if (node == null) {
            return null;
        }
        if (node.getProperties() != null) {
            Node valueNode = node.getProperties().get("value");
            if (valueNode != null && valueNode.getValue() != null) {
                return valueNode.getValue();
            }
        }
        return node.getValue();
    }

    private Integer toInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
