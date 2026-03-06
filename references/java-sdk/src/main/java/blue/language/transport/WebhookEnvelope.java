package blue.language.transport;

import blue.language.Blue;
import blue.language.snapshot.ResolvedSnapshot;
import blue.language.utils.NodeToMapListOrValue;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class WebhookEnvelope {

    private final String rootBlueId;
    private final Object canonical;
    private final Map<String, Object> bundle;
    private final Map<String, String> blueIdsByPointer;

    private WebhookEnvelope(Builder builder) {
        this.rootBlueId = Objects.requireNonNull(builder.rootBlueId, "rootBlueId");
        this.canonical = Objects.requireNonNull(builder.canonical, "canonical");
        this.bundle = Collections.unmodifiableMap(new LinkedHashMap<String, Object>(builder.bundle));
        this.blueIdsByPointer = Collections.unmodifiableMap(new LinkedHashMap<String, String>(builder.blueIdsByPointer));
    }

    public String rootBlueId() {
        return rootBlueId;
    }

    public Object canonical() {
        return canonical;
    }

    public Map<String, Object> bundle() {
        return bundle;
    }

    public Map<String, String> blueIdsByPointer() {
        return blueIdsByPointer;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static WebhookEnvelope fromSnapshot(ResolvedSnapshot snapshot) {
        return builder()
                .rootBlueId(snapshot.rootBlueId())
                .canonical(NodeToMapListOrValue.get(snapshot.canonicalRoot().toNode()))
                .blueIdsByPointer(snapshot.blueIdsByPointer().asMap())
                .build();
    }

    public static WebhookEnvelope fromSnapshot(ResolvedSnapshot snapshot, Blue blue) {
        Map<String, Object> bundle = new BundleBuilder()
                .forCanonical(blue, snapshot.canonicalRoot().toNode());
        return builder()
                .rootBlueId(snapshot.rootBlueId())
                .canonical(NodeToMapListOrValue.get(snapshot.canonicalRoot().toNode()))
                .bundle(bundle)
                .blueIdsByPointer(snapshot.blueIdsByPointer().asMap())
                .build();
    }

    public static final class Builder {
        private String rootBlueId;
        private Object canonical;
        private final Map<String, Object> bundle = new LinkedHashMap<String, Object>();
        private final Map<String, String> blueIdsByPointer = new LinkedHashMap<String, String>();

        public Builder rootBlueId(String rootBlueId) {
            this.rootBlueId = rootBlueId;
            return this;
        }

        public Builder canonical(Object canonical) {
            this.canonical = canonical;
            return this;
        }

        public Builder putBundleEntry(String key, Object value) {
            this.bundle.put(key, value);
            return this;
        }

        public Builder bundle(Map<String, Object> bundle) {
            this.bundle.clear();
            if (bundle != null) {
                this.bundle.putAll(bundle);
            }
            return this;
        }

        public Builder blueIdsByPointer(Map<String, String> blueIdsByPointer) {
            this.blueIdsByPointer.clear();
            if (blueIdsByPointer != null) {
                this.blueIdsByPointer.putAll(blueIdsByPointer);
            }
            return this;
        }

        public WebhookEnvelope build() {
            return new WebhookEnvelope(this);
        }
    }
}
