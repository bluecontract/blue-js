package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Call Operation Responded")
@TypeBlueId("BJQfo2Whut5K8YQG6Q3vK8kDrfhrf6Qf6KNbkA8M9A7e")
public class CallOperationResponded {
    public Node result;
    public Node inResponseTo;

    public CallOperationResponded result(Node result) {
        this.result = result;
        return this;
    }

    public CallOperationResponded inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
