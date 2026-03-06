package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Linked Documents Permission Revoke Requested")
@TypeBlueId("63x81Ltwf2hU4Qkt7s2VgXyW58Sn6Z1M2W5fSw3jVLbp")
public class LinkedDocumentsPermissionRevokeRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;

    public LinkedDocumentsPermissionRevokeRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public LinkedDocumentsPermissionRevokeRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public LinkedDocumentsPermissionRevokeRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
