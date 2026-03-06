package blue.language.processor.types;

public final class CapabilityFailureError implements ProcessorError {
    private final String capability;
    private final String reason;
    private final Object details;

    public CapabilityFailureError(String capability, String reason, Object details) {
        this.capability = capability;
        this.reason = reason;
        this.details = details;
    }

    @Override
    public String kind() {
        return "CapabilityFailure";
    }

    public String capability() {
        return capability;
    }

    public String reason() {
        return reason;
    }

    public Object details() {
        return details;
    }
}
