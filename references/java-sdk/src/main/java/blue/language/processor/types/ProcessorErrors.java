package blue.language.processor.types;

public final class ProcessorErrors {

    private ProcessorErrors() {
    }

    public static CapabilityFailureError capabilityFailure(String capability, String reason) {
        return capabilityFailure(capability, reason, null);
    }

    public static CapabilityFailureError capabilityFailure(String capability, String reason, Object details) {
        return new CapabilityFailureError(capability, reason, details);
    }

    public static BoundaryViolationError boundaryViolation(String pointer, String reason) {
        return new BoundaryViolationError(pointer, reason);
    }

    public static RuntimeFatalError runtimeFatal(String reason) {
        return runtimeFatal(reason, null);
    }

    public static RuntimeFatalError runtimeFatal(String reason, Object cause) {
        return new RuntimeFatalError(reason, cause);
    }

    public static InvalidContractError invalidContract(String contractId, String reason) {
        return invalidContract(contractId, reason, null, null);
    }

    public static InvalidContractError invalidContract(String contractId,
                                                       String reason,
                                                       String pointer,
                                                       Object details) {
        return new InvalidContractError(contractId, reason, pointer, details);
    }

    public static ProcessorIllegalStateError illegalState(String reason) {
        return new ProcessorIllegalStateError(reason);
    }

    public static UnsupportedOpError unsupported(String operation) {
        return unsupported(operation, null);
    }

    public static UnsupportedOpError unsupported(String operation, String reason) {
        return new UnsupportedOpError(operation, reason);
    }
}
