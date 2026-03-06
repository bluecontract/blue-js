package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Single Document Permission Revoke Requested")
@TypeBlueId("9U8Zw3L2UH6fS2ddUNjQRPQCf3P1LxWcQJHWRY6nKLnn")
public class SingleDocumentPermissionRevokeRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;

    public SingleDocumentPermissionRevokeRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public SingleDocumentPermissionRevokeRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public SingleDocumentPermissionRevokeRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
