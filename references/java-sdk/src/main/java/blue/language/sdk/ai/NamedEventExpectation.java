package blue.language.sdk.ai;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class NamedEventExpectation {

    private final String eventName;
    private final List<FieldExpectation> fields;

    private NamedEventExpectation(String eventName, List<FieldExpectation> fields) {
        if (eventName == null || eventName.trim().isEmpty()) {
            throw new IllegalArgumentException("eventName is required");
        }
        this.eventName = eventName.trim();
        this.fields = immutableFields(fields);
    }

    public String eventName() {
        return eventName;
    }

    public List<FieldExpectation> fields() {
        return fields;
    }

    public String dedupKey() {
        StringBuilder key = new StringBuilder("named:").append(eventName);
        for (FieldExpectation field : fields) {
            key.append("|").append(field.name()).append("=")
                    .append(field.description() == null ? "" : field.description());
        }
        return key.toString();
    }

    public static Builder named(String eventName) {
        return new Builder(eventName);
    }

    private static List<FieldExpectation> immutableFields(List<FieldExpectation> fields) {
        List<FieldExpectation> result = new ArrayList<FieldExpectation>();
        if (fields != null) {
            for (FieldExpectation field : fields) {
                if (field != null) {
                    result.add(field);
                }
            }
        }
        return Collections.unmodifiableList(result);
    }

    public static final class FieldExpectation {
        private final String name;
        private final String description;

        private FieldExpectation(String name, String description) {
            if (name == null || name.trim().isEmpty()) {
                throw new IllegalArgumentException("field name is required");
            }
            this.name = name.trim();
            this.description = description == null || description.trim().isEmpty()
                    ? null
                    : description.trim();
        }

        public String name() {
            return name;
        }

        public String description() {
            return description;
        }
    }

    public static final class Builder {
        private final String eventName;
        private final List<FieldExpectation> fields = new ArrayList<FieldExpectation>();

        private Builder(String eventName) {
            if (eventName == null || eventName.trim().isEmpty()) {
                throw new IllegalArgumentException("eventName is required");
            }
            this.eventName = eventName.trim();
        }

        public Builder field(String fieldName) {
            fields.add(new FieldExpectation(fieldName, null));
            return this;
        }

        public Builder field(String fieldName, String description) {
            fields.add(new FieldExpectation(fieldName, description));
            return this;
        }

        public NamedEventExpectation build() {
            return new NamedEventExpectation(eventName, fields);
        }
    }
}
