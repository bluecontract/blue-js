package blue.language.sdk.patch;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;
import blue.language.sdk.structure.DocStructure;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.LinkedHashMap;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;

public class PatchSet {

    private static final Blue BLUE = new Blue();

    public List<PatchEntry> entries = new ArrayList<PatchEntry>();

    public static PatchSet diff(Node before, Node after, DiffScope scope) {
        PatchSet patchSet = new PatchSet();
        if (scope == null) {
            return patchSet;
        }
        return switch (scope) {
            case ROOT_FIELDS_ONLY -> diffRootFields(before, after, true);
            case CONTRACTS_ONLY -> diffContracts(before, after);
            case FULL -> diffFull(before, after);
        };
    }

    public Node apply(Node base) {
        if (base == null) {
            throw new IllegalArgumentException("base document is required");
        }
        Node target = base;
        for (PatchEntry entry : entries) {
            if (entry == null) {
                continue;
            }
            applyEntry(target, entry);
        }
        return target;
    }

    private static PatchSet diffRootFields(Node before, Node after, boolean skipReservedKeys) {
        PatchSet patchSet = new PatchSet();
        Map<String, Node> beforeProps = before == null ? null : before.getProperties();
        Map<String, Node> afterProps = after == null ? null : after.getProperties();

        Set<String> keys = collectKeys(beforeProps, afterProps);
        for (String key : keys) {
            if (skipReservedKeys && DocStructure.isReservedRootKey(key)) {
                continue;
            }
            Node beforeValue = beforeProps == null ? null : beforeProps.get(key);
            Node afterValue = afterProps == null ? null : afterProps.get(key);
            String path = "/" + PointerUtils.escapePointerSegment(key);
            addDiffEntry(patchSet.entries, path, beforeValue, afterValue);
        }
        return patchSet;
    }

    private static PatchSet diffContracts(Node before, Node after) {
        PatchSet patchSet = new PatchSet();
        Map<String, Node> beforeContracts = contractsMap(before);
        Map<String, Node> afterContracts = contractsMap(after);
        Set<String> keys = collectKeys(beforeContracts, afterContracts);

        for (String key : keys) {
            Node beforeValue = beforeContracts.get(key);
            Node afterValue = afterContracts.get(key);
            addDiffEntry(patchSet.entries, key, beforeValue, afterValue);
        }
        return patchSet;
    }

    private static PatchSet diffFull(Node before, Node after) {
        PatchSet patchSet = new PatchSet();
        Map<String, Node> beforeTop = topLevelMap(before);
        Map<String, Node> afterTop = topLevelMap(after);
        Set<String> keys = collectKeys(beforeTop, afterTop);

        for (String key : keys) {
            Node beforeValue = beforeTop.get(key);
            Node afterValue = afterTop.get(key);
            String path = "/" + PointerUtils.escapePointerSegment(key);
            addDiffEntry(patchSet.entries, path, beforeValue, afterValue);
        }
        return patchSet;
    }

    private static Map<String, Node> topLevelMap(Node document) {
        LinkedHashMap<String, Node> map = new LinkedHashMap<String, Node>();
        if (document == null) {
            return map;
        }
        if (document.getName() != null) {
            map.put("name", new Node().value(document.getName()));
        }
        if (document.getDescription() != null) {
            map.put("description", new Node().value(document.getDescription()));
        }
        if (document.getType() != null) {
            map.put("type", document.getType().clone());
        }
        if (document.getItemType() != null) {
            map.put("itemType", document.getItemType().clone());
        }
        if (document.getKeyType() != null) {
            map.put("keyType", document.getKeyType().clone());
        }
        if (document.getValueType() != null) {
            map.put("valueType", document.getValueType().clone());
        }
        if (document.getValue() != null) {
            map.put("value", new Node().value(document.getValue()));
        }
        if (document.getItems() != null) {
            map.put("items", new Node().items(cloneItems(document.getItems())));
        }
        if (document.getBlueId() != null) {
            map.put("blueId", new Node().value(document.getBlueId()));
        }
        if (document.getBlue() != null) {
            map.put("blue", document.getBlue().clone());
        }
        if (document.getProperties() != null) {
            for (Map.Entry<String, Node> entry : document.getProperties().entrySet()) {
                map.put(entry.getKey(), entry.getValue());
            }
        }
        return map;
    }

    private static void addDiffEntry(List<PatchEntry> target, String path, Node beforeValue, Node afterValue) {
        if (beforeValue == null && afterValue == null) {
            return;
        }
        if (beforeValue == null) {
            target.add(PatchEntry.add(path, afterValue == null ? null : afterValue.clone()));
            return;
        }
        if (afterValue == null) {
            target.add(PatchEntry.remove(path));
            return;
        }
        if (canonicalDifferent(beforeValue, afterValue)) {
            target.add(PatchEntry.replace(path, afterValue.clone()));
        }
    }

    private static boolean canonicalDifferent(Node left, Node right) {
        JsonNode leftTree = JSON_MAPPER.readTree(canonicalSimpleJson(left));
        JsonNode rightTree = JSON_MAPPER.readTree(canonicalSimpleJson(right));
        return !leftTree.equals(rightTree);
    }

    private static String canonicalSimpleJson(Node node) {
        if (node == null) {
            return "null";
        }
        try {
            return BLUE.nodeToSimpleJson(BLUE.preprocess(node.clone()));
        } catch (Exception ex) {
            return BLUE.nodeToSimpleJson(node.clone());
        }
    }

    private static Map<String, Node> contractsMap(Node document) {
        if (document == null || document.getProperties() == null) {
            return Map.of();
        }
        Node contractsNode = document.getProperties().get("contracts");
        if (contractsNode == null || contractsNode.getProperties() == null) {
            return Map.of();
        }
        return contractsNode.getProperties();
    }

    private static Set<String> collectKeys(Map<String, Node> left, Map<String, Node> right) {
        TreeSet<String> keys = new TreeSet<String>();
        if (left != null) {
            keys.addAll(left.keySet());
        }
        if (right != null) {
            keys.addAll(right.keySet());
        }
        return keys;
    }

    private static List<Node> cloneItems(List<Node> items) {
        List<Node> copies = new ArrayList<Node>();
        for (Node item : items) {
            copies.add(item == null ? null : item.clone());
        }
        return copies;
    }

    private static void applyEntry(Node base, PatchEntry entry) {
        String op = normalizeOperation(entry.op);
        String path = PointerUtils.normalizeRequiredPointer(entry.path, "path");
        if ("/".equals(path)) {
            throw new IllegalArgumentException("Root replacement is forbidden");
        }

        List<String> segments = PointerUtils.splitPointerSegmentsList(path);
        Node parent = resolveParent(base, segments, "add".equals(op));
        String leaf = segments.get(segments.size() - 1);

        if ("add".equals(op)) {
            putValue(parent, leaf, cloneValue(entry.val), true, true);
            return;
        }
        if ("replace".equals(op)) {
            ensureExists(parent, leaf, path);
            putValue(parent, leaf, cloneValue(entry.val), false, true);
            return;
        }
        if ("remove".equals(op)) {
            ensureExists(parent, leaf, path);
            removeValue(parent, leaf, path);
            return;
        }
        throw new IllegalArgumentException("Unsupported patch operation: " + entry.op);
    }

    private static String normalizeOperation(String op) {
        if (op == null) {
            throw new IllegalArgumentException("Patch operation is required");
        }
        return op.trim().toLowerCase();
    }

    private static Node resolveParent(Node base, List<String> segments, boolean createMissing) {
        Node current = base;
        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            String nextSegment = segments.get(i + 1);
            current = descend(current, segment, nextSegment, createMissing);
        }
        return current;
    }

    private static Node descend(Node current, String segment, String nextSegment, boolean createMissing) {
        if (current == null) {
            throw new IllegalArgumentException("Path traversal reached null node");
        }
        Map<String, Node> props = current.getProperties();
        if (props != null && props.containsKey(segment)) {
            Node child = props.get(segment);
            if (child == null) {
                if (!createMissing) {
                    throw new IllegalArgumentException("Path does not exist: " + segment);
                }
                child = newNodeForNext(nextSegment);
                props.put(segment, child);
            }
            return child;
        }

        List<Node> items = current.getItems();
        if (items != null && PointerUtils.isArrayIndexSegment(segment)) {
            int index = PointerUtils.parseArrayIndex(segment);
            if (index < 0) {
                throw new IllegalArgumentException("Expected numeric array index: " + segment);
            }
            if (createMissing) {
                while (items.size() <= index) {
                    items.add(null);
                }
            }
            if (index >= items.size()) {
                throw new IllegalArgumentException("Array index out of bounds: " + segment);
            }
            Node child = items.get(index);
            if (child == null) {
                if (!createMissing) {
                    throw new IllegalArgumentException("Path does not exist: " + segment);
                }
                child = newNodeForNext(nextSegment);
                items.set(index, child);
            }
            return child;
        }

        if (!createMissing) {
            throw new IllegalArgumentException("Path does not exist: " + segment);
        }
        Node child = newNodeForNext(nextSegment);
        ensureProperties(current).put(segment, child);
        return child;
    }

    private static void ensureExists(Node parent, String leaf, String path) {
        if (isBuiltInLeaf(leaf)) {
            if (!builtInExists(parent, leaf)) {
                throw new IllegalArgumentException("Path does not exist: " + path);
            }
            return;
        }

        Map<String, Node> props = parent.getProperties();
        if (props != null && props.containsKey(leaf)) {
            return;
        }
        List<Node> items = parent.getItems();
        if (items != null && PointerUtils.isArrayIndexSegment(leaf)) {
            int index = PointerUtils.parseArrayIndex(leaf);
            if (index >= 0 && index < items.size()) {
                return;
            }
        }
        throw new IllegalArgumentException("Path does not exist: " + path);
    }

    private static void putValue(Node parent, String leaf, Node value, boolean createPath, boolean overwriteArrayValue) {
        if (isBuiltInLeaf(leaf)) {
            setBuiltIn(parent, leaf, value);
            return;
        }

        List<Node> items = parent.getItems();
        if (items != null && PointerUtils.isArrayIndexSegment(leaf)) {
            int index = PointerUtils.parseArrayIndex(leaf);
            if (index < 0) {
                throw new IllegalArgumentException("Expected numeric array index: " + leaf);
            }
            if (createPath) {
                while (items.size() <= index) {
                    items.add(null);
                }
                items.set(index, value);
                return;
            }
            if (index == items.size()) {
                items.add(value);
                return;
            }
            if (index >= 0 && index < items.size()) {
                if (overwriteArrayValue) {
                    items.set(index, value);
                } else {
                    items.add(index, value);
                }
                return;
            }
            throw new IllegalArgumentException("Array index out of bounds: " + leaf);
        }

        ensureProperties(parent).put(leaf, value);
    }

    private static void removeValue(Node parent, String leaf, String path) {
        if (isBuiltInLeaf(leaf)) {
            removeBuiltIn(parent, leaf, path);
            return;
        }

        Map<String, Node> props = parent.getProperties();
        if (props != null && props.containsKey(leaf)) {
            props.remove(leaf);
            return;
        }
        List<Node> items = parent.getItems();
        if (items != null && PointerUtils.isArrayIndexSegment(leaf)) {
            int index = PointerUtils.parseArrayIndex(leaf);
            if (index >= 0 && index < items.size()) {
                items.remove(index);
                return;
            }
        }
        throw new IllegalArgumentException("Path does not exist: " + path);
    }

    private static Node cloneValue(Node value) {
        return value == null ? null : value.clone();
    }

    private static Node newNodeForNext(String nextSegment) {
        if (PointerUtils.isArrayIndexSegment(nextSegment)) {
            return new Node().items(new ArrayList<Node>());
        }
        return new Node().properties(new LinkedHashMap<String, Node>());
    }

    private static Map<String, Node> ensureProperties(Node node) {
        if (node.getProperties() == null) {
            node.properties(new LinkedHashMap<String, Node>());
        }
        return node.getProperties();
    }

    private static boolean isBuiltInLeaf(String leaf) {
        return switch (leaf) {
            case "name", "description", "type", "itemType", "keyType", "valueType", "value", "items", "blueId", "blue" -> true;
            default -> false;
        };
    }

    private static boolean builtInExists(Node node, String leaf) {
        return switch (leaf) {
            case "name", "description", "type", "itemType", "keyType", "valueType", "value", "items", "blueId", "blue" -> true;
            default -> false;
        };
    }

    private static void setBuiltIn(Node node, String leaf, Node value) {
        switch (leaf) {
            case "name" -> node.name(value == null || value.getValue() == null ? null : String.valueOf(value.getValue()));
            case "description" -> node.description(value == null || value.getValue() == null ? null : String.valueOf(value.getValue()));
            case "type" -> node.type(value == null ? null : value.clone());
            case "itemType" -> node.itemType(value == null ? null : value.clone());
            case "keyType" -> node.keyType(value == null ? null : value.clone());
            case "valueType" -> node.valueType(value == null ? null : value.clone());
            case "value" -> node.value(value == null ? null : value.getValue());
            case "items" -> node.items(value == null || value.getItems() == null ? null : cloneItems(value.getItems()));
            case "blueId" -> node.blueId(value == null || value.getValue() == null ? null : String.valueOf(value.getValue()));
            case "blue" -> node.blue(value == null ? null : value.clone());
            default -> throw new IllegalArgumentException("Unsupported built-in key: " + leaf);
        }
    }

    private static void removeBuiltIn(Node node, String leaf, String path) {
        switch (leaf) {
            case "name" -> node.name(null);
            case "description" -> node.description(null);
            case "type" -> node.type((Node) null);
            case "itemType" -> node.itemType((Node) null);
            case "keyType" -> node.keyType((Node) null);
            case "valueType" -> node.valueType((Node) null);
            case "value" -> node.value(null);
            case "items" -> node.items((List<Node>) null);
            case "blueId" -> node.blueId(null);
            case "blue" -> node.blue(null);
            default -> throw new IllegalArgumentException("Path does not exist: " + path);
        }
    }
}
