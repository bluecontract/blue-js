package blue.language.processor.types;

public final class RuntimeFatalError implements ProcessorError {
    private final String reason;
    private final Object cause;

    public RuntimeFatalError(String reason, Object cause) {
        this.reason = reason;
        this.cause = cause;
    }

    @Override
    public String kind() {
        return "RuntimeFatal";
    }

    public String reason() {
        return reason;
    }

    public Object cause() {
        return cause;
    }
}
