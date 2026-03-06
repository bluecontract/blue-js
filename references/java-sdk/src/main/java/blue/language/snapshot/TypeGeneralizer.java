package blue.language.snapshot;

import blue.language.Blue;
import blue.language.blueid.BlueIdCalculator;
import blue.language.merge.processor.ConstraintsVerifier;
import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class TypeGeneralizer {

    public GeneralizationReport generalizeToSoundness(Blue blue, FrozenNode resolvedRoot, String changedPointer) {
        Objects.requireNonNull(blue, "blue");
        Objects.requireNonNull(resolvedRoot, "resolvedRoot");
        Node mutableRoot = resolvedRoot.toNode();
        return generalizeToSoundness(blue, mutableRoot, changedPointer);
    }

    public GeneralizationReport generalizeToSoundness(Blue blue, Node mutableResolvedRoot, String changedPointer) {
        Objects.requireNonNull(blue, "blue");
        Objects.requireNonNull(mutableResolvedRoot, "mutableResolvedRoot");

        List<String> records = new ArrayList<String>();
        List<String> pointers = PointerUtils.ancestorPointers(changedPointer, false);
        for (String pointer : pointers) {
            Node node = nodeAt(mutableResolvedRoot, pointer);
            if (node == null || node.getType() == null) {
                continue;
            }

            while (!isConformant(blue, node)) {
                Node currentType = node.getType();
                Node parentType = currentType.getType();
                if (parentType == null) {
                    break;
                }

                String before = displayType(currentType);
                Node generalizedType = parentType.clone();
                node.type(generalizedType);
                String after = displayType(generalizedType);
                records.add(pointer + ": " + before + " -> " + after);
            }
        }

        if (records.isEmpty()) {
            return GeneralizationReport.none();
        }
        return new GeneralizationReport(records);
    }

    private boolean isConformant(Blue blue, Node node) {
        if (node == null || node.getType() == null) {
            return true;
        }
        try {
            return matchesTypeLocally(node, node.getType(), blue);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private boolean matchesTypeLocally(Node node, Node targetType, Blue blue) {
        if (targetType == null) {
            return true;
        }

        if (!verifyLocalConstraints(node, targetType, blue)) {
            return false;
        }

        if (targetType.getType() != null) {
            if (node.getType() == null || !isSubtypeLocal(node.getType(), targetType.getType())) {
                return false;
            }
        }

        if (targetType.getValue() != null && !targetType.getValue().equals(node.getValue())) {
            return false;
        }

        if (targetType.getItems() != null) {
            List<Node> nodeItems = node.getItems() != null ? node.getItems() : Collections.<Node>emptyList();
            for (int i = 0; i < targetType.getItems().size(); i++) {
                Node targetItem = targetType.getItems().get(i);
                if (i >= nodeItems.size()) {
                    if (hasValueInNestedStructure(targetItem)) {
                        return false;
                    }
                    continue;
                }
                if (!matchesTypeLocally(nodeItems.get(i), targetItem, blue)) {
                    return false;
                }
            }
        }

        if (targetType.getProperties() != null) {
            Map<String, Node> nodeProperties = node.getProperties() != null
                    ? node.getProperties()
                    : Collections.<String, Node>emptyMap();
            for (Map.Entry<String, Node> entry : targetType.getProperties().entrySet()) {
                Node targetProperty = entry.getValue();
                if (nodeProperties.containsKey(entry.getKey())) {
                    if (!matchesTypeLocally(nodeProperties.get(entry.getKey()), targetProperty, blue)) {
                        return false;
                    }
                    continue;
                }
                if (targetProperty.getConstraints() != null &&
                        Boolean.TRUE.equals(targetProperty.getConstraints().getRequiredValue())) {
                    return false;
                }
                if (hasValueInNestedStructure(targetProperty)) {
                    return false;
                }
            }
        }

        return true;
    }

    private Node nodeAt(Node root, String pointer) {
        String[] segments = PointerUtils.splitPointerSegments(pointer);
        Node current = root;
        for (String segment : segments) {
            Map<String, Node> properties = current.getProperties();
            if (properties != null && properties.containsKey(segment)) {
                current = properties.get(segment);
            } else if (PointerUtils.isArrayIndexSegment(segment)) {
                if (current.getItems() == null) {
                    return null;
                }
                int index = PointerUtils.parseArrayIndex(segment);
                if (index < 0 || index >= current.getItems().size()) {
                    return null;
                }
                current = current.getItems().get(index);
            } else {
                return null;
            }

            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private boolean verifyLocalConstraints(Node node, Node targetType, Blue blue) {
        if (targetType.getConstraints() == null) {
            return true;
        }
        Node constrained = node.clone();
        constrained.constraints(targetType.getConstraints().clone());
        try {
            new ConstraintsVerifier().postProcess(constrained, targetType, blue.getNodeProvider(), null);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private boolean isSubtypeLocal(Node subtype, Node supertype) {
        Node current = subtype;
        while (current != null) {
            if (sameTypeIdentity(current, supertype)) {
                return true;
            }
            current = current.getType();
        }
        return false;
    }

    private boolean sameTypeIdentity(Node left, Node right) {
        if (left == null || right == null) {
            return false;
        }
        if (BlueIdCalculator.isPureReferenceNode(left) && BlueIdCalculator.isPureReferenceNode(right)) {
            return Objects.equals(left.getBlueId(), right.getBlueId());
        }
        if (left.getBlueId() != null && right.getBlueId() != null && left.getBlueId().equals(right.getBlueId())) {
            return true;
        }
        return BlueIdCalculator.calculateSemanticBlueId(left)
                .equals(BlueIdCalculator.calculateSemanticBlueId(right));
    }

    private String displayType(Node typeNode) {
        if (typeNode == null) {
            return "<none>";
        }
        if (typeNode.getName() != null) {
            return typeNode.getName();
        }
        if (typeNode.getBlueId() != null) {
            return typeNode.getBlueId();
        }
        return "<anonymous>";
    }

    private boolean hasValueInNestedStructure(Node node) {
        if (node.getValue() != null) {
            return true;
        }

        if (node.getItems() != null) {
            for (Node item : node.getItems()) {
                if (hasValueInNestedStructure(item)) {
                    return true;
                }
            }
        }

        if (node.getProperties() != null) {
            for (Node property : node.getProperties().values()) {
                if (hasValueInNestedStructure(property)) {
                    return true;
                }
            }
        }

        return false;
    }

}
