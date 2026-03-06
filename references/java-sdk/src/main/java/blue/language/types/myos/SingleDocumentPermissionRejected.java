package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Single Document Permission Rejected")
@TypeBlueId("9voKnwYf1f9YjQdYHthDKwA8cXEWqvEiF6uAydnYYvWr")
public class SingleDocumentPermissionRejected {
    public String reason;
    public Node inResponseTo;

    public SingleDocumentPermissionRejected reason(String reason) {
        this.reason = reason;
        return this;
    }

    public SingleDocumentPermissionRejected inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
