package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Target Document Session Started")
public class TargetDocumentSessionStarted {
    public String targetSessionId;

    public TargetDocumentSessionStarted targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
