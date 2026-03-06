package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Subscription Update")
@TypeBlueId("2gc8djtKGGRPjGfMQzvJZMviaXm4ytM1nA4DVbfyjkrW")
public class SubscriptionUpdate {
    public String subscriptionId;
    public String targetSessionId;
    public Node update;

    public SubscriptionUpdate subscriptionId(String subscriptionId) {
        this.subscriptionId = subscriptionId;
        return this;
    }

    public SubscriptionUpdate targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SubscriptionUpdate update(Node update) {
        this.update = update;
        return this;
    }
}
