package blue.language.sdk.structure;

import blue.language.model.Node;

public class TypeRef {
    public String alias;
    public String blueId;

    public static TypeRef fromNode(Node node) {
        if (node == null) {
            return null;
        }
        TypeRef ref = new TypeRef();
        if (node.getValue() != null) {
            ref.alias = String.valueOf(node.getValue());
        } else if (node.getName() != null) {
            ref.alias = node.getName();
        }
        ref.blueId = extractBlueId(node);
        if (ref.alias == null && ref.blueId == null) {
            return null;
        }
        return ref;
    }

    public String display() {
        if (alias != null && !alias.isBlank()) {
            return alias;
        }
        return blueId;
    }

    private static String extractBlueId(Node node) {
        if (node.getBlueId() != null) {
            return node.getBlueId();
        }
        if (node.getProperties() == null) {
            return null;
        }
        Node blueIdNode = node.getProperties().get("blueId");
        if (blueIdNode == null) {
            return null;
        }
        if (blueIdNode.getValue() != null) {
            return String.valueOf(blueIdNode.getValue());
        }
        return blueIdNode.getBlueId();
    }
}
