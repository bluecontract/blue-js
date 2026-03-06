package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Linked Documents Permission Grant Requested")
@TypeBlueId("DBv2TLwytwBgvrSVeauLjTZYycf8hiXgdadoyRVDfjhS")
public class LinkedDocumentsPermissionGrantRequested {
    public String onBehalfOf;
    public String requestId;
    public String targetSessionId;
    public Node links;

    public LinkedDocumentsPermissionGrantRequested onBehalfOf(String onBehalfOf) {
        this.onBehalfOf = onBehalfOf;
        return this;
    }

    public LinkedDocumentsPermissionGrantRequested requestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public LinkedDocumentsPermissionGrantRequested targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public LinkedDocumentsPermissionGrantRequested links(Node links) {
        this.links = links;
        return this;
    }
}
