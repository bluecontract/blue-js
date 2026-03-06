package blue.language.processor.script;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class QuickJSEvaluator implements AutoCloseable {

    public interface DocumentBinding {
        Object get(String pointer);

        Object getCanonical(String pointer);
    }

    private static final Set<String> SUPPORTED_BINDINGS = Collections.unmodifiableSet(
            new java.util.LinkedHashSet<String>(Arrays.asList(
                    "event",
                    "eventCanonical",
                    "steps",
                    "document",
                    "emit",
                    "currentContract",
                    "currentContractCanonical",
                    "__documentData",
                    "__documentDataSimple",
                    "__documentDataCanonical",
                    "__scopePath")));
    private static final Pattern DOCUMENT_CALL_PATTERN = Pattern.compile("document\\((['\"])(.*?)\\1\\)");
    private static final Pattern DOCUMENT_GET_PATTERN = Pattern.compile("document\\.get\\((['\"])(.*?)\\1\\)");
    private static final Pattern DOCUMENT_CANONICAL_PATTERN = Pattern.compile("document\\.canonical\\((['\"])(.*?)\\1\\)");
    private static final Pattern DOCUMENT_GET_CANONICAL_PATTERN = Pattern.compile("document\\.getCanonical\\((['\"])(.*?)\\1\\)");

    private final ScriptRuntime runtime;

    public QuickJSEvaluator() {
        this(new QuickJsSidecarRuntime());
    }

    public QuickJSEvaluator(ScriptRuntime runtime) {
        this.runtime = runtime;
    }

    public ScriptRuntimeResult evaluate(String code, Map<String, Object> bindings, BigInteger wasmGasLimit) {
        Map<String, Object> safeBindings = normalizeBindings(code, bindings);
        Consumer<Object> emitCallback = extractEmitCallback(safeBindings);
        validateBindings(safeBindings);
        try {
            ScriptRuntimeResult runtimeResult = runtime.evaluate(
                    new ScriptRuntimeRequest(withRuntimePrelude(wrapCode(code)), safeBindings, wasmGasLimit));
            return applyEmitCallback(runtimeResult, emitCallback);
        } catch (ScriptRuntimeException ex) {
            throw new CodeBlockEvaluationError(code, ex);
        }
    }

    private String withRuntimePrelude(String code) {
        String source = code == null ? "" : code;
        source = source.replace("document.getCanonical(", "document.canonical(");
        source = source.replace("document.get(", "document(");
        return source;
    }

    private String wrapCode(String code) {
        StringBuilder wrapped = new StringBuilder();
        wrapped.append("(() => {\n");
        wrapped.append("return (() => {\n");
        if (code != null) {
            wrapped.append(code);
        }
        wrapped.append("\n");
        wrapped.append("})()\n");
        wrapped.append("})()");
        return wrapped.toString();
    }

    @Override
    public void close() {
        runtime.close();
    }

    private void validateBindings(Map<String, Object> bindings) {
        if (bindings == null || bindings.isEmpty()) {
            return;
        }
        for (String key : bindings.keySet()) {
            if (!SUPPORTED_BINDINGS.contains(key)) {
                throw new IllegalArgumentException("Unsupported QuickJS binding: \"" + key + "\"");
            }
            Object value = bindings.get(key);
            if ("document".equals(key) && value != null) {
                throw new IllegalArgumentException("QuickJS document binding must be a function");
            }
            if ("emit".equals(key) && value != null) {
                throw new IllegalArgumentException("QuickJS emit binding must be a function");
            }
        }
    }

    private Map<String, Object> normalizeBindings(String code, Map<String, Object> bindings) {
        Map<String, Object> normalized = bindings == null
                ? new LinkedHashMap<String, Object>()
                : new LinkedHashMap<String, Object>(bindings);
        Object event = normalized.get("event");
        if (!normalized.containsKey("event")) {
            normalized.put("event", null);
            event = null;
        }
        if (!normalized.containsKey("eventCanonical") || normalized.get("eventCanonical") == null) {
            normalized.put("eventCanonical", event);
        }
        if (!normalized.containsKey("steps") || normalized.get("steps") == null) {
            normalized.put("steps", Collections.emptyList());
        }
        Object currentContract = normalized.get("currentContract");
        if (!normalized.containsKey("currentContract")) {
            normalized.put("currentContract", null);
            currentContract = null;
        }
        if (!normalized.containsKey("currentContractCanonical")
                || normalized.get("currentContractCanonical") == null) {
            normalized.put("currentContractCanonical", currentContract);
        }
        normalizeDocumentBinding(code, normalized);
        return normalized;
    }

    private Consumer<Object> extractEmitCallback(Map<String, Object> bindings) {
        if (bindings == null || !bindings.containsKey("emit")) {
            return null;
        }
        Object emit = bindings.get("emit");
        if (emit == null) {
            return null;
        }
        if (emit instanceof Consumer) {
            bindings.remove("emit");
            @SuppressWarnings("unchecked")
            Consumer<Object> callback = (Consumer<Object>) emit;
            return callback;
        }
        throw new IllegalArgumentException("QuickJS emit binding must be a function");
    }

    private ScriptRuntimeResult applyEmitCallback(ScriptRuntimeResult runtimeResult, Consumer<Object> emitCallback) {
        if (emitCallback == null || runtimeResult == null || !(runtimeResult.value() instanceof Map)) {
            return runtimeResult;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> valueMap = (Map<String, Object>) runtimeResult.value();
        boolean valueDefined = runtimeResult.valueDefined();
        if (valueMap.get("__resultDefined") instanceof Boolean) {
            valueDefined = ((Boolean) valueMap.get("__resultDefined")).booleanValue();
        }
        Object events = valueMap.get("events");
        if (!(events instanceof List)) {
            return runtimeResult;
        }
        @SuppressWarnings("unchecked")
        List<Object> emittedEvents = (List<Object>) events;
        for (Object emitted : emittedEvents) {
            emitCallback.accept(emitted);
        }
        if (valueMap.containsKey("__result")) {
            return new ScriptRuntimeResult(
                    valueMap.get("__result"),
                    runtimeResult.wasmGasUsed(),
                    runtimeResult.wasmGasRemaining(),
                    true);
        }
        Map<String, Object> stripped = new LinkedHashMap<String, Object>(valueMap);
        stripped.remove("events");
        stripped.remove("__resultDefined");
        if (!valueDefined && stripped.isEmpty()) {
            return new ScriptRuntimeResult(null, runtimeResult.wasmGasUsed(), runtimeResult.wasmGasRemaining(), false);
        }
        return new ScriptRuntimeResult(stripped, runtimeResult.wasmGasUsed(), runtimeResult.wasmGasRemaining(), true);
    }

    @SuppressWarnings("unchecked")
    private void normalizeDocumentBinding(String code, Map<String, Object> bindings) {
        if (bindings == null || !bindings.containsKey("document")) {
            return;
        }
        Object value = bindings.get("document");
        if (value == null) {
            return;
        }

        Function<String, Object> simpleReader = null;
        Function<String, Object> canonicalReader = null;
        if (value instanceof DocumentBinding) {
            final DocumentBinding binding = (DocumentBinding) value;
            simpleReader = new Function<String, Object>() {
                @Override
                public Object apply(String pointer) {
                    return binding.get(pointer);
                }
            };
            canonicalReader = new Function<String, Object>() {
                @Override
                public Object apply(String pointer) {
                    return binding.getCanonical(pointer);
                }
            };
        } else if (value instanceof Function) {
            final Function<Object, Object> binding = (Function<Object, Object>) value;
            simpleReader = new Function<String, Object>() {
                @Override
                public Object apply(String pointer) {
                    return binding.apply(pointer);
                }
            };
            canonicalReader = simpleReader;
        } else {
            throw new IllegalArgumentException("QuickJS document binding must be a function");
        }

        bindings.remove("document");
        if (bindings.get("__documentDataSimple") == null) {
            Object simpleSnapshot = buildSnapshotFromCodePointers(code, simpleReader, false);
            if (simpleSnapshot != null) {
                bindings.put("__documentDataSimple", simpleSnapshot);
            }
        }
        if (bindings.get("__documentDataCanonical") == null) {
            Object canonicalSnapshot = buildSnapshotFromCodePointers(code, canonicalReader, true);
            if (canonicalSnapshot != null) {
                bindings.put("__documentDataCanonical", canonicalSnapshot);
            }
        }
    }

    private Object buildSnapshotFromCodePointers(String code, Function<String, Object> reader, boolean canonical) {
        if (reader == null) {
            return null;
        }
        Map<String, Object> pointerValues = new LinkedHashMap<String, Object>();
        Object rootValue = safeRead(reader, "/");
        if (rootValue != null) {
            pointerValues.put("/", rootValue);
        }
        collectPointerValues(pointerValues, code, canonical ? DOCUMENT_CANONICAL_PATTERN : DOCUMENT_CALL_PATTERN, reader);
        collectPointerValues(pointerValues, code, canonical ? DOCUMENT_GET_CANONICAL_PATTERN : DOCUMENT_GET_PATTERN, reader);
        if (pointerValues.isEmpty()) {
            return null;
        }
        return buildSnapshotTree(pointerValues);
    }

    private void collectPointerValues(Map<String, Object> pointerValues,
                                      String code,
                                      Pattern pattern,
                                      Function<String, Object> reader) {
        Matcher matcher = pattern.matcher(code == null ? "" : code);
        while (matcher.find()) {
            String pointer = matcher.group(2);
            if (pointer == null || pointer.trim().isEmpty()) {
                pointer = "/";
            }
            String normalized = normalizePointer(pointer);
            if (pointerValues.containsKey(normalized)) {
                continue;
            }
            Object value = safeRead(reader, normalized);
            if (value != null) {
                pointerValues.put(normalized, value);
            }
        }
    }

    private Object safeRead(Function<String, Object> reader, String pointer) {
        try {
            return reader.apply(pointer);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Object buildSnapshotTree(Map<String, Object> pointerValues) {
        Object root = new LinkedHashMap<String, Object>();
        Object rootValue = pointerValues.get("/");
        if (rootValue instanceof Map || rootValue instanceof List) {
            root = rootValue;
        } else if (rootValue != null) {
            return rootValue;
        }

        for (Map.Entry<String, Object> entry : pointerValues.entrySet()) {
            String pointer = entry.getKey();
            if ("/".equals(pointer)) {
                continue;
            }
            List<String> segments = decodePointerSegments(pointer);
            root = insertAtPointer(root, segments, entry.getValue());
        }
        return root;
    }

    private Object insertAtPointer(Object root, List<String> segments, Object value) {
        Object current = root;
        Object parent = null;
        String parentSegment = null;
        for (int i = 0; i < segments.size(); i++) {
            String segment = segments.get(i);
            boolean last = i == segments.size() - 1;
            boolean numeric = isNumeric(segment);
            if (current instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) current;
                if (last) {
                    map.put(segment, value);
                    return root;
                }
                Object next = map.get(segment);
                if (next == null) {
                    next = numericSegmentAhead(segments, i + 1) ? new java.util.ArrayList<Object>() : new LinkedHashMap<String, Object>();
                    map.put(segment, next);
                }
                parent = map;
                parentSegment = segment;
                current = next;
                continue;
            }
            if (current instanceof List && numeric) {
                @SuppressWarnings("unchecked")
                List<Object> list = (List<Object>) current;
                int index = Integer.parseInt(segment);
                while (list.size() <= index) {
                    list.add(null);
                }
                if (last) {
                    list.set(index, value);
                    return root;
                }
                Object next = list.get(index);
                if (next == null) {
                    next = numericSegmentAhead(segments, i + 1) ? new java.util.ArrayList<Object>() : new LinkedHashMap<String, Object>();
                    list.set(index, next);
                }
                parent = list;
                parentSegment = segment;
                current = next;
                continue;
            }

            Object replacement = numeric ? new java.util.ArrayList<Object>() : new LinkedHashMap<String, Object>();
            if (parent == null) {
                root = replacement;
            } else if (parent instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mapParent = (Map<String, Object>) parent;
                mapParent.put(parentSegment, replacement);
            } else if (parent instanceof List && isNumeric(parentSegment)) {
                @SuppressWarnings("unchecked")
                List<Object> listParent = (List<Object>) parent;
                listParent.set(Integer.parseInt(parentSegment), replacement);
            }
            current = replacement;
            i--;
        }
        return root;
    }

    private boolean numericSegmentAhead(List<String> segments, int index) {
        if (segments == null || index < 0 || index >= segments.size()) {
            return false;
        }
        return isNumeric(segments.get(index));
    }

    private boolean isNumeric(String segment) {
        if (segment == null || segment.isEmpty()) {
            return false;
        }
        for (int i = 0; i < segment.length(); i++) {
            if (!Character.isDigit(segment.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private List<String> decodePointerSegments(String pointer) {
        String normalized = normalizePointer(pointer);
        if ("/".equals(normalized)) {
            return Collections.emptyList();
        }
        String[] rawSegments = normalized.substring(1).split("/");
        java.util.ArrayList<String> decoded = new java.util.ArrayList<String>(rawSegments.length);
        for (String raw : rawSegments) {
            decoded.add(raw.replace("~1", "/").replace("~0", "~"));
        }
        return decoded;
    }

    private String normalizePointer(String pointer) {
        if (pointer == null || pointer.trim().isEmpty()) {
            return "/";
        }
        String trimmed = pointer.trim();
        return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    }
}
