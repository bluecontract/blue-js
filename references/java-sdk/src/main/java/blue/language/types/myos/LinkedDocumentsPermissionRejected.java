package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Linked Documents Permission Rejected")
public class LinkedDocumentsPermissionRejected {
    public String targetSessionId;
    public Node inResponseTo;

    public LinkedDocumentsPermissionRejected targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public LinkedDocumentsPermissionRejected inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
