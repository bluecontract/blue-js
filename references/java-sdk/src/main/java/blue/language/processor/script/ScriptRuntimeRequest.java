package blue.language.processor.script;

import java.math.BigInteger;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class ScriptRuntimeRequest {

    private final String code;
    private final Map<String, Object> bindings;
    private final BigInteger wasmGasLimit;

    public ScriptRuntimeRequest(String code, Map<String, Object> bindings, BigInteger wasmGasLimit) {
        this.code = Objects.requireNonNull(code, "code");
        this.bindings = bindings == null
                ? Collections.<String, Object>emptyMap()
                : Collections.unmodifiableMap(new LinkedHashMap<>(bindings));
        this.wasmGasLimit = wasmGasLimit;
    }

    public static ScriptRuntimeRequest of(String code) {
        return new ScriptRuntimeRequest(code, Collections.<String, Object>emptyMap(), null);
    }

    public String code() {
        return code;
    }

    public Map<String, Object> bindings() {
        return bindings;
    }

    public BigInteger wasmGasLimit() {
        return wasmGasLimit;
    }
}
