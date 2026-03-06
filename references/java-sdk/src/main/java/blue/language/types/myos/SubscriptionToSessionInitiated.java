package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Subscription to Session Initiated")
@TypeBlueId("GZPDibWTKDudqwPufgmNo7AHMLwY5FGeeHFx3EkegzLj")
public class SubscriptionToSessionInitiated {
    public String subscriptionId;
    public String targetSessionId;
    public String at;

    public SubscriptionToSessionInitiated subscriptionId(String subscriptionId) {
        this.subscriptionId = subscriptionId;
        return this;
    }

    public SubscriptionToSessionInitiated targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SubscriptionToSessionInitiated at(String at) {
        this.at = at;
        return this;
    }
}
