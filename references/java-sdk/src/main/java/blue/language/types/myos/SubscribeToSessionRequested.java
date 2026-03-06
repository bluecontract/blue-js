package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Subscribe to Session Requested")
@TypeBlueId("BnrAcFrEHzoARE2yqKmRv7jrPWCbJsVBqSoXwWCaTtrk")
public class SubscribeToSessionRequested {
    public String onBehalfOf;
    public String targetSessionId;
    public Node subscription;

    public SubscribeToSessionRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public SubscribeToSessionRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SubscribeToSessionRequested subscription(Node subscription) {
        this.subscription = subscription;
        return this;
    }
}
