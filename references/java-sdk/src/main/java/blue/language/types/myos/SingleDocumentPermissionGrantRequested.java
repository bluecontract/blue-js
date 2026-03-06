package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Single Document Permission Grant Requested")
@TypeBlueId("Ef7EvcR5He11JtgBFtswYTHEfUKnTHmFysMTo3ZsoQby")
public class SingleDocumentPermissionGrantRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;
    public Node permissions;
    public Boolean grantSessionSubscriptionOnResult;

    public SingleDocumentPermissionGrantRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public SingleDocumentPermissionGrantRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public SingleDocumentPermissionGrantRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SingleDocumentPermissionGrantRequested permissions(Node permissions) {
        this.permissions = permissions;
        return this;
    }

    public SingleDocumentPermissionGrantRequested grantSessionSubscriptionOnResult(
            Boolean grantSessionSubscriptionOnResult) {
        this.grantSessionSubscriptionOnResult = grantSessionSubscriptionOnResult;
        return this;
    }
}
