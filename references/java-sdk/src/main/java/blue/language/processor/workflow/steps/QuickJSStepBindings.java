package blue.language.processor.workflow.steps;

import blue.language.blueid.BlueIdCalculator;
import blue.language.model.Node;
import blue.language.processor.workflow.StepExecutionArgs;
import blue.language.processor.util.ProcessorPointerConstants;
import blue.language.utils.NodeToMapListOrValue;
import blue.language.utils.NodeToMapListOrValue.Strategy;
import blue.language.utils.UncheckedObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class QuickJSStepBindings {

    private QuickJSStepBindings() {
    }

    static Map<String, Object> create(StepExecutionArgs args) {
        Map<String, Object> bindings = new LinkedHashMap<>();
        Object eventSimple = NodeToMapListOrValue.get(args.eventNode(), Strategy.SIMPLE);
        Object eventCanonical = NodeToMapListOrValue.get(args.eventNode(), Strategy.OFFICIAL);
        bindings.put("event", eventSimple);
        bindings.put("eventCanonical", eventCanonical);
        bindings.put("steps", args.stepResults());
        Node documentSnapshot = args.context().documentAt("/");
        args.context().chargeDocumentSnapshot("/", documentSnapshot);
        Object documentSimple = documentSnapshot != null
                ? NodeToMapListOrValue.get(documentSnapshot, Strategy.SIMPLE)
                : null;
        Object documentCanonical = documentSnapshot != null
                ? NodeToMapListOrValue.get(documentSnapshot, Strategy.OFFICIAL)
                : null;
        if (documentSnapshot != null) {
            decorateComputedBlueIds(documentSnapshot, documentSimple);
            decorateComputedBlueIds(documentSnapshot, documentCanonical);
        }
        bindings.put("__documentDataSimple", documentSimple);
        bindings.put("__documentDataCanonical", documentCanonical);
        bindings.put("__scopePath", args.context().resolvePointer("/"));
        Node contractSnapshot = resolveContractSnapshot(args);
        if (contractSnapshot != null) {
            Object currentContract = NodeToMapListOrValue.get(contractSnapshot, Strategy.SIMPLE);
            Object currentContractCanonical = NodeToMapListOrValue.get(contractSnapshot, Strategy.OFFICIAL);
            ensureDerivedChannelPresent(currentContract, currentContractCanonical, args.workflow());
            bindings.put("currentContract", currentContract);
            bindings.put("currentContractCanonical", currentContractCanonical);
        } else {
            Map<?, ?> currentContract = UncheckedObjectMapper.JSON_MAPPER.convertValue(args.workflow(), Map.class);
            bindings.put("currentContract", currentContract);
            bindings.put("currentContractCanonical", currentContract);
        }
        return bindings;
    }

    private static Node resolveContractSnapshot(StepExecutionArgs args) {
        if (args.contractNode() != null) {
            return args.contractNode().clone();
        }
        String workflowKey = args.workflow() != null ? args.workflow().getKey() : null;
        if (workflowKey == null || workflowKey.trim().isEmpty()) {
            return null;
        }
        String contractPointer = args.context().resolvePointer(
                ProcessorPointerConstants.relativeContractsEntry(workflowKey.trim()));
        return args.context().documentAt(contractPointer);
    }

    @SuppressWarnings("unchecked")
    private static void ensureDerivedChannelPresent(Object currentContract,
                                                    Object currentContractCanonical,
                                                    blue.language.processor.model.HandlerContract workflow) {
        if (workflow == null || workflow.getChannel() == null || workflow.getChannel().trim().isEmpty()) {
            return;
        }
        String derivedChannel = workflow.getChannel().trim();
        if (currentContract instanceof Map) {
            Map<String, Object> simpleMap = (Map<String, Object>) currentContract;
            Object currentValue = simpleMap.get("channel");
            if (currentValue == null || String.valueOf(currentValue).trim().isEmpty()) {
                simpleMap.put("channel", derivedChannel);
            }
        }
        if (currentContractCanonical instanceof Map) {
            Map<String, Object> canonicalMap = (Map<String, Object>) currentContractCanonical;
            Object currentValue = canonicalMap.get("channel");
            if (currentValue == null) {
                Map<String, Object> wrapped = new LinkedHashMap<>();
                wrapped.put("value", derivedChannel);
                canonicalMap.put("channel", wrapped);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static void decorateComputedBlueIds(Node node, Object mapped) {
        if (node == null || mapped == null) {
            return;
        }
        if (mapped instanceof Map) {
            Map<String, Object> map = (Map<String, Object>) mapped;
            if (!map.containsKey("blueId")) {
                map.put("blueId", BlueIdCalculator.calculateSemanticBlueId(node));
            }
            if (node.getProperties() != null) {
                for (Map.Entry<String, Node> entry : node.getProperties().entrySet()) {
                    decorateComputedBlueIds(entry.getValue(), map.get(entry.getKey()));
                }
            }
            if (node.getItems() != null && map.get("items") instanceof List) {
                List<Object> items = (List<Object>) map.get("items");
                for (int i = 0; i < node.getItems().size() && i < items.size(); i++) {
                    decorateComputedBlueIds(node.getItems().get(i), items.get(i));
                }
            }
            return;
        }
        if (mapped instanceof List && node.getItems() != null) {
            List<Object> items = (List<Object>) mapped;
            for (int i = 0; i < node.getItems().size() && i < items.size(); i++) {
                decorateComputedBlueIds(node.getItems().get(i), items.get(i));
            }
        }
    }
}
