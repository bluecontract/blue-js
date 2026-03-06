package blue.language.processor.types;

public final class UnsupportedOpError implements ProcessorError {
    private final String operation;
    private final String reason;

    public UnsupportedOpError(String operation, String reason) {
        this.operation = operation;
        this.reason = reason;
    }

    @Override
    public String kind() {
        return "UnsupportedOp";
    }

    public String operation() {
        return operation;
    }

    public String reason() {
        return reason;
    }
}
