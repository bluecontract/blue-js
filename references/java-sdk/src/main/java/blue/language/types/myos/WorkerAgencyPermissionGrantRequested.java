package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Agency Permission Grant Requested")
@TypeBlueId("4xTqaBpxAkpryax1S2VBw8NpXXLBhnv12PQXr8iwjTP5")
public class WorkerAgencyPermissionGrantRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;
    public Node workerAgencyPermissions;

    public WorkerAgencyPermissionGrantRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public WorkerAgencyPermissionGrantRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public WorkerAgencyPermissionGrantRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public WorkerAgencyPermissionGrantRequested workerAgencyPermissions(Node workerAgencyPermissions) {
        this.workerAgencyPermissions = workerAgencyPermissions;
        return this;
    }
}
