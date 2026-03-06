package blue.language.types.conversation;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Operation")
@TypeBlueId("BoAiqVUZv9Fum3wFqaX2JnQMBHJLxJSo2V9U2UBmCfsC")
public class Operation {
    public Node request;
    public String channel;

    public Operation request(Node request) {
        this.request = request;
        return this;
    }

    public Operation channel(String channel) {
        this.channel = channel;
        return this;
    }
}
