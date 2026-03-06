package blue.language.blueid;

import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;
import blue.language.utils.Base58Sha256Provider;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;

import static blue.language.utils.Properties.OBJECT_BLUE_ID;
import static blue.language.utils.Properties.OBJECT_DESCRIPTION;
import static blue.language.utils.Properties.OBJECT_NAME;
import static blue.language.utils.Properties.OBJECT_VALUE;

public final class BlueIdCalculator {

    private static final Function<Object, String> HASH_PROVIDER = new Base58Sha256Provider();

    private BlueIdCalculator() {
    }

    public static String calculateSemanticBlueId(Node canonicalNode) {
        Objects.requireNonNull(canonicalNode, "canonicalNode");
        Object canonical = Canonicalizer.toCanonicalObject(canonicalNode);
        return calculateCanonical(canonical);
    }

    public static String calculateBlueId(Node node) {
        return calculateSemanticBlueId(node);
    }

    public static String calculateSemanticBlueId(List<Node> canonicalDocs) {
        Objects.requireNonNull(canonicalDocs, "canonicalDocs");
        Object canonical = Canonicalizer.toCanonicalObject(canonicalDocs);
        return calculateCanonical(canonical);
    }

    public static String calculateBlueId(List<Node> nodes) {
        return calculateSemanticBlueId(nodes);
    }

    public static boolean isPureReferenceNode(Node node) {
        if (node == null || node.getBlueId() == null) {
            return false;
        }

        if (node.getName() != null || node.getDescription() != null || node.getType() != null ||
                node.getItemType() != null || node.getKeyType() != null || node.getValueType() != null ||
                node.getValue() != null || node.getConstraints() != null || node.getBlue() != null) {
            return false;
        }

        if (node.getItems() != null && !node.getItems().isEmpty()) {
            return false;
        }

        Map<String, Node> properties = node.getProperties();
        return properties == null || properties.isEmpty();
    }

    public static String rehashPath(Node canonicalRoot, String jsonPointer) {
        Objects.requireNonNull(canonicalRoot, "canonicalRoot");
        String normalizedPointer = jsonPointer == null || jsonPointer.isEmpty()
                ? "/"
                : PointerUtils.normalizeRequiredPointer(jsonPointer, "jsonPointer");
        String[] segments = PointerUtils.splitPointerSegments(normalizedPointer);
        Node target = nodeAt(canonicalRoot, segments);
        if (target == null) {
            throw new IllegalArgumentException("Path not found in canonical node: "
                    + normalizedPointer);
        }
        return calculateSemanticBlueId(target);
    }

    private static String calculateCanonical(Object value) {
        Object normalized = normalize(value);
        if (normalized == null) {
            return hashNull();
        }
        if (normalized instanceof String || normalized instanceof Number || normalized instanceof Boolean) {
            return HASH_PROVIDER.apply(Arrays.asList("$scalar", normalized));
        }
        if (normalized instanceof Map) {
            return calculateMap((Map<String, Object>) normalized);
        }
        if (normalized instanceof List) {
            return calculateList((List<Object>) normalized);
        }

        throw new IllegalArgumentException("Unsupported canonical value type: " + normalized.getClass());
    }

    private static String calculateMap(Map<String, Object> map) {
        if (isPureReferenceMap(map)) {
            return String.valueOf(map.get(OBJECT_BLUE_ID));
        }

        Map<String, Object> sorted = new TreeMap<String, Object>();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            String key = entry.getKey();
            Object child = normalize(entry.getValue());
            if (OBJECT_NAME.equals(key) || OBJECT_DESCRIPTION.equals(key) || OBJECT_VALUE.equals(key)) {
                sorted.put(key, child);
            } else {
                sorted.put(key, blueIdWrapper(calculateCanonical(child)));
            }
        }

        return HASH_PROVIDER.apply(sorted);
    }

    private static String calculateList(List<Object> list) {
        String fold = HASH_PROVIDER.apply(Arrays.asList("$list", "$empty"));
        for (Object item : list) {
            String itemHash = calculateCanonical(item);
            fold = HASH_PROVIDER.apply(Arrays.<Object>asList(
                    blueIdWrapper(fold),
                    blueIdWrapper(itemHash)
            ));
        }
        return fold;
    }

    private static Object normalize(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map) {
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            Map<?, ?> original = (Map<?, ?>) value;
            for (Map.Entry<?, ?> entry : original.entrySet()) {
                result.put(String.valueOf(entry.getKey()), normalize(entry.getValue()));
            }
            return result;
        }
        if (value instanceof List) {
            List<?> original = (List<?>) value;
            Object[] normalized = new Object[original.size()];
            for (int i = 0; i < original.size(); i++) {
                normalized[i] = normalize(original.get(i));
            }
            return Arrays.asList(normalized);
        }
        return value;
    }

    private static boolean isPureReferenceMap(Map<String, Object> map) {
        if (map == null || map.size() != 1 || !map.containsKey(OBJECT_BLUE_ID)) {
            return false;
        }
        Object blueId = map.get(OBJECT_BLUE_ID);
        return blueId instanceof String;
    }

    private static Map<String, String> blueIdWrapper(String blueId) {
        Map<String, String> wrapper = new LinkedHashMap<String, String>();
        wrapper.put(OBJECT_BLUE_ID, blueId);
        return wrapper;
    }

    private static String hashNull() {
        return HASH_PROVIDER.apply(Arrays.asList("$null"));
    }

    private static Node nodeAt(Node root, String[] segments) {
        Node current = root;
        for (String segment : segments) {
            current = descend(current, segment);
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private static Node descend(Node current, String segment) {
        if (current == null) {
            return null;
        }

        Map<String, Node> properties = current.getProperties();
        if (properties != null && properties.containsKey(segment)) {
            return properties.get(segment);
        }

        if (PointerUtils.isArrayIndexSegment(segment)) {
            List<Node> items = current.getItems();
            if (items != null) {
                int index = PointerUtils.parseArrayIndex(segment);
                if (index >= 0 && index < items.size()) {
                    return items.get(index);
                }
            }
        }

        if ("type".equals(segment)) {
            return current.getType();
        }
        if ("itemType".equals(segment)) {
            return current.getItemType();
        }
        if ("keyType".equals(segment)) {
            return current.getKeyType();
        }
        if ("valueType".equals(segment)) {
            return current.getValueType();
        }
        if ("blue".equals(segment)) {
            return current.getBlue();
        }

        return null;
    }
}
