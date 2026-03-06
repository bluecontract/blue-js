package blue.language.processor.types;

public final class InvalidContractError implements ProcessorError {
    private final String contractId;
    private final String reason;
    private final String pointer;
    private final Object details;

    public InvalidContractError(String contractId, String reason, String pointer, Object details) {
        this.contractId = contractId;
        this.reason = reason;
        this.pointer = pointer;
        this.details = details;
    }

    @Override
    public String kind() {
        return "InvalidContract";
    }

    public String contractId() {
        return contractId;
    }

    public String reason() {
        return reason;
    }

    public String pointer() {
        return pointer;
    }

    public Object details() {
        return details;
    }
}
