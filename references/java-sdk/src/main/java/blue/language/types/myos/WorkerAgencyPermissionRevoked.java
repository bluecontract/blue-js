package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Agency Permission Revoked")
public class WorkerAgencyPermissionRevoked {
    public Node inResponseTo;

    public WorkerAgencyPermissionRevoked inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
