package blue.language.snapshot;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import blue.language.processor.util.PointerUtils;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class WorkingDocument {

    private final Blue blue;
    private final SnapshotFactory snapshotFactory;
    private final TypeGeneralizer typeGeneralizer;

    private ResolvedSnapshot baseline;
    private ResolvedSnapshot current;
    private PatchReport lastPatchReport;

    private WorkingDocument(Blue blue,
                            ResolvedSnapshot snapshot,
                            SnapshotFactory snapshotFactory,
                            TypeGeneralizer typeGeneralizer) {
        this.blue = Objects.requireNonNull(blue, "blue");
        this.baseline = Objects.requireNonNull(snapshot, "snapshot");
        this.current = snapshot;
        this.snapshotFactory = Objects.requireNonNull(snapshotFactory, "snapshotFactory");
        this.typeGeneralizer = Objects.requireNonNull(typeGeneralizer, "typeGeneralizer");
        this.lastPatchReport = PatchReport.none();
    }

    public static WorkingDocument forSnapshot(Blue blue, ResolvedSnapshot snapshot) {
        return new WorkingDocument(blue, snapshot, new SnapshotFactory(), new TypeGeneralizer());
    }

    public ResolvedSnapshot snapshot() {
        return current;
    }

    public PatchReport applyPatch(JsonPatch patch) {
        Objects.requireNonNull(patch, "patch");

        String normalizedPath = PointerUtils.normalizeRequiredPointer(patch.getPath(), "Patch path");
        validateMutationPath(normalizedPath, patch.getOp());
        Node resolved = cloneResolvedRootForPatch(normalizedPath, patch.getOp());
        applyPatchInPlace(resolved, patch, normalizedPath);

        GeneralizationReport generalizationReport = typeGeneralizer.generalizeToSoundness(blue, resolved, normalizedPath);
        current = snapshotFactory.fromResolved(blue, resolved, SnapshotTrust.BLIND_TRUST_RESOLVED);
        lastPatchReport = new PatchReport(Collections.singletonList(normalizedPath), generalizationReport);
        return lastPatchReport;
    }

    public ResolvedSnapshot commit() {
        baseline = current;
        return current;
    }

    public PatchReport lastPatchReport() {
        return lastPatchReport;
    }

    private Node cloneResolvedRootForPatch(String normalizedPath, JsonPatch.Op op) {
        List<String> segments = PointerUtils.splitPointerSegmentsList(normalizedPath);
        Node originalRoot = current.resolvedRoot().internalNode();
        Node clonedRoot = shallowCloneNode(originalRoot);
        if (!segments.isEmpty()) {
            boolean createMissing = op != JsonPatch.Op.REMOVE;
            copyPathToParent(originalRoot, clonedRoot, segments, createMissing, normalizedPath);
        }
        return clonedRoot;
    }

    private void applyPatchInPlace(Node root, JsonPatch patch, String normalizedPath) {
        if ("/".equals(normalizedPath)) {
            throw new IllegalArgumentException("Root patch is not supported in WorkingDocument");
        }

        List<String> segments = PointerUtils.splitPointerSegmentsList(normalizedPath);
        Node parent = resolveParent(root, segments, patch.getOp() != JsonPatch.Op.REMOVE, normalizedPath);
        String leaf = segments.get(segments.size() - 1);

        switch (patch.getOp()) {
            case ADD:
                applyAdd(parent, leaf, patch.getVal(), normalizedPath);
                break;
            case REPLACE:
                applyReplace(parent, leaf, patch.getVal(), normalizedPath);
                break;
            case REMOVE:
                applyRemove(parent, leaf, normalizedPath);
                break;
            default:
                throw new UnsupportedOperationException("Unsupported op: " + patch.getOp());
        }
    }

    private void validateMutationPath(String normalizedPath, JsonPatch.Op op) {
        List<String> segments = PointerUtils.splitPointerSegmentsList(normalizedPath);
        for (int i = 0; i < segments.size(); i++) {
            String segment = segments.get(i);
            boolean last = i == segments.size() - 1;

            if ("blueId".equals(segment) && last) {
                throw new UnsupportedOperationException("Mutating /blueId is forbidden in WorkingDocument");
            }
            if ("type".equals(segment) && !last) {
                throw new UnsupportedOperationException("Mutating nested members under /type is forbidden");
            }
        }

        if (!segments.isEmpty() && "type".equals(segments.get(segments.size() - 1)) && op != JsonPatch.Op.REPLACE) {
            throw new UnsupportedOperationException("Only REPLACE is allowed for /type mutations");
        }
    }

    private void applyAdd(Node parent, String leaf, Node value, String path) {
        Node incoming = value != null ? value.clone() : new Node();

        Map<String, Node> properties = parent.getProperties();
        if (properties != null && properties.containsKey(leaf)) {
            ensureMutableProperties(parent).put(leaf, incoming);
            return;
        }

        List<Node> items = parent.getItems();
        if (items != null) {
            if ("-".equals(leaf) || PointerUtils.isArrayIndexSegment(leaf)) {
                if ("-".equals(leaf)) {
                    items.add(incoming);
                    return;
                }
                int index = PointerUtils.parseArrayIndexOrThrow(leaf, path);
                if (index < 0 || index > items.size()) {
                    throw new IllegalStateException("Array index out of bounds for add: " + path);
                }
                items.add(index, incoming);
                return;
            }
            if (properties == null) {
                throw new IllegalStateException("Expected numeric array index in path: " + path);
            }
        }

        if ("-".equals(leaf)) {
            throw new IllegalStateException("Append token '-' requires array parent at path: " + path);
        }

        ensureMutableProperties(parent).put(leaf, incoming);
    }

    private void applyReplace(Node parent, String leaf, Node value, String path) {
        Node incoming = value != null ? value.clone() : new Node();

        Map<String, Node> properties = parent.getProperties();
        if (properties != null && properties.containsKey(leaf)) {
            ensureMutableProperties(parent).put(leaf, incoming);
            return;
        }

        List<Node> items = parent.getItems();
        if (items != null) {
            if ("-".equals(leaf) || PointerUtils.isArrayIndexSegment(leaf)) {
                if ("-".equals(leaf)) {
                    throw new IllegalStateException("Replace does not support append token at path: " + path);
                }
                int index = PointerUtils.parseArrayIndexOrThrow(leaf, path);
                if (index < 0 || index >= items.size()) {
                    throw new IllegalStateException("Array index out of bounds for replace: " + path);
                }
                items.set(index, incoming);
                return;
            }
            if (properties == null) {
                throw new IllegalStateException("Expected numeric array index in path: " + path);
            }
        }

        if ("-".equals(leaf)) {
            throw new IllegalStateException("Append token '-' requires array parent at path: " + path);
        }

        ensureMutableProperties(parent).put(leaf, incoming);
    }

    private void applyRemove(Node parent, String leaf, String path) {
        Map<String, Node> properties = parent.getProperties();
        if (properties != null && properties.containsKey(leaf)) {
            ensureMutableProperties(parent).remove(leaf);
            return;
        }

        List<Node> items = parent.getItems();
        if (items != null) {
            if ("-".equals(leaf) || PointerUtils.isArrayIndexSegment(leaf)) {
                if ("-".equals(leaf)) {
                    throw new IllegalStateException("Remove does not support append token at path: " + path);
                }
                int index = PointerUtils.parseArrayIndexOrThrow(leaf, path);
                if (index < 0 || index >= items.size()) {
                    throw new IllegalStateException("Array index out of bounds for remove: " + path);
                }
                items.remove(index);
                return;
            }
            if (properties == null) {
                throw new IllegalStateException("Expected numeric array index in path: " + path);
            }
        }

        if ("-".equals(leaf)) {
            throw new IllegalStateException("Append token '-' requires array parent at path: " + path);
        }

        properties = parent.getProperties();
        if (properties == null || !properties.containsKey(leaf)) {
            throw new IllegalStateException("Path does not exist for remove: " + path);
        }
        properties.remove(leaf);
    }

    private Node resolveParent(Node root, List<String> segments, boolean createMissing, String path) {
        Node currentNode = root;
        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            currentNode = descend(currentNode, segment, createMissing, path);
        }
        return currentNode;
    }

    private Node descend(Node currentNode, String segment, boolean createMissing, String path) {
        if (currentNode == null) {
            throw new IllegalStateException("Path does not exist: " + path);
        }

        Map<String, Node> properties = currentNode.getProperties();
        if (properties != null && properties.containsKey(segment)) {
            return properties.get(segment);
        }

        List<Node> items = currentNode.getItems();
        if (items != null) {
            if ("-".equals(segment) || PointerUtils.isArrayIndexSegment(segment)) {
                if ("-".equals(segment)) {
                    throw new IllegalStateException("Append token '-' is only allowed on final segment: " + path);
                }
                int index = PointerUtils.parseArrayIndexOrThrow(segment, path);
                if (index < 0 || index >= items.size()) {
                    throw new IllegalStateException("Array index out of bounds: " + path);
                }
                Node child = items.get(index);
                if (child == null && createMissing) {
                    child = new Node();
                    items.set(index, child);
                }
                return child;
            }
            if (properties == null) {
                throw new IllegalStateException("Expected numeric array index in path: " + path);
            }
        }

        properties = ensureMutableProperties(currentNode);
        Node child = properties.get(segment);
        if (child == null && createMissing) {
            child = new Node();
            properties.put(segment, child);
        }
        if (child == null) {
            throw new IllegalStateException("Path does not exist: " + path);
        }
        return child;
    }

    private Map<String, Node> ensureMutableProperties(Node node) {
        Map<String, Node> properties = node.getProperties();
        if (properties == null) {
            node.properties(new LinkedHashMap<String, Node>());
            return node.getProperties();
        }
        if (!(properties instanceof LinkedHashMap)) {
            node.properties(new LinkedHashMap<String, Node>(properties));
            return node.getProperties();
        }
        return properties;
    }

    private void copyPathToParent(Node originalRoot,
                                  Node clonedRoot,
                                  List<String> segments,
                                  boolean createMissing,
                                  String path) {
        Node originalNode = originalRoot;
        Node clonedNode = clonedRoot;

        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            Map<String, Node> originalProperties = originalNode != null ? originalNode.getProperties() : null;
            if (originalProperties != null && originalProperties.containsKey(segment)) {
                Map<String, Node> mutableProperties = ensureMutablePropertiesForCopy(clonedNode, originalProperties);
                Node originalChild = originalProperties.get(segment);
                Node clonedChild = shallowCloneNode(originalChild);
                mutableProperties.put(segment, clonedChild);
                originalNode = originalChild;
                clonedNode = clonedChild;
                continue;
            }

            List<Node> originalItems = originalNode != null ? originalNode.getItems() : null;
            if (originalItems != null) {
                if ("-".equals(segment)) {
                    throw new IllegalStateException("Append token '-' is only allowed on final segment: " + path);
                }
                if (PointerUtils.isArrayIndexSegment(segment)) {
                    int index = PointerUtils.parseArrayIndexOrThrow(segment, path);
                    if (index < 0 || index >= originalItems.size()) {
                        throw new IllegalStateException("Array index out of bounds: " + path);
                    }
                    List<Node> mutableItems = ensureMutableItemsForCopy(clonedNode, originalItems);
                    Node originalChild = originalItems.get(index);
                    Node clonedChild = originalChild != null ? shallowCloneNode(originalChild) : new Node();
                    mutableItems.set(index, clonedChild);
                    originalNode = originalChild;
                    clonedNode = clonedChild;
                    continue;
                }
                if (originalProperties == null) {
                    throw new IllegalStateException("Expected numeric array index in path: " + path);
                }
            }

            Map<String, Node> mutableProperties = ensureMutablePropertiesForCopy(clonedNode, originalProperties);
            Node originalChild = originalProperties != null ? originalProperties.get(segment) : null;
            if (originalChild == null && !createMissing) {
                throw new IllegalStateException("Path does not exist: " + path);
            }
            Node clonedChild = originalChild != null ? shallowCloneNode(originalChild) : new Node();
            mutableProperties.put(segment, clonedChild);
            originalNode = originalChild;
            clonedNode = clonedChild;
        }
    }

    private Map<String, Node> ensureMutablePropertiesForCopy(Node clonedNode, Map<String, Node> originalProperties) {
        Map<String, Node> properties = clonedNode.getProperties();
        if (properties == null) {
            properties = new LinkedHashMap<String, Node>();
            clonedNode.properties(properties);
            return properties;
        }
        if (properties == originalProperties || !(properties instanceof LinkedHashMap)) {
            properties = new LinkedHashMap<String, Node>(properties);
            clonedNode.properties(properties);
            return properties;
        }
        return properties;
    }

    private List<Node> ensureMutableItemsForCopy(Node clonedNode, List<Node> originalItems) {
        List<Node> items = clonedNode.getItems();
        if (items == null) {
            items = new java.util.ArrayList<Node>();
            clonedNode.items(items);
            return items;
        }
        if (items == originalItems || !(items instanceof java.util.ArrayList)) {
            items = new java.util.ArrayList<Node>(items);
            clonedNode.items(items);
            return items;
        }
        return items;
    }

    private Node shallowCloneNode(Node source) {
        Node clone = new Node();
        clone.name(source.getName());
        clone.description(source.getDescription());
        clone.type(source.getType());
        clone.itemType(source.getItemType());
        clone.keyType(source.getKeyType());
        clone.valueType(source.getValueType());
        clone.value(source.getValue());
        clone.items(source.getItems());
        clone.properties(source.getProperties());
        clone.constraints(source.getConstraints());
        clone.blueId(source.getBlueId());
        clone.blue(source.getBlue());
        return clone;
    }

}
