package blue.language.snapshot;

import blue.language.model.Node;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class FrozenNode {

    private final Node node;
    private final String cachedBlueId;

    private FrozenNode(Node node, String cachedBlueId) {
        this.node = node;
        this.cachedBlueId = cachedBlueId;
    }

    public static FrozenNode fromNode(Node node) {
        Objects.requireNonNull(node, "node");
        return new FrozenNode(node.clone(), null);
    }

    public Node toNode() {
        return node.clone();
    }

    Node internalNode() {
        return node;
    }

    public Optional<String> cachedBlueId() {
        return Optional.ofNullable(cachedBlueId);
    }

    public FrozenNode withCachedBlueId(String id) {
        return new FrozenNode(toNode(), id);
    }

    public FrozenNode withProperty(String key, FrozenNode value) {
        Objects.requireNonNull(key, "key");
        Node mutable = toNode();

        Map<String, Node> properties = mutable.getProperties();
        Map<String, Node> updated = properties == null
                ? new LinkedHashMap<String, Node>()
                : new LinkedHashMap<String, Node>(properties);
        updated.put(key, value != null ? value.toNode() : null);
        mutable.properties(updated);

        return new FrozenNode(mutable, cachedBlueId);
    }

    public FrozenNode withoutProperty(String key) {
        Objects.requireNonNull(key, "key");
        Node mutable = toNode();
        Map<String, Node> properties = mutable.getProperties();
        if (properties == null || properties.isEmpty()) {
            return this;
        }

        Map<String, Node> updated = new LinkedHashMap<String, Node>(properties);
        updated.remove(key);
        mutable.properties(updated.isEmpty() ? null : updated);
        return new FrozenNode(mutable, cachedBlueId);
    }

    public FrozenNode withValue(Object value) {
        Node mutable = toNode();
        mutable.value(value);
        return new FrozenNode(mutable, cachedBlueId);
    }

    public FrozenNode withType(FrozenNode type) {
        Node mutable = toNode();
        mutable.type(type != null ? type.toNode() : null);
        return new FrozenNode(mutable, cachedBlueId);
    }
}
