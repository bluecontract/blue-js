package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Subscribable Session Created")
public class SubscribableSessionCreated {
    public String targetSessionId;

    public SubscribableSessionCreated targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
