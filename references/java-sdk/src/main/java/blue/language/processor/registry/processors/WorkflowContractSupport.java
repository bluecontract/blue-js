package blue.language.processor.registry.processors;

import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.utils.Properties;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class WorkflowContractSupport {

    private WorkflowContractSupport() {
    }

    static boolean matchesEventFilter(Node event, Node filter) {
        return matchesEventFilter(event, filter, null);
    }

    static boolean matchesEventFilter(Node event, Node filter, NodeProvider nodeProvider) {
        if (filter == null) {
            return true;
        }
        if (event == null) {
            return false;
        }
        return matchesNode(event, filter, nodeProvider);
    }

    static boolean matchesTypeRequirement(Node candidate, Node requirement) {
        return matchesTypeRequirement(candidate, requirement, null);
    }

    static boolean matchesTypeRequirement(Node candidate, Node requirement, NodeProvider nodeProvider) {
        if (candidate == null || requirement == null) {
            return false;
        }
        if (!matchesType(candidate, requirement, nodeProvider)) {
            return false;
        }
        if (requirement.getValue() != null) {
            if (candidate.getValue() == null || !requirement.getValue().equals(candidate.getValue())) {
                return false;
            }
        }

        Node entries = requirement.getProperties() != null ? requirement.getProperties().get("entries") : null;
        if (entries != null && entries.getProperties() != null && !entries.getProperties().isEmpty()) {
            if (candidate.getProperties() == null) {
                return false;
            }
            for (java.util.Map.Entry<String, Node> entry : entries.getProperties().entrySet()) {
                Node candidateEntry = candidate.getProperties().get(entry.getKey());
                if (!matchesTypeRequirement(candidateEntry, entry.getValue(), nodeProvider)) {
                    return false;
                }
            }
            return true;
        }

        Node itemType = requirement.getProperties() != null ? requirement.getProperties().get("itemType") : null;
        if (itemType != null) {
            if (candidate.getItems() == null) {
                return false;
            }
            for (Node item : candidate.getItems()) {
                if (!matchesTypeRequirement(item, itemType, nodeProvider)) {
                    return false;
                }
            }
            return true;
        }

        return true;
    }

    private static boolean matchesNode(Node candidate, Node pattern, NodeProvider nodeProvider) {
        if (pattern == null) {
            return true;
        }
        if (candidate == null) {
            return false;
        }

        if (!matchesType(candidate, pattern, nodeProvider)) {
            return false;
        }
        if (pattern.getValue() != null) {
            if (candidate.getValue() == null) {
                return false;
            }
            if (!pattern.getValue().equals(candidate.getValue())) {
                return false;
            }
        }

        if (pattern.getProperties() != null && !pattern.getProperties().isEmpty()) {
            for (java.util.Map.Entry<String, Node> entry : pattern.getProperties().entrySet()) {
                if ("blueId".equals(entry.getKey())) {
                    String expectedBlueId = entry.getValue() != null && entry.getValue().getValue() != null
                            ? String.valueOf(entry.getValue().getValue())
                            : null;
                    if (!matchesExplicitBlueId(candidate, expectedBlueId, nodeProvider)) {
                        return false;
                    }
                    continue;
                }
                if (candidate.getProperties() == null) {
                    return false;
                }
                if (!candidate.getProperties().containsKey(entry.getKey())) {
                    return false;
                }
                if (!matchesNode(candidate.getProperties().get(entry.getKey()), entry.getValue(), nodeProvider)) {
                    return false;
                }
            }
        }

        if (pattern.getItems() != null && !pattern.getItems().isEmpty()) {
            if (candidate.getItems() == null || candidate.getItems().size() < pattern.getItems().size()) {
                return false;
            }
            for (int i = 0; i < pattern.getItems().size(); i++) {
                Node patternItem = pattern.getItems().get(i);
                if (patternItem == null) {
                    continue;
                }
                if (!matchesNode(candidate.getItems().get(i), patternItem, nodeProvider)) {
                    return false;
                }
            }
        }

        return true;
    }

    private static boolean matchesExplicitBlueId(Node candidate, String expectedBlueId, NodeProvider nodeProvider) {
        if (candidate == null || expectedBlueId == null || expectedBlueId.trim().isEmpty()) {
            return false;
        }
        String normalizedExpected = expectedBlueId.trim();
        if (candidate.getBlueId() != null && !candidate.getBlueId().trim().isEmpty()) {
            String candidateBlueId = candidate.getBlueId().trim();
            if (normalizedExpected.equals(candidateBlueId) || equivalentCoreType(normalizedExpected, candidateBlueId)) {
                return true;
            }
            if (matchesBlueIdViaProviderChain(candidateBlueId, normalizedExpected, nodeProvider)) {
                return true;
            }
        }
        if (candidate.getType() != null && candidate.getType().getBlueId() != null
                && !candidate.getType().getBlueId().trim().isEmpty()) {
            String candidateTypeBlueId = candidate.getType().getBlueId().trim();
            if (normalizedExpected.equals(candidateTypeBlueId)
                    || equivalentCoreType(normalizedExpected, candidateTypeBlueId)) {
                return true;
            }
            if (matchesBlueIdViaProviderChain(candidateTypeBlueId, normalizedExpected, nodeProvider)) {
                return true;
            }
        }
        if (candidate.getProperties() != null) {
            Node candidateBlueIdNode = candidate.getProperties().get("blueId");
            if (candidateBlueIdNode != null && candidateBlueIdNode.getValue() instanceof String) {
                String candidatePropertyBlueId = ((String) candidateBlueIdNode.getValue()).trim();
                if (normalizedExpected.equals(candidatePropertyBlueId)
                        || equivalentCoreType(normalizedExpected, candidatePropertyBlueId)
                        || matchesBlueIdViaProviderChain(candidatePropertyBlueId, normalizedExpected, nodeProvider)) {
                    return true;
                }
            }
        }
        if (candidate.getValue() instanceof String) {
            String candidateValue = ((String) candidate.getValue()).trim();
            if (normalizedExpected.equals(candidateValue)
                    || equivalentCoreType(normalizedExpected, candidateValue)
                    || matchesBlueIdViaProviderChain(candidateValue, normalizedExpected, nodeProvider)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesBlueIdViaProviderChain(String candidateBlueId,
                                                         String expectedBlueId,
                                                         NodeProvider nodeProvider) {
        if (candidateBlueId == null || candidateBlueId.trim().isEmpty() || nodeProvider == null) {
            return false;
        }
        Node seedTypeNode = new Node().blueId(candidateBlueId.trim());
        return hasTypeInChain(
                seedTypeNode,
                expectedBlueId,
                nodeProvider,
                new LinkedHashSet<String>(),
                new LinkedHashSet<String>());
    }

    private static boolean matchesType(Node candidate, Node pattern, NodeProvider nodeProvider) {
        Node expectedType = pattern.getType();
        if (expectedType == null) {
            return true;
        }
        List<String> expectedBlueIds = extractBlueIds(expectedType);
        if (expectedBlueIds.isEmpty()) {
            return true;
        }

        Node candidateType = candidate.getType();
        if (candidateType != null) {
            List<String> candidateBlueIds = extractBlueIds(candidateType);
            for (String expectedBlueId : expectedBlueIds) {
                for (String candidateBlueId : candidateBlueIds) {
                    if (expectedBlueId.equals(candidateBlueId)
                            || equivalentCoreType(expectedBlueId, candidateBlueId)) {
                        return true;
                    }
                }
            }
            for (String expectedBlueId : expectedBlueIds) {
                if (hasTypeInChain(candidateType,
                        expectedBlueId,
                        nodeProvider,
                        new LinkedHashSet<String>(),
                        new LinkedHashSet<String>())) {
                    return true;
                }
            }
        }

        String inferredCandidateType = inferCoreType(candidate);
        if (inferredCandidateType == null) {
            return false;
        }
        for (String expectedBlueId : expectedBlueIds) {
            if (expectedBlueId.equals(inferredCandidateType)
                    || equivalentCoreType(expectedBlueId, inferredCandidateType)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasTypeInChain(Node candidateType,
                                          String expectedBlueId,
                                          NodeProvider nodeProvider,
                                          Set<String> visitedBlueIds,
                                          Set<String> visitedProviderBlueIds) {
        if (candidateType == null || expectedBlueId == null || expectedBlueId.trim().isEmpty()) {
            return false;
        }
        List<String> candidateBlueIds = extractBlueIds(candidateType);
        for (String normalized : candidateBlueIds) {
            if (expectedBlueId.equals(normalized) || equivalentCoreType(expectedBlueId, normalized)) {
                return true;
            }
            if (!visitedBlueIds.add(normalized)) {
                continue;
            }
            if (nodeProvider != null && visitedProviderBlueIds.add(normalized)) {
                Node fetchedTypeDefinition = fetchTypeDefinition(nodeProvider, normalized);
                if (fetchedTypeDefinition != null
                        && hasTypeInChain(fetchedTypeDefinition,
                        expectedBlueId,
                        nodeProvider,
                        visitedBlueIds,
                        visitedProviderBlueIds)) {
                    return true;
                }
            }
        }
        return hasTypeInChain(candidateType.getType(),
                expectedBlueId,
                nodeProvider,
                visitedBlueIds,
                visitedProviderBlueIds);
    }

    private static Node fetchTypeDefinition(NodeProvider nodeProvider, String blueId) {
        if (nodeProvider == null || blueId == null || blueId.trim().isEmpty()) {
            return null;
        }
        try {
            return nodeProvider.fetchFirstByBlueId(blueId);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static List<String> extractBlueIds(Node node) {
        List<String> blueIds = new ArrayList<>();
        if (node == null) {
            return blueIds;
        }
        addBlueId(blueIds, node.getBlueId());
        if (node.getProperties() != null) {
            Node blueIdNode = node.getProperties().get("blueId");
            if (blueIdNode != null && blueIdNode.getValue() != null) {
                addBlueId(blueIds, String.valueOf(blueIdNode.getValue()));
            }
        }
        if (node.getValue() instanceof String) {
            addBlueId(blueIds, String.valueOf(node.getValue()));
        }
        return blueIds;
    }

    private static void addBlueId(List<String> blueIds, String candidate) {
        if (candidate == null) {
            return;
        }
        String normalized = candidate.trim();
        if (normalized.isEmpty() || blueIds.contains(normalized)) {
            return;
        }
        blueIds.add(normalized);
    }

    private static boolean equivalentCoreType(String left, String right) {
        String normalizedLeft = normalizeCoreType(left);
        String normalizedRight = normalizeCoreType(right);
        return normalizedLeft != null && normalizedLeft.equals(normalizedRight);
    }

    private static String normalizeCoreType(String typeId) {
        if (typeId == null) {
            return null;
        }
        if (Properties.INTEGER_TYPE.equals(typeId) || Properties.INTEGER_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.INTEGER_TYPE;
        }
        if (Properties.DOUBLE_TYPE.equals(typeId) || Properties.DOUBLE_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.DOUBLE_TYPE;
        }
        if (Properties.BOOLEAN_TYPE.equals(typeId) || Properties.BOOLEAN_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.BOOLEAN_TYPE;
        }
        if (Properties.TEXT_TYPE.equals(typeId) || Properties.TEXT_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.TEXT_TYPE;
        }
        if (Properties.LIST_TYPE.equals(typeId) || Properties.LIST_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.LIST_TYPE;
        }
        if (Properties.DICTIONARY_TYPE.equals(typeId) || Properties.DICTIONARY_TYPE_BLUE_ID.equals(typeId)) {
            return Properties.DICTIONARY_TYPE;
        }
        return null;
    }

    private static String inferCoreType(Node candidate) {
        if (candidate == null) {
            return null;
        }
        if (candidate.getItems() != null) {
            return Properties.LIST_TYPE;
        }
        if (candidate.getProperties() != null && !candidate.getProperties().isEmpty()) {
            return Properties.DICTIONARY_TYPE;
        }
        Object value = candidate.getValue();
        if (value instanceof String) {
            return Properties.TEXT_TYPE;
        }
        if (value instanceof Boolean) {
            return Properties.BOOLEAN_TYPE;
        }
        if (value instanceof BigInteger
                || value instanceof Integer
                || value instanceof Long
                || value instanceof Short
                || value instanceof Byte) {
            return Properties.INTEGER_TYPE;
        }
        if (value instanceof BigDecimal
                || value instanceof Double
                || value instanceof Float) {
            return Properties.DOUBLE_TYPE;
        }
        return null;
    }
}
