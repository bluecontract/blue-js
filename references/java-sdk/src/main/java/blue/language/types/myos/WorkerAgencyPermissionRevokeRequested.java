package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Agency Permission Revoke Requested")
@TypeBlueId("EujAiucSAQ8Pi2S11M4Q2d2xwQ4gQbb6P47yGFaQS57M")
public class WorkerAgencyPermissionRevokeRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;

    public WorkerAgencyPermissionRevokeRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public WorkerAgencyPermissionRevokeRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public WorkerAgencyPermissionRevokeRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
