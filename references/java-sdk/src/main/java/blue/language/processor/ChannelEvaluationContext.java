package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.MarkerContract;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Snapshot of the data passed to a channel processor during matching.
 *
 * <p>The event node supplied here is a fresh clone of the inbound event.
 * Channel processors MAY mutate it (for example, to normalise or enrich the
 * payload); any changes are confined to this invocation and the adapted node
 * becomes the one delivered to downstream handlers and persisted in the
 * checkpoint.</p>
 */
public final class ChannelEvaluationContext {

    private final String scopePath;
    private final String bindingKey;
    private final Node event;
    private final Object eventObject;
    private final Map<String, MarkerContract> markers;
    private final ContractBundle bundle;
    private final ContractProcessorRegistry registry;

    public ChannelEvaluationContext(String scopePath,
                                    String bindingKey,
                                    Node event,
                                    Object eventObject,
                                    Map<String, MarkerContract> markers,
                                    ContractBundle bundle,
                                    ContractProcessorRegistry registry) {
        this.scopePath = Objects.requireNonNull(scopePath, "scopePath");
        this.bindingKey = bindingKey;
        this.event = event;
        this.eventObject = eventObject;
        this.markers = markers == null
                ? Collections.emptyMap()
                : Collections.unmodifiableMap(new LinkedHashMap<>(markers));
        this.bundle = bundle;
        this.registry = registry;
    }

    public String scopePath() {
        return scopePath;
    }

    public String bindingKey() {
        return bindingKey;
    }

    public Node event() {
        // Mutable clone scoped to this invocation; safe to adapt.
        return event;
    }

    public Object eventObject() {
        return eventObject;
    }

    public Map<String, MarkerContract> markers() {
        return markers;
    }

    public ContractBundle.ChannelBinding resolveChannel(String key) {
        if (bundle == null || key == null) {
            return null;
        }
        return bundle.channel(key.trim());
    }

    public ChannelProcessor<? extends ChannelContract> channelProcessorFor(ChannelContract contract) {
        if (registry == null || contract == null) {
            return null;
        }
        return registry.lookupChannel(contract).orElse(null);
    }

    public ContractBundle bundle() {
        return bundle;
    }

    public ContractProcessorRegistry registry() {
        return registry;
    }
}
