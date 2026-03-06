package blue.language.blueid;

import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;
import blue.language.utils.Base58Sha256Provider;
import com.fasterxml.jackson.core.type.TypeReference;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;

import static blue.language.utils.Properties.OBJECT_BLUE;
import static blue.language.utils.Properties.OBJECT_BLUE_ID;
import static blue.language.utils.Properties.OBJECT_CONSTRAINTS;
import static blue.language.utils.Properties.OBJECT_DESCRIPTION;
import static blue.language.utils.Properties.OBJECT_ITEMS;
import static blue.language.utils.Properties.OBJECT_ITEM_TYPE;
import static blue.language.utils.Properties.OBJECT_KEY_TYPE;
import static blue.language.utils.Properties.OBJECT_NAME;
import static blue.language.utils.Properties.OBJECT_TYPE;
import static blue.language.utils.Properties.OBJECT_VALUE;
import static blue.language.utils.Properties.OBJECT_VALUE_TYPE;
import static blue.language.utils.UncheckedObjectMapper.YAML_MAPPER;

public final class BlueIdTreeHasher {

    private static final Function<Object, String> HASH_PROVIDER = new Base58Sha256Provider();
    private static final BigInteger JS_SAFE_INTEGER_MIN = BigInteger.valueOf(-9007199254740991L);
    private static final BigInteger JS_SAFE_INTEGER_MAX = BigInteger.valueOf(9007199254740991L);

    private BlueIdTreeHasher() {
    }

    public static BlueIdTreeHashResult hashAndIndex(Node canonicalRoot) {
        return hashAndIndex(canonicalRoot, HASH_PROVIDER);
    }

    public static BlueIdTreeHashResult hashAndIndex(Node canonicalRoot, Function<Object, String> hashProvider) {
        Objects.requireNonNull(canonicalRoot, "canonicalRoot");
        Objects.requireNonNull(hashProvider, "hashProvider");
        Map<String, String> index = new LinkedHashMap<String, String>();
        String rootBlueId = hashNode(canonicalRoot, "/", index, hashProvider);
        return new BlueIdTreeHashResult(rootBlueId, MapBlueIdIndex.from(index));
    }

    private static String hashNode(Node node,
                                   String pointer,
                                   Map<String, String> index,
                                   Function<Object, String> hashProvider) {
        String hash;
        if (BlueIdCalculator.isPureReferenceNode(node)) {
            hash = node.getBlueId();
        } else if (isSimpleValueNode(node)) {
            hash = hashCanonicalValue(canonicalizeSimpleValue(node.getValue()), hashProvider);
        } else if (isBareListNode(node)) {
            hash = hashList(node.getItems(), pointer, index, hashProvider);
        } else {
            hash = hashObjectNode(node, pointer, index, hashProvider);
        }

        index.put(pointer, hash);
        return hash;
    }

    private static String hashObjectNode(Node node,
                                         String pointer,
                                         Map<String, String> index,
                                         Function<Object, String> hashProvider) {
        TreeMap<String, Object> sorted = new TreeMap<String, Object>();

        if (node.getName() != null) {
            sorted.put(OBJECT_NAME, node.getName());
        }
        if (node.getDescription() != null) {
            sorted.put(OBJECT_DESCRIPTION, node.getDescription());
        }
        if (node.getValue() != null) {
            sorted.put(OBJECT_VALUE, canonicalizeSimpleValue(node.getValue()));
        }

        hashNodeField(sorted, OBJECT_TYPE, node.getType(), pointer, index, hashProvider);
        hashNodeField(sorted, OBJECT_ITEM_TYPE, node.getItemType(), pointer, index, hashProvider);
        hashNodeField(sorted, OBJECT_KEY_TYPE, node.getKeyType(), pointer, index, hashProvider);
        hashNodeField(sorted, OBJECT_VALUE_TYPE, node.getValueType(), pointer, index, hashProvider);
        hashNodeField(sorted, OBJECT_BLUE, node.getBlue(), pointer, index, hashProvider);

        if (node.getItems() != null) {
            sorted.put(OBJECT_ITEMS, blueIdWrapper(hashList(node.getItems(), pointer, index, hashProvider)));
        }

        if (node.getConstraints() != null) {
            Map<String, Object> constraintsMap = YAML_MAPPER.convertValue(
                    node.getConstraints(),
                    new TypeReference<Map<String, Object>>() {
                    }
            );
            sorted.put(OBJECT_CONSTRAINTS, blueIdWrapper(hashCanonicalValue(constraintsMap, hashProvider)));
        }

        if (node.getProperties() != null) {
            for (Map.Entry<String, Node> entry : node.getProperties().entrySet()) {
                String childPointer = PointerUtils.appendPointerSegment(pointer, entry.getKey());
                sorted.put(entry.getKey(), blueIdWrapper(hashNode(entry.getValue(), childPointer, index, hashProvider)));
            }
        }

        return hashProvider.apply(sorted);
    }

    private static void hashNodeField(TreeMap<String, Object> target,
                                      String key,
                                      Node child,
                                      String pointer,
                                      Map<String, String> index,
                                      Function<Object, String> hashProvider) {
        if (child == null) {
            return;
        }
        String childPointer = PointerUtils.appendPointerSegment(pointer, key);
        target.put(key, blueIdWrapper(hashNode(child, childPointer, index, hashProvider)));
    }

    private static String hashList(List<Node> items,
                                   String pointer,
                                   Map<String, String> index,
                                   Function<Object, String> hashProvider) {
        String fold = hashProvider.apply(Arrays.asList("$list", "$empty"));
        for (int i = 0; i < items.size(); i++) {
            String itemPointer = PointerUtils.appendPointerSegment(pointer, String.valueOf(i));
            String itemHash = hashNode(items.get(i), itemPointer, index, hashProvider);
            fold = hashProvider.apply(Arrays.<Object>asList(
                    blueIdWrapper(fold),
                    blueIdWrapper(itemHash)
            ));
        }
        return fold;
    }

    private static String hashCanonicalValue(Object value, Function<Object, String> hashProvider) {
        Object normalized = normalize(value);
        if (normalized == null) {
            return hashProvider.apply(Arrays.asList("$null"));
        }
        if (normalized instanceof String || normalized instanceof Number || normalized instanceof Boolean) {
            return hashProvider.apply(Arrays.asList("$scalar", normalized));
        }
        if (normalized instanceof Map) {
            Map<String, Object> sorted = new TreeMap<String, Object>();
            Map<String, Object> map = (Map<String, Object>) normalized;
            if (isPureReferenceMap(map)) {
                return String.valueOf(map.get(OBJECT_BLUE_ID));
            }

            for (Map.Entry<String, Object> entry : map.entrySet()) {
                String key = entry.getKey();
                Object child = normalize(entry.getValue());
                if (OBJECT_NAME.equals(key) || OBJECT_DESCRIPTION.equals(key) || OBJECT_VALUE.equals(key)) {
                    sorted.put(key, child);
                } else {
                    sorted.put(key, blueIdWrapper(hashCanonicalValue(child, hashProvider)));
                }
            }
            return hashProvider.apply(sorted);
        }
        if (normalized instanceof List) {
            String fold = hashProvider.apply(Arrays.asList("$list", "$empty"));
            List<Object> list = (List<Object>) normalized;
            for (Object item : list) {
                String itemHash = hashCanonicalValue(item, hashProvider);
                fold = hashProvider.apply(Arrays.<Object>asList(
                        blueIdWrapper(fold),
                        blueIdWrapper(itemHash)
                ));
            }
            return fold;
        }
        throw new IllegalArgumentException("Unsupported canonical value type: " + normalized.getClass());
    }

    private static Object normalize(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map) {
            Map<String, Object> result = new LinkedHashMap<String, Object>();
            Map<?, ?> map = (Map<?, ?>) value;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), normalize(entry.getValue()));
            }
            return result;
        }
        if (value instanceof List) {
            List<?> original = (List<?>) value;
            List<Object> normalized = new ArrayList<Object>(original.size());
            for (Object element : original) {
                normalized.add(normalize(element));
            }
            return normalized;
        }
        return value;
    }

    private static Map<String, String> blueIdWrapper(String blueId) {
        Map<String, String> wrapper = new LinkedHashMap<String, String>();
        wrapper.put(OBJECT_BLUE_ID, blueId);
        return wrapper;
    }

    private static boolean isPureReferenceMap(Map<String, Object> map) {
        if (map == null || map.size() != 1 || !map.containsKey(OBJECT_BLUE_ID)) {
            return false;
        }
        return map.get(OBJECT_BLUE_ID) instanceof String;
    }

    private static boolean isSimpleValueNode(Node node) {
        return node.getValue() != null &&
                node.getName() == null &&
                node.getDescription() == null &&
                node.getType() == null &&
                node.getItemType() == null &&
                node.getKeyType() == null &&
                node.getValueType() == null &&
                node.getItems() == null &&
                node.getProperties() == null &&
                node.getConstraints() == null &&
                node.getBlue() == null &&
                node.getBlueId() == null;
    }

    private static boolean isBareListNode(Node node) {
        return node.getItems() != null &&
                node.getName() == null &&
                node.getDescription() == null &&
                node.getType() == null &&
                node.getItemType() == null &&
                node.getKeyType() == null &&
                node.getValueType() == null &&
                node.getValue() == null &&
                node.getProperties() == null &&
                node.getConstraints() == null &&
                node.getBlue() == null &&
                node.getBlueId() == null;
    }

    private static Object canonicalizeSimpleValue(Object value) {
        if (value instanceof BigInteger) {
            BigInteger bigInteger = (BigInteger) value;
            if (bigInteger.compareTo(JS_SAFE_INTEGER_MIN) < 0 || bigInteger.compareTo(JS_SAFE_INTEGER_MAX) > 0) {
                return bigInteger.toString();
            }
        }
        return value;
    }

    public static final class BlueIdTreeHashResult {
        private final String rootBlueId;
        private final BlueIdIndex index;

        BlueIdTreeHashResult(String rootBlueId, BlueIdIndex index) {
            this.rootBlueId = rootBlueId;
            this.index = index;
        }

        public String rootBlueId() {
            return rootBlueId;
        }

        public BlueIdIndex index() {
            return index;
        }
    }
}
