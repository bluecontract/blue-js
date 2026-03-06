package blue.language.utils;

import blue.language.model.Node;
import blue.language.blueid.BlueIdCalculator;
import blue.language.processor.util.PointerUtils;

import java.util.List;
import java.util.Map;
import java.util.function.Function;

public class NodePathAccessor {

    public static Object get(Node node, String path) {
        return get(node, path, null);
    }
    
    public static Object get(Node node, String path, Function<Node, Node> linkingProvider) {
        return get(node, path, linkingProvider, true);
    }

    public static Object get(Node node, String path, Function<Node, Node> linkingProvider, boolean resolveFinalLink) {
        String[] segments = PointerUtils.splitPointerSegments(path);
        if (segments.length == 0) {
            if (!resolveFinalLink) {
                return node;
            }
            Node resolved = linkingProvider != null ? link(node, linkingProvider) : node;
            return resolved.getValue() != null ? resolved.getValue() : resolved;
        }
        return getRecursive(node, segments, 0, linkingProvider, resolveFinalLink);
    }

    private static Object getRecursive(Node node, String[] segments, int index, Function<Node, Node> linkingProvider, boolean resolveFinalLink) {
        if (index == segments.length - 1 && !resolveFinalLink) {
            // Return the node itself for the last segment if we're not resolving the final link
            return getNodeForSegment(node, segments[index], linkingProvider, false);
        }

        if (index == segments.length) {
            return node != null && node.getValue() != null ? node.getValue() : node;
        }

        String segment = segments[index];
        Node nextNode = getNodeForSegment(node, segment, linkingProvider, true);
        return getRecursive(nextNode, segments, index + 1, linkingProvider, resolveFinalLink);
    }

    private static Node getNodeForSegment(Node node, String segment, Function<Node, Node> linkingProvider, boolean resolveLink) {
        if (node == null) {
            throw new IllegalArgumentException("Property not found: " + segment);
        }
        Node result;

        Map<String, Node> properties = node.getProperties();
        if (properties != null && properties.containsKey(segment)) {
            result = properties.get(segment);
        } else if (PointerUtils.isArrayIndexSegment(segment)) {
            int itemIndex = PointerUtils.parseArrayIndex(segment);
            List<Node> items = node.getItems();
            if (items == null || itemIndex < 0 || itemIndex >= items.size()) {
                throw new IllegalArgumentException("Invalid item index: " + segment);
            }
            result = items.get(itemIndex);
        } else {
            if (node.getItems() != null && properties == null && !isBuiltInSegment(segment)) {
                throw new IllegalArgumentException("Invalid item index: " + segment);
            }
            switch (segment) {
                case "name":
                    result = new Node().value(node.getName());
                    break;
                case "description":
                    result = new Node().value(node.getDescription());
                    break;
                case "type":
                    result = node.getType();
                    break;
                case "itemType":
                    result = node.getItemType();
                    break;
                case "keyType":
                    result = node.getKeyType();
                    break;
                case "valueType":
                    result = node.getValueType();
                    break;
                case "value":
                    result = new Node().value(node.getValue());
                    break;
                case "blueId":
                    String blueId = node.getBlueId() != null
                            ? node.getBlueId()
                            : BlueIdCalculator.calculateSemanticBlueId(node);
                    result = new Node().value(blueId);
                    break;
                case "blue":
                    result = node.getBlue();
                    break;
                default:
                    throw new IllegalArgumentException("Property not found: " + segment);
            }
        }

        return resolveLink && linkingProvider != null ? link(result, linkingProvider) : result;
    }

    private static boolean isBuiltInSegment(String segment) {
        return "name".equals(segment)
                || "description".equals(segment)
                || "type".equals(segment)
                || "itemType".equals(segment)
                || "keyType".equals(segment)
                || "valueType".equals(segment)
                || "value".equals(segment)
                || "blueId".equals(segment)
                || "blue".equals(segment);
    }

    private static Node link(Node node, Function<Node, Node> linkingProvider) {
        Node linked = linkingProvider.apply(node);
        return linked == null ? node : linked;
    }
}