package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Single Document Permission Revoked")
public class SingleDocumentPermissionRevoked {
    public String targetSessionId;
    public Node inResponseTo;

    public SingleDocumentPermissionRevoked targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SingleDocumentPermissionRevoked inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
