package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Linked Documents Permission Granted")
public class LinkedDocumentsPermissionGranted {
    public String targetSessionId;
    public Node links;
    public Node inResponseTo;

    public LinkedDocumentsPermissionGranted targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public LinkedDocumentsPermissionGranted links(Node links) {
        this.links = links;
        return this;
    }

    public LinkedDocumentsPermissionGranted inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
