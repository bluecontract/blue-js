package blue.language.transport;

import blue.language.Blue;
import blue.language.blueid.BlueIdCalculator;
import blue.language.model.Node;
import blue.language.utils.NodeToMapListOrValue;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class BundleBuilder {

    public Map<String, Object> forCanonical(Blue blue, Node canonicalRoot) {
        Objects.requireNonNull(blue, "blue");
        Objects.requireNonNull(canonicalRoot, "canonicalRoot");

        Set<String> pendingReferences = new LinkedHashSet<String>();
        collectReferences(canonicalRoot, pendingReferences);
        Set<String> visitedReferences = new LinkedHashSet<String>();

        Map<String, Object> bundle = new LinkedHashMap<String, Object>();
        while (!pendingReferences.isEmpty()) {
            Iterator<String> iterator = pendingReferences.iterator();
            String blueId = iterator.next();
            iterator.remove();
            if (visitedReferences.contains(blueId)) {
                continue;
            }
            visitedReferences.add(blueId);

            List<Node> referencedNodes = blue.getNodeProvider().fetchByBlueId(blueId);
            if (referencedNodes == null || referencedNodes.isEmpty()) {
                continue;
            }

            if (referencedNodes.size() == 1) {
                bundle.put(blueId, NodeToMapListOrValue.get(referencedNodes.get(0)));
            } else {
                List<Object> serializedList = referencedNodes.stream()
                        .map(NodeToMapListOrValue::get)
                        .collect(Collectors.toList());
                bundle.put(blueId, serializedList);
            }

            Set<String> discoveredReferences = new LinkedHashSet<String>();
            for (Node referencedNode : referencedNodes) {
                collectReferences(referencedNode, discoveredReferences);
            }
            for (String discovered : discoveredReferences) {
                if (!visitedReferences.contains(discovered)) {
                    pendingReferences.add(discovered);
                }
            }
        }
        return bundle;
    }

    private void collectReferences(Node node, Set<String> references) {
        if (node == null) {
            return;
        }

        if (BlueIdCalculator.isPureReferenceNode(node)) {
            references.add(node.getBlueId());
            return;
        }

        collectReferences(node.getType(), references);
        collectReferences(node.getItemType(), references);
        collectReferences(node.getKeyType(), references);
        collectReferences(node.getValueType(), references);
        collectReferences(node.getBlue(), references);

        if (node.getItems() != null) {
            for (Node item : new ArrayList<Node>(node.getItems())) {
                collectReferences(item, references);
            }
        }

        if (node.getProperties() != null) {
            for (Node property : node.getProperties().values()) {
                collectReferences(property, references);
            }
        }
    }
}
