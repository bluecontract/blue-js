package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.JsonPatch;
import blue.language.processor.util.PointerUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Encapsulates document mutation logic: JSON Patch application, direct writes, and pointer helpers.
 */
final class PatchEngine {

    private final Node document;

    PatchEngine(Node document) {
        this.document = Objects.requireNonNull(document, "document");
    }

    PatchResult applyPatch(String originScopePath, JsonPatch patch) {
        Objects.requireNonNull(patch, "patch");

        String normalizedScope = PointerUtils.normalizeScope(originScopePath);
        String targetPath = normalizePatchPointer(patch.getPath());
        List<String> segments = splitPatchSegments(targetPath);

        Node before = cloneNode(readPatchNode(document, segments, LookupMode.BEFORE, targetPath));
        JsonPatch.Op op = patch.getOp();

        switch (patch.getOp()) {
            case ADD:
                applyAdd(document, segments, clonePatchValue(patch.getVal()), targetPath);
                break;
            case REPLACE:
                applyReplace(document, segments, clonePatchValue(patch.getVal()), targetPath);
                break;
            case REMOVE:
                applyRemove(document, segments, targetPath);
                break;
            default:
                throw new UnsupportedOperationException("Unsupported patch op: " + patch.getOp());
        }

        Node after = patch.getOp() == JsonPatch.Op.REMOVE
                ? null
                : cloneNode(readPatchNode(document, segments, LookupMode.AFTER, targetPath));
        List<String> cascadeScopes = PointerUtils.ancestorPointers(normalizedScope, true);
        return new PatchResult(targetPath, before, after, op, normalizedScope, cascadeScopes);
    }

    void directWrite(String path, Node value) {
        String normalized = PointerUtils.normalizeRequiredPointer(path, "Patch path");
        if ("/".equals(normalized)) {
            throw new IllegalArgumentException("Direct write cannot target root document");
        }
        List<String> segments = PointerUtils.splitPointerSegmentsList(normalized);
        ParentContext ctx = resolveParent(document, segments, true, normalized);
        Node parent = ctx.parent;
        String leaf = ctx.leaf;

        Map<String, Node> existingProperties = ensureMutableProperties(parent, false);
        if (existingProperties != null && existingProperties.containsKey(leaf)) {
            if (value == null) {
                existingProperties.remove(leaf);
            } else {
                ensureMutableProperties(parent).put(leaf, value.clone());
            }
            return;
        }

        List<Node> items = parent.getItems();
        if (items != null) {
            if ("-".equals(leaf)) {
                throw new IllegalArgumentException("Direct write does not support append token '-' for path " + normalized);
            }
            if (PointerUtils.isArrayIndexSegment(leaf)) {
                List<Node> mutable = ensureMutableItems(parent);
                int index = PointerUtils.parseArrayIndexOrThrow(leaf, normalized);
                if (value == null) {
                    if (index < 0 || index >= mutable.size()) {
                        return;
                    }
                    mutable.remove(index);
                } else {
                    if (index == mutable.size()) {
                        mutable.add(value.clone());
                    } else if (index >= 0 && index < mutable.size()) {
                        mutable.set(index, value.clone());
                    } else {
                        throw new IllegalStateException("Array index out of bounds for direct write: " + normalized);
                    }
                }
                return;
            }
            if (existingProperties == null) {
                throw new IllegalStateException("Expected numeric array index in path: " + normalized);
            }
        }

        Map<String, Node> properties = ensureMutableProperties(parent);
        if (value == null) {
            properties.remove(leaf);
        } else {
            properties.put(leaf, value.clone());
        }
    }

    private void applyAdd(Node root, List<String> segments, Node value, String path) {
        if ("/".equals(path) || path.length() == 0) {
            throw new IllegalStateException("ADD operation cannot target document root");
        }
        PatchParentContext ctx = resolvePatchParent(root, segments, path, false);
        try {
            Node parent = ctx.parent;
            String leaf = ctx.key;
            boolean append = "-".equals(leaf);

            List<Node> items = parent.getItems();
            if (isPatchArrayIndexSegment(leaf)) {
                if (items == null) {
                    if (append) {
                        throw new IllegalStateException("Append token '-' requires array at " + path);
                    }
                    throw new IllegalStateException("Array index segment requires array at " + path);
                }
                List<Node> mutable = ensureMutableItems(parent);
                if (append) {
                    mutable.add(value);
                    return;
                }
                int index = parsePatchArrayIndex(leaf, path);
                if (index < 0 || index > mutable.size()) {
                    throw new IllegalStateException("Array index out of bounds in path: " + path);
                }
                mutable.add(index, value);
                return;
            }

            Map<String, Node> properties = ensureMutableProperties(parent);
            properties.put(leaf, value);
        } catch (RuntimeException ex) {
            rollbackPatchCreated(ctx.createdNodes);
            throw ex;
        }
    }

    private void applyReplace(Node root, List<String> segments, Node value, String path) {
        if ("/".equals(path) || path.length() == 0) {
            throw new IllegalStateException("REPLACE operation cannot target document root");
        }
        PatchParentContext ctx = resolvePatchParent(root, segments, path, false);
        try {
            Node parent = ctx.parent;
            String leaf = ctx.key;

            List<Node> items = parent.getItems();
            if (isPatchArrayIndexSegment(leaf)) {
                if (items == null) {
                    throw new IllegalStateException("Array index segment requires array at " + path);
                }
                int index = parsePatchArrayIndex(leaf, path);
                if (index < 0 || index >= items.size()) {
                    throw new IllegalStateException("Array index out of bounds in path: " + path);
                }
                List<Node> mutable = ensureMutableItems(parent);
                mutable.set(index, value);
                return;
            }

            Map<String, Node> properties = ensureMutableProperties(parent);
            properties.put(leaf, value);
        } catch (RuntimeException ex) {
            rollbackPatchCreated(ctx.createdNodes);
            throw ex;
        }
    }

    private void applyRemove(Node root, List<String> segments, String path) {
        if ("/".equals(path) || path.length() == 0) {
            throw new IllegalStateException("REMOVE operation cannot target document root");
        }
        PatchParentContext ctx = resolvePatchParent(root, segments, path, true);
        try {
            Node parent = ctx.parent;
            String leaf = ctx.key;

            List<Node> items = parent.getItems();
            if (isPatchArrayIndexSegment(leaf)) {
                if (items == null) {
                    throw new IllegalStateException("Array index segment requires array at " + path);
                }
                int index = parsePatchArrayIndex(leaf, path);
                if (index < 0 || index >= items.size()) {
                    throw new IllegalStateException("Array index out of bounds in path: " + path);
                }
                List<Node> mutable = ensureMutableItems(parent);
                mutable.remove(index);
                return;
            }

            Map<String, Node> properties = ensureMutableProperties(parent, false);
            if (properties == null || !properties.containsKey(leaf)) {
                throw new IllegalStateException("Path does not exist: " + path);
            }
            properties.remove(leaf);
        } catch (RuntimeException ex) {
            rollbackPatchCreated(ctx.createdNodes);
            throw ex;
        }
    }

    private Node readPatchNode(Node root,
                               List<String> segments,
                               LookupMode mode,
                               String path) {
        if (segments.isEmpty()) {
            return root;
        }
        Node current = root;
        for (int i = 0; i < segments.size(); i++) {
            String segment = segments.get(i);
            boolean last = i == segments.size() - 1;
            current = descendPatchForRead(current, segment, last, mode, path);
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private Node descendPatchForRead(Node current,
                                     String segment,
                                     boolean last,
                                     LookupMode mode,
                                     String path) {
        if (current == null) {
            return null;
        }
        List<Node> items = current.getItems();
        if (items != null) {
            if ("-".equals(segment)) {
                if (!last) {
                    throw new IllegalStateException("Append token '-' must be final segment: " + path);
                }
                if (mode == LookupMode.BEFORE) {
                    return null;
                }
                return items.isEmpty() ? null : items.get(items.size() - 1);
            }
            int index = parsePatchArrayIndex(segment, path);
            if (index < 0 || index >= items.size()) {
                return null;
            }
            return items.get(index);
        }
        Map<String, Node> properties = ensureMutableProperties(current, false);
        if (properties == null) {
            return null;
        }
        return properties.get(segment);
    }

    private PatchParentContext resolvePatchParent(Node root,
                                                  List<String> segments,
                                                  String originalPath,
                                                  boolean removeOperation) {
        if (segments.isEmpty()) {
            throw new IllegalStateException("Cannot apply patch to document root");
        }

        Node current = root;
        List<CreatedNode> createdNodes = new ArrayList<>();
        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            String pointer = patchPointerPrefix(segments, i + 1);
            current = descendPatchForMutation(current, segment, pointer, removeOperation, createdNodes);
        }
        return new PatchParentContext(current, segments.get(segments.size() - 1), createdNodes);
    }

    private Node descendPatchForMutation(Node current,
                                         String segment,
                                         String pointer,
                                         boolean removeOperation,
                                         List<CreatedNode> createdNodes) {
        if (current == null) {
            throw new IllegalStateException("Path does not exist: " + pointer);
        }

        if (isPatchArrayIndexSegment(segment)) {
            List<Node> items = current.getItems();
            if (items == null) {
                throw new IllegalStateException("Array index segment requires array at " + pointer);
            }
            int index = parsePatchArrayIndex(segment, pointer);
            if (index < 0 || index >= items.size()) {
                throw new IllegalStateException("Array index out of bounds in path: " + pointer);
            }
            Node child = items.get(index);
            if (child == null) {
                throw new IllegalStateException("Array index out of bounds in path: " + pointer);
            }
            return child;
        }

        Map<String, Node> properties = ensureMutableProperties(current, false);
        Node child = properties != null ? properties.get(segment) : null;
        if (child == null) {
            if (removeOperation) {
                throw new IllegalStateException("Path does not exist: " + pointer);
            }
            child = new Node();
            boolean mapWasAbsent = properties == null;
            ensureMutableProperties(current).put(segment, child);
            if (createdNodes != null) {
                createdNodes.add(CreatedNode.forProperty(current, segment, mapWasAbsent));
            }
        }
        return child;
    }

    private void rollbackPatchCreated(List<CreatedNode> createdNodes) {
        if (createdNodes == null || createdNodes.isEmpty()) {
            return;
        }
        rollbackCreatedNodes(createdNodes);
    }

    private String normalizePatchPointer(String pointer) {
        if (pointer == null || pointer.length() == 0) {
            return "/";
        }
        return pointer.charAt(0) == '/' ? pointer : "/" + pointer;
    }

    private List<String> splitPatchSegments(String pointer) {
        String normalized = normalizePatchPointer(pointer);
        if ("/".equals(normalized) || normalized.length() == 0) {
            return new ArrayList<String>();
        }
        String raw = normalized.charAt(0) == '/' ? normalized.substring(1) : normalized;
        if (raw.length() == 0) {
            return new ArrayList<String>();
        }
        return new ArrayList<String>(Arrays.asList(raw.split("/", -1)));
    }

    private boolean isPatchArrayIndexSegment(String segment) {
        if (segment == null || segment.length() == 0) {
            return false;
        }
        if ("-".equals(segment)) {
            return true;
        }
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return true;
    }

    private int parsePatchArrayIndex(String segment, String path) {
        if (segment == null || segment.length() == 0) {
            throw new IllegalStateException("Expected numeric array index in path: " + path);
        }
        try {
            return Integer.parseInt(segment);
        } catch (NumberFormatException ex) {
            throw new IllegalStateException("Expected numeric array index in path: " + path);
        }
    }

    private String patchPointerPrefix(List<String> segments, int length) {
        if (segments == null || length <= 0) {
            return "/";
        }
        int limit = Math.min(length, segments.size());
        if (limit <= 0) {
            return "/";
        }
        StringBuilder pointer = new StringBuilder();
        for (int i = 0; i < limit; i++) {
            pointer.append('/');
            String segment = segments.get(i);
            if (segment != null) {
                pointer.append(segment);
            }
        }
        return pointer.length() == 0 ? "/" : pointer.toString();
    }

    private Node clonePatchValue(Node value) {
        if (value == null) {
            return new Node().value(null);
        }
        return value.clone();
    }

    private ParentContext resolveParent(Node root,
                                        List<String> segments,
                                        boolean createMissingObjects,
                                        String path) {
        if (segments.isEmpty()) {
            throw new IllegalArgumentException("Cannot apply patch to document root");
        }

        Node current = root;
        List<CreatedNode> createdNodes = createMissingObjects ? new ArrayList<>() : null;
        try {
            for (int i = 0; i < segments.size() - 1; i++) {
                String segment = segments.get(i);
                current = descendForMutation(current, segment, createMissingObjects, path, i, segments, createdNodes);
            }
        } catch (RuntimeException ex) {
            if (createdNodes != null && !createdNodes.isEmpty()) {
                rollbackCreatedNodes(createdNodes);
            }
            throw ex;
        }

        return new ParentContext(current, segments.get(segments.size() - 1), createdNodes);
    }

    private Node descendForMutation(Node current,
                                    String segment,
                                    boolean createMissingObjects,
                                    String fullPath,
                                    int index,
                                    List<String> segments,
                                    List<CreatedNode> createdNodes) {
        if (current == null) {
            throw new IllegalStateException("Path does not exist: "
                    + PointerUtils.pointerFromSegments(segments, index));
        }

        Map<String, Node> properties = ensureMutableProperties(current, false);
        if (properties != null && properties.containsKey(segment)) {
            return properties.get(segment);
        }

        List<Node> items = current.getItems();
        if (items != null && ("-".equals(segment) || PointerUtils.isArrayIndexSegment(segment))) {
            if ("-".equals(segment)) {
                throw new IllegalStateException("Append token '-' must be final segment: " + fullPath);
            }
            int arrayIndex = PointerUtils.parseArrayIndexOrThrow(segment, fullPath);
            if (arrayIndex < 0 || arrayIndex >= items.size()) {
                throw new IllegalStateException("Array index out of bounds: "
                        + PointerUtils.pointerFromSegments(segments, index + 1));
            }
            Node child = items.get(arrayIndex);
            if (child == null) {
                if (createMissingObjects) {
                    child = new Node();
                    List<Node> mutable = ensureMutableItems(current);
                    mutable.set(arrayIndex, child);
                    if (createdNodes != null) {
                        createdNodes.add(CreatedNode.forArray(current, arrayIndex));
                    }
                } else {
                    throw new IllegalStateException("Path does not exist: "
                            + PointerUtils.pointerFromSegments(segments, index + 1));
                }
            }
            return child;
        }
        if (items != null && properties == null) {
            throw new IllegalStateException("Expected numeric array index in path: " + fullPath);
        }

        if (properties == null && current.getValue() != null) {
            throw new IllegalStateException("Cannot traverse into scalar at path: "
                    + PointerUtils.pointerFromSegments(segments, index + 1));
        }
        Node child = properties != null ? properties.get(segment) : null;
        if (child == null) {
            if (!createMissingObjects) {
                throw new IllegalStateException("Path does not exist: "
                        + PointerUtils.pointerFromSegments(segments, index + 1));
            }
            child = new Node();
            boolean mapWasAbsent = properties == null;
            ensureMutableProperties(current).put(segment, child);
            if (createdNodes != null) {
                createdNodes.add(CreatedNode.forProperty(current, segment, mapWasAbsent));
            }
        }
        return child;
    }

    private void rollbackCreatedNodes(List<CreatedNode> createdNodes) {
        for (int i = createdNodes.size() - 1; i >= 0; i--) {
            createdNodes.get(i).rollback();
        }
    }

    private List<Node> ensureMutableItems(Node node) {
        List<Node> items = node.getItems();
        if (items == null) {
            items = new ArrayList<>();
            node.items(items);
        } else if (!(items instanceof ArrayList)) {
            items = new ArrayList<>(items);
            node.items(items);
        }
        return items;
    }

    private Map<String, Node> ensureMutableProperties(Node node) {
        return ensureMutableProperties(node, true);
    }

    private Map<String, Node> ensureMutableProperties(Node node, boolean create) {
        Map<String, Node> properties = node.getProperties();
        if (properties == null) {
            if (!create) {
                return null;
            }
            properties = new LinkedHashMap<>();
            node.properties(properties);
            return node.getProperties();
        }
        return properties;
    }

    private Node cloneNode(Node node) {
        return node != null ? node.clone() : null;
    }

    private enum LookupMode {
        BEFORE,
        AFTER
    }

    static final class PatchResult {
        private final String path;
        private final Node before;
        private final Node after;
        private final JsonPatch.Op op;
        private final String originScope;
        private final List<String> cascadeScopes;

        PatchResult(String path,
                    Node before,
                    Node after,
                    JsonPatch.Op op,
                    String originScope,
                    List<String> cascadeScopes) {
            this.path = path;
            this.before = before;
            this.after = after;
            this.op = op;
            this.originScope = originScope;
            this.cascadeScopes = cascadeScopes;
        }

        String path() {
            return path;
        }

        Node before() {
            return before;
        }

        Node after() {
            return after;
        }

        JsonPatch.Op op() {
            return op;
        }

        String originScope() {
            return originScope;
        }

        List<String> cascadeScopes() {
            return cascadeScopes;
        }
    }

    private static final class ParentContext {
        final Node parent;
        final String leaf;
        final List<CreatedNode> createdNodes;

        ParentContext(Node parent, String leaf, List<CreatedNode> createdNodes) {
            this.parent = parent;
            this.leaf = leaf;
            this.createdNodes = createdNodes;
        }

        void rollback(PatchEngine engine) {
            if (createdNodes != null && !createdNodes.isEmpty()) {
                engine.rollbackCreatedNodes(createdNodes);
            }
        }
    }

    private static final class PatchParentContext {
        final Node parent;
        final String key;
        final List<CreatedNode> createdNodes;

        PatchParentContext(Node parent, String key, List<CreatedNode> createdNodes) {
            this.parent = parent;
            this.key = key;
            this.createdNodes = createdNodes;
        }
    }

    private static final class CreatedNode {
        private final Node parent;
        private final String propertyKey;
        private final Integer arrayIndex;
        private final boolean mapWasAbsent;

        private CreatedNode(Node parent, String propertyKey, Integer arrayIndex, boolean mapWasAbsent) {
            this.parent = parent;
            this.propertyKey = propertyKey;
            this.arrayIndex = arrayIndex;
            this.mapWasAbsent = mapWasAbsent;
        }

        static CreatedNode forProperty(Node parent, String propertyKey, boolean mapWasAbsent) {
            return new CreatedNode(parent, propertyKey, null, mapWasAbsent);
        }

        static CreatedNode forArray(Node parent, int index) {
            return new CreatedNode(parent, null, index, false);
        }

        void rollback() {
            if (arrayIndex != null) {
                List<Node> items = parent.getItems();
                if (items != null && arrayIndex >= 0 && arrayIndex < items.size()) {
                    items.set(arrayIndex, null);
                }
                return;
            }
            if (mapWasAbsent) {
                parent.properties(null);
                return;
            }
            Map<String, Node> properties = parent.getProperties();
            if (properties != null) {
                properties.remove(propertyKey);
            }
        }
    }
}
