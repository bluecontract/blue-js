package blue.language.processor.registry.processors;

import blue.language.model.Node;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.List;

final class TimelineEventSupport {

    private static final String CONVERSATION_TIMELINE_ENTRY_BLUE_ID = "Conversation/Timeline Entry";
    private static final String TIMELINE_ENTRY_BLUE_ID = "TimelineEntry";
    private static final String MYOS_TIMELINE_ENTRY_BLUE_ID = "MyOS/MyOS Timeline Entry";
    private static final String MYOS_TIMELINE_ENTRY_ALIAS = "MyOSTimelineEntry";

    private static final List<String[]> TIMELINE_ID_PATHS = Arrays.<String[]>asList(
            new String[]{"timeline", "timelineId"},
            new String[]{"timelineId"}
    );

    private static final List<String[]> RECENCY_PATHS = Arrays.<String[]>asList(
            new String[]{"sequence"},
            new String[]{"seq"},
            new String[]{"revision"},
            new String[]{"version"},
            new String[]{"index"},
            new String[]{"timeline", "sequence"},
            new String[]{"timeline", "revision"},
            new String[]{"timeline", "index"}
    );

    private TimelineEventSupport() {
    }

    static String timelineId(Node event) {
        for (String[] path : TIMELINE_ID_PATHS) {
            Object value = valueAtPath(event, path);
            if (value instanceof String) {
                String trimmed = ((String) value).trim();
                if (!trimmed.isEmpty()) {
                    return trimmed;
                }
            }
        }
        return null;
    }

    static String eventId(Node event) {
        Object eventId = valueAtPath(event, "eventId");
        if (eventId == null) {
            eventId = valueAtPath(event, "id");
        }
        return eventId != null ? String.valueOf(eventId) : null;
    }

    static boolean isConversationTimelineEntry(Node event) {
        String typeBlueId = eventTypeBlueId(event);
        return CONVERSATION_TIMELINE_ENTRY_BLUE_ID.equals(typeBlueId)
                || TIMELINE_ENTRY_BLUE_ID.equals(typeBlueId);
    }

    static boolean isMyOSTimelineEntry(Node event) {
        String typeBlueId = eventTypeBlueId(event);
        return MYOS_TIMELINE_ENTRY_BLUE_ID.equals(typeBlueId)
                || MYOS_TIMELINE_ENTRY_ALIAS.equals(typeBlueId);
    }

    static boolean isConversationOrMyOSTimelineEntry(Node event) {
        return isConversationTimelineEntry(event) || isMyOSTimelineEntry(event);
    }

    static boolean isNewer(Node current, Node previous) {
        if (current == null || previous == null) {
            return true;
        }
        BigDecimal currentIndex = recencyValue(current);
        BigDecimal previousIndex = recencyValue(previous);
        if (currentIndex == null || previousIndex == null) {
            return true;
        }
        return currentIndex.compareTo(previousIndex) > 0;
    }

    private static BigDecimal recencyValue(Node node) {
        for (String[] path : RECENCY_PATHS) {
            Object value = valueAtPath(node, path);
            if (value instanceof BigDecimal) {
                return (BigDecimal) value;
            }
            if (value instanceof BigInteger) {
                return new BigDecimal((BigInteger) value);
            }
            if (value instanceof Number) {
                return BigDecimal.valueOf(((Number) value).doubleValue());
            }
            if (value instanceof String) {
                try {
                    return new BigDecimal(((String) value).trim());
                } catch (NumberFormatException ignored) {
                    // Continue probing known recency fields.
                }
            }
        }
        return null;
    }

    private static Object valueAtPath(Node root, String... path) {
        Node current = root;
        for (String segment : path) {
            if (current == null || current.getProperties() == null) {
                return null;
            }
            current = current.getProperties().get(segment);
        }
        return current != null ? current.getValue() : null;
    }

    private static String eventTypeBlueId(Node event) {
        if (event == null) {
            return null;
        }
        if (event.getType() != null && event.getType().getBlueId() != null) {
            String blueId = event.getType().getBlueId().trim();
            return blueId.isEmpty() ? null : blueId;
        }
        if (event.getProperties() == null) {
            return null;
        }
        Node typeNode = event.getProperties().get("type");
        if (typeNode == null) {
            return null;
        }
        if (typeNode.getBlueId() != null && !typeNode.getBlueId().trim().isEmpty()) {
            return typeNode.getBlueId().trim();
        }
        if (typeNode.getProperties() != null && typeNode.getProperties().get("blueId") != null) {
            Node blueIdNode = typeNode.getProperties().get("blueId");
            if (blueIdNode != null && blueIdNode.getValue() != null) {
                String blueId = String.valueOf(blueIdNode.getValue()).trim();
                return blueId.isEmpty() ? null : blueId;
            }
        }
        if (typeNode.getValue() instanceof String) {
            String blueId = ((String) typeNode.getValue()).trim();
            return blueId.isEmpty() ? null : blueId;
        }
        return null;
    }
}
