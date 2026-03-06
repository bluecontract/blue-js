package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Agency Permission Rejected")
public class WorkerAgencyPermissionRejected {
    public Node inResponseTo;

    public WorkerAgencyPermissionRejected inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
