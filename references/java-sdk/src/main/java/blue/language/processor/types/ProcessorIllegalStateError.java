package blue.language.processor.types;

public final class ProcessorIllegalStateError implements ProcessorError {
    private final String reason;

    public ProcessorIllegalStateError(String reason) {
        this.reason = reason;
    }

    @Override
    public String kind() {
        return "IllegalState";
    }

    public String reason() {
        return reason;
    }
}
