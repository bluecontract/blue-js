package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Subscription to Session Failed")
public class SubscriptionToSessionFailed {
    public String subscriptionId;
    public String reason;

    public SubscriptionToSessionFailed subscriptionId(String subscriptionId) {
        this.subscriptionId = subscriptionId;
        return this;
    }

    public SubscriptionToSessionFailed reason(String reason) {
        this.reason = reason;
        return this;
    }
}
