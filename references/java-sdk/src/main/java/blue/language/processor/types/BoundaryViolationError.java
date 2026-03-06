package blue.language.processor.types;

public final class BoundaryViolationError implements ProcessorError {
    private final String pointer;
    private final String reason;

    public BoundaryViolationError(String pointer, String reason) {
        this.pointer = pointer;
        this.reason = reason;
    }

    @Override
    public String kind() {
        return "BoundaryViolation";
    }

    public String pointer() {
        return pointer;
    }

    public String reason() {
        return reason;
    }
}
