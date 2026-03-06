package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Call Operation Requested")
@TypeBlueId("EVX6nBdHdVEBH9Gbthpd2eqpxaxS4bb9wM55QNdZmcBy")
public class CallOperationRequested {
    public String onBehalfOf;
    public String targetSessionId;
    public String operation;
    public Node request;

    public CallOperationRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public CallOperationRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public CallOperationRequested operation(String operation) {
        this.operation = operation;
        return this;
    }

    public CallOperationRequested request(Node request) {
        this.request = request;
        return this;
    }
}
