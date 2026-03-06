package blue.language.processor;

import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.Contract;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.model.MarkerContract;
import blue.language.utils.TypeClassResolver;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.ArrayList;
import java.util.IdentityHashMap;

/**
 * Maintains the mapping between contract BlueIds and their processors.
 */
public class ContractProcessorRegistry {

    private final Map<String, ContractProcessor<? extends Contract>> processorsByBlueId = new LinkedHashMap<>();
    private final Map<Class<? extends HandlerContract>, HandlerProcessor<? extends HandlerContract>> handlerProcessors = new LinkedHashMap<>();
    private final Map<Class<? extends ChannelContract>, ChannelProcessor<? extends ChannelContract>> channelProcessors = new LinkedHashMap<>();
    private final Map<Class<? extends MarkerContract>, ContractProcessor<? extends MarkerContract>> markerProcessors = new LinkedHashMap<>();
    private final Map<String, HandlerProcessor<? extends HandlerContract>> handlerProcessorsByBlueId = new LinkedHashMap<>();
    private final Map<String, ChannelProcessor<? extends ChannelContract>> channelProcessorsByBlueId = new LinkedHashMap<>();
    private final Map<String, ContractProcessor<? extends MarkerContract>> markerProcessorsByBlueId = new LinkedHashMap<>();
    private NodeProvider nodeProvider;
    private TypeClassResolver typeClassResolver;

    public ContractProcessorRegistry() {
        this(null, null);
    }

    public ContractProcessorRegistry(NodeProvider nodeProvider) {
        this(nodeProvider, null);
    }

    public ContractProcessorRegistry(NodeProvider nodeProvider, TypeClassResolver typeClassResolver) {
        this.nodeProvider = nodeProvider;
        this.typeClassResolver = typeClassResolver;
    }

    public ContractProcessorRegistry nodeProvider(NodeProvider nodeProvider) {
        this.nodeProvider = nodeProvider;
        return this;
    }

    public ContractProcessorRegistry typeClassResolver(TypeClassResolver typeClassResolver) {
        this.typeClassResolver = typeClassResolver;
        return this;
    }

    public NodeProvider nodeProvider() {
        return nodeProvider;
    }

    public <T extends HandlerContract> void registerHandler(HandlerProcessor<T> processor) {
        Objects.requireNonNull(processor, "processor");
        Set<String> blueIds = registerBlueIds(processor.contractType(), processor);
        for (String blueId : blueIds) {
            handlerProcessorsByBlueId.put(blueId, processor);
        }
        handlerProcessors.put(processor.contractType(), processor);
    }

    public <T extends ChannelContract> void registerChannel(ChannelProcessor<T> processor) {
        Objects.requireNonNull(processor, "processor");
        Set<String> blueIds = registerBlueIds(processor.contractType(), processor);
        for (String blueId : blueIds) {
            channelProcessorsByBlueId.put(blueId, processor);
        }
        channelProcessors.put(processor.contractType(), processor);
    }

    public <T extends MarkerContract> void registerMarker(ContractProcessor<T> processor) {
        Objects.requireNonNull(processor, "processor");
        Set<String> blueIds = registerBlueIds(processor.contractType(), processor);
        for (String blueId : blueIds) {
            markerProcessorsByBlueId.put(blueId, processor);
        }
        markerProcessors.put(processor.contractType(), processor);
    }

    public void register(ContractProcessor<? extends Contract> processor) {
        Objects.requireNonNull(processor, "processor");
        if (processor instanceof HandlerProcessor) {
            @SuppressWarnings("unchecked")
            HandlerProcessor<? extends HandlerContract> handler = (HandlerProcessor<? extends HandlerContract>) processor;
            registerHandler(handler);
        } else if (processor instanceof ChannelProcessor) {
            @SuppressWarnings("unchecked")
            ChannelProcessor<? extends ChannelContract> channel = (ChannelProcessor<? extends ChannelContract>) processor;
            registerChannel(channel);
        } else if (processor.contractType() != null && MarkerContract.class.isAssignableFrom(processor.contractType())) {
            @SuppressWarnings("unchecked")
            ContractProcessor<? extends MarkerContract> marker = (ContractProcessor<? extends MarkerContract>) processor;
            registerMarker(marker);
        } else {
            throw new IllegalArgumentException("Unsupported processor type: " + processor.getClass().getName());
        }
    }

    public Optional<HandlerProcessor<? extends HandlerContract>> lookupHandler(Class<? extends HandlerContract> type) {
        return lookupProcessor(type, handlerProcessors, handlerProcessorsByBlueId);
    }

    public Optional<HandlerProcessor<? extends HandlerContract>> lookupHandler(HandlerContract contract) {
        if (contract == null) {
            return Optional.empty();
        }
        return lookupHandler(contract.getClass());
    }

    public Optional<HandlerProcessor<? extends HandlerContract>> lookupHandler(Node contractNode) {
        Optional<HandlerProcessor<? extends HandlerContract>> byTypeChain =
                lookupByTypeChain(contractNode, handlerProcessorsByBlueId, nodeProvider);
        if (byTypeChain.isPresent()) {
            return byTypeChain;
        }
        return lookupByResolvedClass(contractNode, HandlerContract.class, handlerProcessors);
    }

    public Optional<HandlerProcessor<? extends HandlerContract>> lookupHandler(String blueId) {
        return lookupByBlueId(blueId, handlerProcessorsByBlueId, nodeProvider);
    }

    public Optional<ChannelProcessor<? extends ChannelContract>> lookupChannel(Class<? extends ChannelContract> type) {
        return lookupProcessor(type, channelProcessors, channelProcessorsByBlueId);
    }

    public Optional<ChannelProcessor<? extends ChannelContract>> lookupChannel(ChannelContract contract) {
        if (contract == null) {
            return Optional.empty();
        }
        return lookupChannel(contract.getClass());
    }

    public Optional<ChannelProcessor<? extends ChannelContract>> lookupChannel(Node contractNode) {
        Optional<ChannelProcessor<? extends ChannelContract>> byTypeChain =
                lookupByTypeChain(contractNode, channelProcessorsByBlueId, nodeProvider);
        if (byTypeChain.isPresent()) {
            return byTypeChain;
        }
        return lookupByResolvedClass(contractNode, ChannelContract.class, channelProcessors);
    }

    public Optional<ChannelProcessor<? extends ChannelContract>> lookupChannel(String blueId) {
        return lookupByBlueId(blueId, channelProcessorsByBlueId, nodeProvider);
    }

    public Optional<ContractProcessor<? extends MarkerContract>> lookupMarker(Class<? extends MarkerContract> type) {
        return lookupProcessor(type, markerProcessors, markerProcessorsByBlueId);
    }

    public Optional<ContractProcessor<? extends MarkerContract>> lookupMarker(MarkerContract contract) {
        if (contract == null) {
            return Optional.empty();
        }
        return lookupMarker(contract.getClass());
    }

    public Optional<ContractProcessor<? extends MarkerContract>> lookupMarker(Node contractNode) {
        Optional<ContractProcessor<? extends MarkerContract>> byTypeChain =
                lookupByTypeChain(contractNode, markerProcessorsByBlueId, nodeProvider);
        if (byTypeChain.isPresent()) {
            return byTypeChain;
        }
        return lookupByResolvedClass(contractNode, MarkerContract.class, markerProcessors);
    }

    public Optional<ContractProcessor<? extends MarkerContract>> lookupMarker(String blueId) {
        return lookupByBlueId(blueId, markerProcessorsByBlueId, nodeProvider);
    }

    public Map<String, ContractProcessor<? extends Contract>> processors() {
        return new LinkedHashMap<>(processorsByBlueId);
    }

    private <T extends Contract> Set<String> registerBlueIds(Class<T> contractType, ContractProcessor<T> processor) {
        Objects.requireNonNull(contractType, "contractType");

        TypeBlueId typeBlueId = contractType.getAnnotation(TypeBlueId.class);
        if (typeBlueId == null) {
            throw new IllegalArgumentException("Contract type lacks @TypeBlueId: " + contractType.getName());
        }

        String[] declared = typeBlueId.value();
        if (declared.length == 0 && !typeBlueId.defaultValue().isEmpty()) {
            declared = new String[]{typeBlueId.defaultValue()};
        }
        if (declared.length == 0) {
            throw new IllegalArgumentException("Contract type " + contractType.getName() + " does not declare any BlueId values");
        }

        Set<String> registered = new LinkedHashSet<>();
        for (String blueId : declared) {
            if (blueId == null || blueId.trim().isEmpty()) {
                throw new IllegalArgumentException("Contract processor BlueIds must be non-empty strings for "
                        + contractType.getName());
            }
            String normalized = blueId.trim();
            processorsByBlueId.put(normalized, processor);
            registered.add(normalized);
        }
        return registered;
    }

    private static <T extends Contract, P extends ContractProcessor<? extends T>> Optional<P> lookupProcessor(
            Class<? extends T> contractType,
            Map<Class<? extends T>, P> byClass,
            Map<String, P> byBlueId) {
        if (contractType == null) {
            return Optional.empty();
        }
        P direct = byClass.get(contractType);
        if (direct != null) {
            return Optional.of(direct);
        }
        for (String blueId : resolveBlueIds(contractType)) {
            P byId = byBlueId.get(blueId);
            if (byId != null) {
                return Optional.of(byId);
            }
        }
        Class<? extends T> bestType = null;
        P bestProcessor = null;
        int bestDistance = Integer.MAX_VALUE;
        for (Map.Entry<Class<? extends T>, P> entry : byClass.entrySet()) {
            Class<? extends T> candidateType = entry.getKey();
            int distance = inheritanceDistance(contractType, candidateType);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestType = candidateType;
                bestProcessor = entry.getValue();
            }
        }
        if (bestType != null) {
            return Optional.of(bestProcessor);
        }
        return Optional.empty();
    }

    private static List<String> resolveBlueIds(Class<?> contractType) {
        TypeBlueId typeBlueId = contractType.getAnnotation(TypeBlueId.class);
        if (typeBlueId == null) {
            return Collections.emptyList();
        }
        String[] declared = typeBlueId.value();
        if (declared.length == 0 && !typeBlueId.defaultValue().isEmpty()) {
            declared = new String[]{typeBlueId.defaultValue()};
        }
        if (declared.length == 0) {
            return Collections.emptyList();
        }
        return java.util.Arrays.asList(declared);
    }

    private static int inheritanceDistance(Class<?> concreteType, Class<?> targetSuperType) {
        if (concreteType == null || targetSuperType == null || !targetSuperType.isAssignableFrom(concreteType)) {
            return Integer.MAX_VALUE;
        }
        if (concreteType.equals(targetSuperType)) {
            return 0;
        }
        Set<Class<?>> visited = new LinkedHashSet<>();
        java.util.ArrayDeque<Class<?>> queue = new java.util.ArrayDeque<>();
        java.util.ArrayDeque<Integer> depths = new java.util.ArrayDeque<>();
        queue.add(concreteType);
        depths.add(0);
        while (!queue.isEmpty()) {
            Class<?> next = queue.removeFirst();
            int depth = depths.removeFirst();
            if (!visited.add(next)) {
                continue;
            }
            if (next.equals(targetSuperType)) {
                return depth;
            }
            Class<?> superClass = next.getSuperclass();
            if (superClass != null) {
                queue.addLast(superClass);
                depths.addLast(depth + 1);
            }
            Class<?>[] interfaces = next.getInterfaces();
            for (Class<?> iface : interfaces) {
                queue.addLast(iface);
                depths.addLast(depth + 1);
            }
        }
        return Integer.MAX_VALUE;
    }

    private static <P> Optional<P> lookupByTypeChain(Node contractNode,
                                                     Map<String, P> processorsByBlueId,
                                                     NodeProvider nodeProvider) {
        if (contractNode == null || processorsByBlueId == null || processorsByBlueId.isEmpty()) {
            return Optional.empty();
        }
        for (String blueId : resolveTypeChainBlueIds(contractNode, nodeProvider)) {
            P processor = processorsByBlueId.get(blueId);
            if (processor != null) {
                return Optional.of(processor);
            }
        }
        return Optional.empty();
    }

    private static <P> Optional<P> lookupByBlueId(String blueId,
                                                  Map<String, P> processorsByBlueId,
                                                  NodeProvider nodeProvider) {
        if (blueId == null || processorsByBlueId == null || processorsByBlueId.isEmpty()) {
            return Optional.empty();
        }
        String normalized = blueId.trim();
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        P direct = processorsByBlueId.get(normalized);
        if (direct != null) {
            return Optional.of(direct);
        }
        Node seed = new Node().blueId(normalized);
        for (String derivedBlueId : resolveTypeChainBlueIds(seed, nodeProvider)) {
            P providerDerived = processorsByBlueId.get(derivedBlueId);
            if (providerDerived != null) {
                return Optional.of(providerDerived);
            }
        }
        return Optional.empty();
    }

    private static List<String> resolveTypeChainBlueIds(Node contractNode, NodeProvider nodeProvider) {
        List<String> blueIds = new ArrayList<>();
        if (contractNode == null) {
            return blueIds;
        }
        Set<Node> visitedNodes = Collections.newSetFromMap(new IdentityHashMap<Node, Boolean>());
        Set<String> visitedProviderBlueIds = new LinkedHashSet<>();
        collectBlueIds(contractNode.getType(), nodeProvider, blueIds, visitedNodes, visitedProviderBlueIds);
        collectBlueIds(contractNode, nodeProvider, blueIds, visitedNodes, visitedProviderBlueIds);
        return blueIds;
    }

    private static void collectBlueIds(Node typeNode,
                                       NodeProvider nodeProvider,
                                       List<String> blueIds,
                                       Set<Node> visitedNodes,
                                       Set<String> visitedProviderBlueIds) {
        if (typeNode == null || !visitedNodes.add(typeNode)) {
            return;
        }
        List<String> directBlueIds = extractBlueIds(typeNode);
        for (String blueId : directBlueIds) {
            addBlueId(blueIds, blueId);
        }
        if (nodeProvider != null) {
            for (String blueId : directBlueIds) {
                if (!visitedProviderBlueIds.add(blueId)) {
                    continue;
                }
                Node typeDefinition = fetchTypeDefinition(nodeProvider, blueId);
                if (typeDefinition == null) {
                    continue;
                }
                collectBlueIds(typeDefinition,
                        nodeProvider,
                        blueIds,
                        visitedNodes,
                        visitedProviderBlueIds);
            }
        }
        collectBlueIds(typeNode.getType(), nodeProvider, blueIds, visitedNodes, visitedProviderBlueIds);
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
        if (node.getValue() instanceof String) {
            addBlueId(blueIds, String.valueOf(node.getValue()));
        }
        if (node.getProperties() != null) {
            Node blueIdNode = node.getProperties().get("blueId");
            if (blueIdNode != null && blueIdNode.getValue() != null) {
                addBlueId(blueIds, String.valueOf(blueIdNode.getValue()));
            }
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

    private <T extends Contract, P extends ContractProcessor<? extends T>> Optional<P> lookupByResolvedClass(
            Node contractNode,
            Class<T> expectedBaseType,
            Map<Class<? extends T>, P> byClass) {
        if (contractNode == null || expectedBaseType == null || typeClassResolver == null) {
            return Optional.empty();
        }
        Class<?> resolvedClass = typeClassResolver.resolveClass(contractNode);
        if (resolvedClass == null || !expectedBaseType.isAssignableFrom(resolvedClass)) {
            return Optional.empty();
        }
        @SuppressWarnings("unchecked")
        Class<? extends T> typedClass = (Class<? extends T>) resolvedClass;
        return lookupProcessor(typedClass, byClass, Collections.<String, P>emptyMap());
    }
}
