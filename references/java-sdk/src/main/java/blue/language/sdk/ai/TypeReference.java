package blue.language.sdk.ai;

import blue.language.model.Node;
import blue.language.sdk.internal.TypeRef;

public final class TypeReference {

    private final Class<?> typeClass;
    private final Node typeNode;

    private TypeReference(Class<?> typeClass, Node typeNode) {
        this.typeClass = typeClass;
        this.typeNode = typeNode;
    }

    public static TypeReference of(Class<?> typeClass) {
        if (typeClass == null) {
            throw new IllegalArgumentException("typeClass is required");
        }
        return new TypeReference(typeClass, null);
    }

    public static TypeReference of(Node typeNode) {
        if (typeNode == null) {
            throw new IllegalArgumentException("typeNode is required");
        }
        return new TypeReference(null, typeNode.clone());
    }

    public Node toNode() {
        if (typeClass != null) {
            return TypeRef.of(typeClass).asTypeNode();
        }
        return typeNode == null ? null : typeNode.clone();
    }

    public String dedupKey() {
        if (typeClass != null) {
            return "class:" + typeClass.getName();
        }
        Node node = toNode();
        String alias = null;
        if (node != null && node.getType() != null && node.getType().getValue() != null) {
            alias = String.valueOf(node.getType().getValue());
        }
        if (alias != null && !alias.trim().isEmpty()) {
            return "alias:" + alias.trim();
        }
        return "node:" + String.valueOf(node);
    }
}
