package blue.language.sdk.internal;

import blue.language.model.Node;

import java.util.LinkedHashMap;
import java.util.Map;

public final class NodeObjectBuilder {

    private final Node node = new Node();

    private NodeObjectBuilder() {
    }

    public static NodeObjectBuilder create() {
        return new NodeObjectBuilder();
    }

    public NodeObjectBuilder type(String typeAlias) {
        node.type(typeAlias);
        return this;
    }

    public NodeObjectBuilder type(Class<?> typeClass) {
        node.type(TypeRef.of(typeClass).asTypeNode());
        return this;
    }

    public NodeObjectBuilder put(String key, Object value) {
        if (value instanceof Node) {
            node.properties(key, (Node) value);
            return this;
        }
        node.properties(key, new Node().value(value));
        return this;
    }

    public NodeObjectBuilder putNode(String key, Node value) {
        node.properties(key, value);
        return this;
    }

    public NodeObjectBuilder putStringMap(String key, Map<String, String> map) {
        Node dictionary = new Node().properties(new LinkedHashMap<String, Node>());
        if (map != null) {
            for (Map.Entry<String, String> entry : map.entrySet()) {
                String rawKey = entry.getKey();
                if (rawKey == null) {
                    continue;
                }
                String normalizedKey = rawKey.trim();
                if (normalizedKey.isEmpty()) {
                    continue;
                }
                String value = entry.getValue();
                dictionary.properties(normalizedKey, new Node().value(value));
            }
        }
        node.properties(key, dictionary);
        return this;
    }

    public NodeObjectBuilder putExpression(String key, String expression) {
        node.properties(key, new Node().value(expr(expression)));
        return this;
    }

    public Node build() {
        return node;
    }

    private static String expr(String expression) {
        if (expression == null) {
            return null;
        }
        String trimmed = expression.trim();
        if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
            return trimmed;
        }
        return "${" + trimmed + "}";
    }
}
