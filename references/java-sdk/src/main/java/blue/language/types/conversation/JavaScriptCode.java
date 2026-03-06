package blue.language.types.conversation;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/JavaScript Code")
@TypeBlueId("3hYcmWMtMUPAzXBLFLb7BpuG9537tuTJPCr7pxWXvTZK")
public class JavaScriptCode {
    public String code;

    public JavaScriptCode code(String code) {
        this.code = code;
        return this;
    }
}
