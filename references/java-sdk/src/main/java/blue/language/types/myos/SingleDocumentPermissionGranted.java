package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Single Document Permission Granted")
@TypeBlueId("8XYzJ3BrgB5uoAWU5HvZ7Gej9RXNG5r52ccneLZxMAQd")
public class SingleDocumentPermissionGranted {
    public String targetSessionId;
    public Node permissions;

    public SingleDocumentPermissionGranted targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public SingleDocumentPermissionGranted permissions(Node permissions) {
        this.permissions = permissions;
        return this;
    }
}
