package blue.language.blueid;

import blue.language.processor.util.PointerUtils;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class MapBlueIdIndex implements BlueIdIndex {

    private static final MapBlueIdIndex EMPTY = new MapBlueIdIndex(Collections.<String, String>emptyMap());

    private final Map<String, String> index;

    private MapBlueIdIndex(Map<String, String> index) {
        this.index = Collections.unmodifiableMap(new LinkedHashMap<String, String>(index));
    }

    public static MapBlueIdIndex empty() {
        return EMPTY;
    }

    public static MapBlueIdIndex from(Map<String, String> source) {
        if (source == null || source.isEmpty()) {
            return empty();
        }
        Map<String, String> normalized = new LinkedHashMap<String, String>();
        for (Map.Entry<String, String> entry : source.entrySet()) {
            String normalizedKey = normalizeStrictPointer(entry.getKey(), "Stored pointer");
            if (normalized.containsKey(normalizedKey)) {
                throw new IllegalArgumentException("Duplicate normalized pointer key: " + normalizedKey);
            }
            normalized.put(normalizedKey, normalizeBlueId(entry.getValue(), normalizedKey));
        }
        return new MapBlueIdIndex(normalized);
    }

    @Override
    public String blueIdAt(String jsonPointer) {
        return index.get(normalizeStrictPointer(jsonPointer, "Lookup pointer"));
    }

    @Override
    public Map<String, String> asMap() {
        return index;
    }

    private static String normalizeBlueId(String blueId, String pointer) {
        if (blueId == null || blueId.trim().isEmpty()) {
            throw new IllegalArgumentException("Missing blueId value for pointer: " + pointer);
        }
        return blueId.trim();
    }

    private static String normalizeStrictPointer(String pointer, String argumentName) {
        if (pointer == null || pointer.isEmpty()) {
            return "/";
        }
        return PointerUtils.normalizeRequiredPointer(pointer, argumentName);
    }
}
