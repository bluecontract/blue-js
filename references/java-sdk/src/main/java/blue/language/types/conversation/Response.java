package blue.language.types.conversation;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Response")
@TypeBlueId("36epvrpVHZLjapbeZsNodz2NDnm7XZeNZcnkWHgkP1pp")
public class Response {
    public Node inResponseTo;

    public Response inResponseTo(Node inResponseTo) {
        this.inResponseTo = inResponseTo;
        return this;
    }
}
