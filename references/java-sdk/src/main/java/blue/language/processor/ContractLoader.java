package blue.language.processor;

import blue.language.mapping.NodeToObjectConverter;
import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.model.CompositeTimelineChannel;
import blue.language.processor.model.Contract;
import blue.language.processor.model.DocumentAnchorsMarker;
import blue.language.processor.model.DocumentUpdateChannel;
import blue.language.processor.model.DocumentLinksMarker;
import blue.language.processor.model.EmbeddedNodeChannel;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.model.InitializationMarker;
import blue.language.processor.model.LifecycleChannel;
import blue.language.processor.model.MarkerContract;
import blue.language.processor.model.MyOSParticipantsOrchestrationMarker;
import blue.language.processor.model.MyOSSessionInteractionMarker;
import blue.language.processor.model.MyOSWorkerAgencyMarker;
import blue.language.processor.model.ProcessEmbedded;
import blue.language.processor.model.ProcessingTerminatedMarker;
import blue.language.processor.model.TriggeredEventChannel;
import blue.language.processor.util.ProcessorContractConstants;
import blue.language.processor.util.PointerUtils;

import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses contracts under a scope and produces a {@link ContractBundle}.
 */
final class ContractLoader {

    private static final Set<String> BUILTIN_CONTRACT_BLUE_IDS = createBuiltInContractBlueIds();

    private final ContractProcessorRegistry registry;
    private final NodeToObjectConverter converter;

    ContractLoader(ContractProcessorRegistry registry, NodeToObjectConverter converter) {
        this.registry = Objects.requireNonNull(registry, "registry");
        this.converter = Objects.requireNonNull(converter, "converter");
    }

    ContractBundle load(Node scopeNode, String scopePath) {
        ContractBundle.Builder builder = ContractBundle.builder();
        Map<String, Node> properties = scopeNode.getProperties();
        if (properties == null) {
            return builder.build();
        }
        Node contractsNode = properties.get("contracts");
        if (contractsNode == null || contractsNode.getProperties() == null) {
            return builder.build();
        }

        Set<String> normalizedKeys = new LinkedHashSet<>();
        Map<String, Contract> contractsByKey = new LinkedHashMap<>();
        for (Map.Entry<String, Node> entry : contractsNode.getProperties().entrySet()) {
            String key = normalizeContractKey(entry.getKey(), scopePath);
            if (!normalizedKeys.add(key)) {
                throw new IllegalStateException(
                        "Duplicate normalized contract key '" + key + "' at scope " + scopePath);
            }
            Node contractNode = entry.getValue();
            Contract contract;
            try {
                contract = converter.convertWithType(contractNode, Contract.class, false);
            } catch (RuntimeException ex) {
                String blueId = contractBlueId(contractNode);
                if (isUnsupportedContractNode(contractNode)) {
                    throw new MustUnderstandFailureException("Unsupported contract type: " + blueId);
                }
                throw ex;
            }
            if (contract == null) {
                continue;
            }
            contract.setKey(key);
            normalizePointerBackedContracts(contract, key, scopePath);
            contractsByKey.put(key, contract);
        }

        for (Map.Entry<String, Contract> entry : contractsByKey.entrySet()) {
            String key = entry.getKey();
            Contract contract = entry.getValue();
            if (contract instanceof ChannelContract) {
                ChannelContract channel = (ChannelContract) contract;
                if (!ProcessorContractConstants.isProcessorManagedChannel(channel)
                        && !registry.lookupChannel(channel).isPresent()) {
                    throw new MustUnderstandFailureException(
                            "Unsupported contract type: " + channel.getClass().getName());
                }
                builder.addChannel(key, channel);
            } else if (contract instanceof ProcessEmbedded) {
                builder.setEmbedded((ProcessEmbedded) contract);
            } else if (contract instanceof MarkerContract) {
                builder.addMarker(key, (MarkerContract) contract);
            }
        }

        ContractBundle scopeContracts = builder.build();
        for (Map.Entry<String, Contract> entry : contractsByKey.entrySet()) {
            String key = entry.getKey();
            Contract contract = entry.getValue();
            if (!(contract instanceof HandlerContract)) {
                continue;
            }
            HandlerContract handler = (HandlerContract) contract;
            @SuppressWarnings("unchecked")
            HandlerProcessor<HandlerContract> handlerProcessor =
                    (HandlerProcessor<HandlerContract>) registry.lookupHandler(handler).orElse(null);
            if (handlerProcessor == null) {
                throw new MustUnderstandFailureException(
                        "Unsupported contract type: " + handler.getClass().getName());
            }
            String channelKey = handler.getChannelKey();
            if (channelKey == null || channelKey.trim().isEmpty()) {
                channelKey = handlerProcessor.deriveChannel(handler, scopeContracts);
            }
            if (channelKey == null || channelKey.trim().isEmpty()) {
                throw new IllegalStateException("Handler " + key + " must declare channel (or derive one)");
            }
            handler.setChannelKey(channelKey.trim());
            builder.addHandler(key, handler);
        }

        ContractBundle bundle = builder.build();
        validateCompositeTimelineChannels(bundle, scopePath);
        return bundle;
    }

    private String normalizeContractKey(String key, String scopePath) {
        if (key == null || key.trim().isEmpty()) {
            throw new IllegalStateException("Contract key must not be blank at scope " + scopePath);
        }
        return key.trim();
    }

    private boolean isUnsupportedContractNode(Node contractNode) {
        if (contractNode == null || contractNode.getType() == null) {
            return false;
        }
        if (registry.lookupHandler(contractNode).isPresent()
                || registry.lookupChannel(contractNode).isPresent()
                || registry.lookupMarker(contractNode).isPresent()) {
            return false;
        }
        for (String blueId : contractBlueIdChain(contractNode.getType())) {
            if (BUILTIN_CONTRACT_BLUE_IDS.contains(blueId)) {
                return false;
            }
        }
        return true;
    }

    private String contractBlueId(Node contractNode) {
        List<String> chain = contractBlueIdChain(contractNode != null ? contractNode.getType() : null);
        if (chain.isEmpty()) {
            return null;
        }
        return chain.get(0);
    }

    private void normalizePointerBackedContracts(Contract contract, String key, String scopePath) {
        if (contract instanceof DocumentUpdateChannel) {
            DocumentUpdateChannel channel = (DocumentUpdateChannel) contract;
            channel.setPath(normalizeContractPointer(channel.getPath(),
                    "DocumentUpdateChannel",
                    key,
                    scopePath,
                    "path",
                    true));
            return;
        }
        if (contract instanceof EmbeddedNodeChannel) {
            EmbeddedNodeChannel channel = (EmbeddedNodeChannel) contract;
            channel.setChildPath(normalizeContractPointer(channel.getChildPath(),
                    "EmbeddedNodeChannel",
                    key,
                    scopePath,
                    "childPath",
                    true));
        }
    }

    private String normalizeContractPointer(String pointer,
                                            String contractType,
                                            String key,
                                            String scopePath,
                                            String fieldName,
                                            boolean required) {
        if (pointer == null) {
            if (required) {
                throw new IllegalStateException(contractType + " '" + key + "' at scope " + scopePath
                        + " is missing required " + fieldName);
            }
            return pointer;
        }
        String trimmed = pointer.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalStateException(contractType + " '" + key + "' at scope " + scopePath
                    + " has blank " + fieldName);
        }
        try {
            return PointerUtils.normalizeRequiredPointer(trimmed, fieldName);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException(contractType + " '" + key + "' at scope " + scopePath
                    + " has invalid " + fieldName + ": " + pointer, ex);
        }
    }

    private void validateCompositeTimelineChannels(ContractBundle bundle, String scopePath) {
        Map<String, CompositeTimelineChannel> compositeChannels = new LinkedHashMap<>();
        for (ContractBundle.ChannelBinding binding : bundle.channelsOfType(CompositeTimelineChannel.class)) {
            compositeChannels.put(binding.key(), (CompositeTimelineChannel) binding.contract());
        }
        if (compositeChannels.isEmpty()) {
            return;
        }

        for (Map.Entry<String, CompositeTimelineChannel> entry : compositeChannels.entrySet()) {
            for (String childKey : entry.getValue().getChannels()) {
                if (bundle.channel(childKey) == null) {
                    throw new IllegalStateException("Composite channel '" + entry.getKey()
                            + "' references missing channel '" + childKey + "' at scope " + scopePath);
                }
            }
        }

        Map<String, Integer> visitState = new HashMap<>();
        for (String key : compositeChannels.keySet()) {
            detectCompositeCycle(key, compositeChannels, visitState);
        }
    }

    private void detectCompositeCycle(String key,
                                      Map<String, CompositeTimelineChannel> composites,
                                      Map<String, Integer> visitState) {
        Integer currentState = visitState.get(key);
        if (currentState != null) {
            if (currentState == 1) {
                throw new IllegalStateException("Cyclic composite timeline channel dependency detected at '" + key + "'");
            }
            if (currentState == 2) {
                return;
            }
        }
        visitState.put(key, 1);
        CompositeTimelineChannel composite = composites.get(key);
        if (composite != null) {
            for (String child : composite.getChannels()) {
                if (composites.containsKey(child)) {
                    detectCompositeCycle(child, composites, visitState);
                }
            }
        }
        visitState.put(key, 2);
    }

    private static Set<String> createBuiltInContractBlueIds() {
        Set<String> ids = new LinkedHashSet<>();
        addTypeBlueIds(ids, DocumentUpdateChannel.class);
        addTypeBlueIds(ids, EmbeddedNodeChannel.class);
        addTypeBlueIds(ids, LifecycleChannel.class);
        addTypeBlueIds(ids, TriggeredEventChannel.class);
        addTypeBlueIds(ids, ProcessEmbedded.class);
        addTypeBlueIds(ids, InitializationMarker.class);
        addTypeBlueIds(ids, ProcessingTerminatedMarker.class);
        addTypeBlueIds(ids, ChannelEventCheckpoint.class);
        addTypeBlueIds(ids, DocumentAnchorsMarker.class);
        addTypeBlueIds(ids, DocumentLinksMarker.class);
        addTypeBlueIds(ids, MyOSParticipantsOrchestrationMarker.class);
        addTypeBlueIds(ids, MyOSSessionInteractionMarker.class);
        addTypeBlueIds(ids, MyOSWorkerAgencyMarker.class);
        return Collections.unmodifiableSet(ids);
    }

    private static void addTypeBlueIds(Set<String> ids, Class<?> contractClass) {
        TypeBlueId annotation = contractClass.getAnnotation(TypeBlueId.class);
        if (annotation == null) {
            return;
        }
        String[] declared = annotation.value();
        if (declared != null) {
            for (String blueId : declared) {
                if (blueId != null && !blueId.trim().isEmpty()) {
                    ids.add(blueId.trim());
                }
            }
        }
        String defaultValue = annotation.defaultValue();
        if (defaultValue != null && !defaultValue.trim().isEmpty()) {
            ids.add(defaultValue.trim());
        }
    }

    private List<String> contractBlueIdChain(Node typeNode) {
        List<String> blueIds = new ArrayList<>();
        if (typeNode == null) {
            return blueIds;
        }
        Set<Node> visited = Collections.newSetFromMap(new IdentityHashMap<Node, Boolean>());
        Node current = typeNode;
        while (current != null && visited.add(current)) {
            addBlueId(blueIds, current.getBlueId());
            if (current.getProperties() != null) {
                Node blueIdNode = current.getProperties().get("blueId");
                if (blueIdNode != null && blueIdNode.getValue() != null) {
                    addBlueId(blueIds, String.valueOf(blueIdNode.getValue()));
                }
            }
            current = current.getType();
        }
        return blueIds;
    }

    private void addBlueId(List<String> blueIds, String candidate) {
        if (candidate == null) {
            return;
        }
        String normalized = candidate.trim();
        if (normalized.isEmpty() || blueIds.contains(normalized)) {
            return;
        }
        blueIds.add(normalized);
    }
}
