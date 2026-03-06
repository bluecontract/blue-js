package blue.language.types.conversation;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

import java.util.List;

@TypeAlias("Conversation/Update Document")
@TypeBlueId("FtHZJzH4hqAoGxFBjsmy1svfT4BwEBB4aHpFSZycZLLa")
public class UpdateDocument {
    public List<Node> changeset;

    public UpdateDocument changeset(List<Node> changeset) {
        this.changeset = changeset;
        return this;
    }
}
