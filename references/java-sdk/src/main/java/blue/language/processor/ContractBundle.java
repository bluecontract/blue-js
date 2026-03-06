package blue.language.processor;

import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.model.MarkerContract;
import blue.language.processor.model.ProcessEmbedded;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.util.ProcessorContractConstants;
import blue.language.processor.util.PointerUtils;
import blue.language.model.TypeBlueId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Collection of contracts bound to a scope, along with helper accessors.
 */
public final class ContractBundle {

    private final Map<String, ChannelContract> channels;
    private final Map<String, List<HandlerBinding>> handlersByChannel;
    private final Map<String, MarkerContract> markers;
    private final List<String> embeddedPaths;
    private boolean checkpointDeclared;

    private final Map<String, MarkerContract> markersView;
    private final List<String> embeddedPathsView;

    private ContractBundle(Map<String, ChannelContract> channels,
                           Map<String, List<HandlerBinding>> handlersByChannel,
                           Map<String, MarkerContract> markers,
                           List<String> embeddedPaths,
                           boolean checkpointDeclared) {
        this.channels = channels;
        this.handlersByChannel = handlersByChannel;
        this.markers = markers;
        this.embeddedPaths = embeddedPaths;
        this.checkpointDeclared = checkpointDeclared;

        this.markersView = Collections.unmodifiableMap(this.markers);
        this.embeddedPathsView = Collections.unmodifiableList(this.embeddedPaths);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static ContractBundle empty() {
        return builder().build();
    }

    public Map<String, MarkerContract> markers() {
        return markersView;
    }

    public MarkerContract marker(String key) {
        return markers.get(key);
    }

    public Set<Map.Entry<String, MarkerContract>> markerEntries() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(markers.entrySet()));
    }

    public List<String> embeddedPaths() {
        return embeddedPathsView;
    }

    public boolean hasCheckpoint() {
        return checkpointDeclared;
    }

    public void registerCheckpointMarker(ChannelEventCheckpoint checkpoint) {
        if (checkpointDeclared) {
            throw new IllegalStateException("Duplicate Channel Event Checkpoint markers detected in same contracts map");
        }
        markers.put(ProcessorContractConstants.KEY_CHECKPOINT, checkpoint);
        checkpointDeclared = true;
    }

    public List<HandlerBinding> handlersFor(String channelKey) {
        List<HandlerBinding> handlers = handlersByChannel.get(channelKey);
        if (handlers == null || handlers.isEmpty()) {
            return Collections.emptyList();
        }
        List<HandlerBinding> sorted = new ArrayList<>(handlers);
        sorted.sort(Comparator
                .comparingInt(HandlerBinding::order)
                .thenComparing(HandlerBinding::key));
        return sorted;
    }

    public ChannelBinding channel(String key) {
        if (key == null) {
            return null;
        }
        String normalized = key.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        ChannelContract contract = channels.get(normalized);
        if (contract == null) {
            return null;
        }
        return new ChannelBinding(normalized, contract);
    }

    public List<ChannelBinding> channelsOfType(Class<? extends ChannelContract> type) {
        List<ChannelBinding> result = new ArrayList<>();
        for (Map.Entry<String, ChannelContract> entry : channels.entrySet()) {
            ChannelContract contract = entry.getValue();
            if (type.isInstance(contract)) {
                result.add(new ChannelBinding(entry.getKey(), contract));
            }
        }
        result.sort(Comparator
                .comparingInt(ChannelBinding::order)
                .thenComparing(ChannelBinding::key));
        return result;
    }

    public List<ChannelBinding> channelsOfType(String blueId) {
        if (blueId == null || blueId.trim().isEmpty()) {
            return Collections.emptyList();
        }
        String normalized = blueId.trim();
        List<ChannelBinding> result = new ArrayList<>();
        for (Map.Entry<String, ChannelContract> entry : channels.entrySet()) {
            ChannelContract contract = entry.getValue();
            if (channelMatchesBlueId(contract, normalized)) {
                result.add(new ChannelBinding(entry.getKey(), contract));
            }
        }
        result.sort(Comparator
                .comparingInt(ChannelBinding::order)
                .thenComparing(ChannelBinding::key));
        return result;
    }

    public static final class ChannelBinding {
        private final String key;
        private final ChannelContract contract;

        ChannelBinding(String key, ChannelContract contract) {
            this.key = key;
            this.contract = contract;
        }

        public String key() {
            return key;
        }

        public ChannelContract contract() {
            return contract;
        }

        public int order() {
            Integer order = contract.getOrder();
            return order != null ? order : 0;
        }
    }

    public static final class HandlerBinding {
        private final String key;
        private final HandlerContract contract;

        HandlerBinding(String key, HandlerContract contract) {
            this.key = key;
            this.contract = contract;
        }

        public String key() {
            return key;
        }

        public HandlerContract contract() {
            return contract;
        }

        public int order() {
            Integer order = contract.getOrder();
            return order != null ? order : 0;
        }
    }

    public static final class Builder {
        private final Map<String, ChannelContract> channels = new LinkedHashMap<>();
        private final Map<String, List<HandlerBinding>> handlersByChannel = new LinkedHashMap<>();
        private final Map<String, MarkerContract> markers = new LinkedHashMap<>();
        private final Set<String> usedContractKeys = new LinkedHashSet<>();
        private final List<String> embeddedPaths = new ArrayList<>();
        private boolean embeddedDeclared;
        private boolean checkpointDeclared;

        private Builder() {
        }

        public Builder addChannel(String key, ChannelContract contract) {
            String normalizedKey = validateContractKey(key, "Channel");
            ensureUniqueContractKey(normalizedKey);
            channels.put(normalizedKey, contract);
            return this;
        }

        public Builder addHandler(String key, HandlerContract contract) {
            String normalizedKey = validateContractKey(key, "Handler");
            ensureUniqueContractKey(normalizedKey);
            String channelKey = normalizeChannelKey(contract.getChannelKey(), normalizedKey);
            contract.setChannelKey(channelKey);
            handlersByChannel
                    .computeIfAbsent(channelKey, k -> new ArrayList<>())
                    .add(new HandlerBinding(normalizedKey, contract));
            return this;
        }

        public Builder setEmbedded(ProcessEmbedded embedded) {
            if (embeddedDeclared) {
                throw new IllegalStateException("Multiple Process Embedded markers detected in same contracts map");
            }
            embeddedDeclared = true;
            if (embedded.getPaths() != null) {
                embeddedPaths.clear();
                Set<String> normalizedPaths = new LinkedHashSet<>();
                for (String path : embedded.getPaths()) {
                    if (path == null) {
                        continue;
                    }
                    String trimmed = path.trim();
                    if (trimmed.isEmpty()) {
                        continue;
                    }
                    normalizedPaths.add(PointerUtils.normalizeRequiredPointer(trimmed, "Embedded path"));
                }
                embeddedPaths.addAll(normalizedPaths);
            }
            return this;
        }

        public Builder addMarker(String key, MarkerContract contract) {
            String normalizedKey = validateContractKey(key, "Marker");
            if (contract instanceof ChannelEventCheckpoint) {
                if (!ProcessorContractConstants.KEY_CHECKPOINT.equals(normalizedKey)) {
                    throw new IllegalStateException(
                            "Channel Event Checkpoint must use reserved key 'checkpoint' at key '" + normalizedKey + "'");
                }
                if (checkpointDeclared) {
                    throw new IllegalStateException("Duplicate Channel Event Checkpoint markers detected in same contracts map");
                }
            } else if (ProcessorContractConstants.KEY_CHECKPOINT.equals(normalizedKey)) {
                throw new IllegalStateException(
                        "Reserved key 'checkpoint' must contain a Channel Event Checkpoint");
            }
            ensureUniqueContractKey(normalizedKey);
            if (contract instanceof ChannelEventCheckpoint) {
                checkpointDeclared = true;
            }
            markers.put(normalizedKey, contract);
            return this;
        }

        public ContractBundle build() {
            for (String channelKey : handlersByChannel.keySet()) {
                if (!channels.containsKey(channelKey)) {
                    throw new IllegalStateException("Handler references missing channel: " + channelKey);
                }
            }
            return new ContractBundle(channels, handlersByChannel, markers, embeddedPaths, checkpointDeclared);
        }

        private String validateContractKey(String key, String contractKind) {
            if (key == null || key.trim().isEmpty()) {
                throw new IllegalStateException(contractKind + " contract key must not be blank");
            }
            return key.trim();
        }

        private void ensureUniqueContractKey(String key) {
            if (!usedContractKeys.add(key)) {
                throw new IllegalStateException("Duplicate contract key: " + key);
            }
        }

        private String normalizeChannelKey(String channelKey, String handlerKey) {
            if (channelKey == null) {
                throw new IllegalStateException("Handler " + handlerKey + " must declare channel");
            }
            String normalized = channelKey.trim();
            if (normalized.isEmpty()) {
                throw new IllegalStateException("Handler " + handlerKey + " must declare channel");
            }
            return normalized;
        }
    }

    private static boolean channelMatchesBlueId(ChannelContract contract, String blueId) {
        if (contract == null || blueId == null) {
            return false;
        }
        TypeBlueId annotation = contract.getClass().getAnnotation(TypeBlueId.class);
        if (annotation == null) {
            return false;
        }
        String[] values = annotation.value();
        if (values != null) {
            for (String value : values) {
                if (blueId.equals(value != null ? value.trim() : null)) {
                    return true;
                }
            }
        }
        String defaultValue = annotation.defaultValue();
        return blueId.equals(defaultValue != null ? defaultValue.trim() : null);
    }
}
