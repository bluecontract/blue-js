package blue.language.blueid;

import blue.language.model.Constraints;
import blue.language.model.Node;
import com.fasterxml.jackson.core.type.TypeReference;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Iterator;
import java.util.stream.Collectors;

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


public final class Canonicalizer {

    private static final BigInteger JS_SAFE_INTEGER_MIN = BigInteger.valueOf(-9007199254740991L);
    private static final BigInteger JS_SAFE_INTEGER_MAX = BigInteger.valueOf(9007199254740991L);

    private Canonicalizer() {
    }

    public static Object toCanonicalObject(Node canonicalNode) {
        Objects.requireNonNull(canonicalNode, "canonicalNode");
        return canonicalizeNode(canonicalNode);
    }

    public static Object toCanonicalObject(List<Node> canonicalDocs) {
        Objects.requireNonNull(canonicalDocs, "canonicalDocs");
        return canonicalDocs.stream()
                .map(Canonicalizer::toCanonicalObject)
                .collect(Collectors.toList());
    }

    private static Object canonicalizeNode(Node node) {
        Map<String, Object> canonicalConstraints = canonicalConstraints(node);

        if (BlueIdCalculator.isPureReferenceNode(node)) {
            Map<String, Object> reference = new LinkedHashMap<String, Object>();
            reference.put(OBJECT_BLUE_ID, node.getBlueId());
            return reference;
        }

        if (node.getValue() != null && isSimpleValueNode(node, canonicalConstraints)) {
            return canonicalizeSimpleValue(node.getValue());
        }

        if (node.getItems() != null && node.getName() == null && node.getDescription() == null &&
                node.getType() == null && node.getItemType() == null && node.getKeyType() == null &&
                node.getValueType() == null && node.getValue() == null && node.getProperties() == null &&
                canonicalConstraints == null && node.getBlue() == null) {
            List<Object> items = new ArrayList<Object>();
            for (Node item : node.getItems()) {
                items.add(canonicalizeNode(item));
            }
            return items;
        }

        Map<String, Object> result = new LinkedHashMap<String, Object>();

        if (node.getName() != null) {
            result.put(OBJECT_NAME, node.getName());
        }
        if (node.getDescription() != null) {
            result.put(OBJECT_DESCRIPTION, node.getDescription());
        }
        if (node.getType() != null) {
            result.put(OBJECT_TYPE, canonicalizeNode(node.getType()));
        }
        if (node.getItemType() != null) {
            result.put(OBJECT_ITEM_TYPE, canonicalizeNode(node.getItemType()));
        }
        if (node.getKeyType() != null) {
            result.put(OBJECT_KEY_TYPE, canonicalizeNode(node.getKeyType()));
        }
        if (node.getValueType() != null) {
            result.put(OBJECT_VALUE_TYPE, canonicalizeNode(node.getValueType()));
        }
        if (node.getValue() != null) {
            result.put(OBJECT_VALUE, canonicalizeSimpleValue(node.getValue()));
        }
        if (node.getItems() != null) {
            List<Object> items = new ArrayList<Object>();
            for (Node item : node.getItems()) {
                items.add(canonicalizeNode(item));
            }
            result.put(OBJECT_ITEMS, items);
        }
        if (canonicalConstraints != null) {
            result.put(OBJECT_CONSTRAINTS, canonicalConstraints);
        }
        if (node.getBlue() != null) {
            result.put(OBJECT_BLUE, canonicalizeNode(node.getBlue()));
        }
        if (node.getProperties() != null) {
            for (Map.Entry<String, Node> entry : node.getProperties().entrySet()) {
                result.put(entry.getKey(), canonicalizeNode(entry.getValue()));
            }
        }

        return result;
    }

    private static boolean isSimpleValueNode(Node node, Map<String, Object> canonicalConstraints) {
        return node.getName() == null &&
                node.getDescription() == null &&
                node.getType() == null &&
                node.getItemType() == null &&
                node.getKeyType() == null &&
                node.getValueType() == null &&
                node.getItems() == null &&
                node.getProperties() == null &&
                canonicalConstraints == null &&
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

    private static Map<String, Object> constraintsToMap(Constraints constraints) {
        Map<String, Object> map = YAML_MAPPER.convertValue(constraints, new TypeReference<Map<String, Object>>() {
        });
        pruneEmptyEntries(map);
        return map;
    }

    private static Map<String, Object> canonicalConstraints(Node node) {
        if (node.getConstraints() == null) {
            return null;
        }
        Map<String, Object> constraintsMap = constraintsToMap(node.getConstraints());
        return constraintsMap.isEmpty() ? null : constraintsMap;
    }

    private static void pruneEmptyEntries(Map<String, Object> map) {
        Iterator<Map.Entry<String, Object>> iterator = map.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Object> entry = iterator.next();
            Object value = entry.getValue();
            if (value == null) {
                iterator.remove();
                continue;
            }
            if (value instanceof Map) {
                Map<String, Object> nested = (Map<String, Object>) value;
                pruneEmptyEntries(nested);
                if (nested.isEmpty()) {
                    iterator.remove();
                }
                continue;
            }
            if (value instanceof List) {
                List<Object> list = (List<Object>) value;
                if (list.isEmpty()) {
                    iterator.remove();
                }
            }
        }
    }
}
