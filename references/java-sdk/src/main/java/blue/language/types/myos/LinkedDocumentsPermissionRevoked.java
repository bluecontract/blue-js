package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Linked Documents Permission Revoked")
public class LinkedDocumentsPermissionRevoked {
    public String targetSessionId;
    public Node inResponseTo;

    public LinkedDocumentsPermissionRevoked targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public LinkedDocumentsPermissionRevoked inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
