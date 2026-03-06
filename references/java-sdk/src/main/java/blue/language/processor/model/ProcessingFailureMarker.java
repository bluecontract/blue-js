package blue.language.processor.model;

import blue.language.model.TypeBlueId;

@TypeBlueId("ProcessingFailureMarker")
public class ProcessingFailureMarker extends MarkerContract {

    private String code;
    private String reason;

    public String getCode() {
        return code;
    }

    public ProcessingFailureMarker setCode(String code) {
        this.code = code;
        return this;
    }

    public ProcessingFailureMarker code(String code) {
        return setCode(code);
    }

    public String getReason() {
        return reason;
    }

    public ProcessingFailureMarker setReason(String reason) {
        this.reason = reason;
        return this;
    }

    public ProcessingFailureMarker reason(String reason) {
        return setReason(reason);
    }
}
