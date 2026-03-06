package blue.language.processor.script;

import java.math.BigInteger;

public final class ScriptRuntimeResult {
    private final Object value;
    private final BigInteger wasmGasUsed;
    private final BigInteger wasmGasRemaining;
    private final boolean valueDefined;

    public ScriptRuntimeResult(Object value, BigInteger wasmGasUsed, BigInteger wasmGasRemaining) {
        this(value, wasmGasUsed, wasmGasRemaining, true);
    }

    public ScriptRuntimeResult(Object value,
                               BigInteger wasmGasUsed,
                               BigInteger wasmGasRemaining,
                               boolean valueDefined) {
        this.value = value;
        this.wasmGasUsed = wasmGasUsed;
        this.wasmGasRemaining = wasmGasRemaining;
        this.valueDefined = valueDefined;
    }

    public Object value() {
        return value;
    }

    public BigInteger wasmGasUsed() {
        return wasmGasUsed;
    }

    public BigInteger wasmGasRemaining() {
        return wasmGasRemaining;
    }

    public boolean valueDefined() {
        return valueDefined;
    }
}
