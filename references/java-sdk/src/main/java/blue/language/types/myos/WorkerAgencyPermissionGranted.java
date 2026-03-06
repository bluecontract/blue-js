package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Agency Permission Granted")
public class WorkerAgencyPermissionGranted {
    public Node inResponseTo;

    public WorkerAgencyPermissionGranted inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
