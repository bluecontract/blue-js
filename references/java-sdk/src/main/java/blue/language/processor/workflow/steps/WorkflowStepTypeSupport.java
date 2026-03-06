package blue.language.processor.workflow.steps;

import blue.language.NodeProvider;
import blue.language.model.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class WorkflowStepTypeSupport {

    private WorkflowStepTypeSupport() {
    }

    static boolean isSupportedStepType(Node stepNode, Set<String> supportedBlueIds, NodeProvider nodeProvider) {
        if (stepNode == null || stepNode.getType() == null || supportedBlueIds == null || supportedBlueIds.isEmpty()) {
            return false;
        }
        Set<String> visitedBlueIds = new LinkedHashSet<>();
        return hasSupportedType(stepNode.getType(), supportedBlueIds, nodeProvider, visitedBlueIds);
    }

    private static boolean hasSupportedType(Node typeNode,
                                            Set<String> supportedBlueIds,
                                            NodeProvider nodeProvider,
                                            Set<String> visitedBlueIds) {
        if (typeNode == null) {
            return false;
        }
        boolean foundUnvisitedBlueId = false;
        for (String blueId : extractBlueIds(typeNode)) {
            if (supportedBlueIds.contains(blueId)) {
                return true;
            }
            boolean newlyVisited = visitedBlueIds.add(blueId);
            if (newlyVisited) {
                foundUnvisitedBlueId = true;
                if (nodeProvider != null) {
                    Node definition = fetchTypeDefinition(nodeProvider, blueId);
                    if (definition != null && hasSupportedType(definition, supportedBlueIds, nodeProvider, visitedBlueIds)) {
                        return true;
                    }
                }
            }
        }
        Node parentType = typeNode.getType();
        if (parentType == null) {
            return false;
        }
        if (!foundUnvisitedBlueId) {
            List<String> parentBlueIds = extractBlueIds(parentType);
            boolean parentHasUnvisitedBlueId = false;
            for (String blueId : parentBlueIds) {
                if (!visitedBlueIds.contains(blueId)) {
                    parentHasUnvisitedBlueId = true;
                    break;
                }
            }
            if (!parentHasUnvisitedBlueId && parentBlueIds.isEmpty()) {
                return false;
            }
        }
        return hasSupportedType(parentType, supportedBlueIds, nodeProvider, visitedBlueIds);
    }

    private static Node fetchTypeDefinition(NodeProvider nodeProvider, String blueId) {
        if (nodeProvider == null || blueId == null || blueId.trim().isEmpty()) {
            return null;
        }
        try {
            return nodeProvider.fetchFirstByBlueId(blueId.trim());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static List<String> extractBlueIds(Node typeNode) {
        if (typeNode == null) {
            return Collections.emptyList();
        }
        List<String> blueIds = new ArrayList<>();
        addBlueId(blueIds, typeNode.getBlueId());
        if (typeNode.getValue() instanceof String) {
            addBlueId(blueIds, String.valueOf(typeNode.getValue()));
        }
        if (typeNode.getProperties() != null && typeNode.getProperties().get("blueId") != null) {
            Node blueIdNode = typeNode.getProperties().get("blueId");
            if (blueIdNode != null && blueIdNode.getValue() != null) {
                addBlueId(blueIds, String.valueOf(blueIdNode.getValue()));
            }
        }
        return blueIds;
    }

    private static void addBlueId(List<String> blueIds, String blueId) {
        if (blueId == null) {
            return;
        }
        String normalized = blueId.trim();
        if (normalized.isEmpty() || blueIds.contains(normalized)) {
            return;
        }
        blueIds.add(normalized);
    }
}
