package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Start Worker Session Requested")
@TypeBlueId("3MNb8B84b9CkT5LY2qvxG9k86f5osYQwJ9TK4FFfCKmX")
public class StartWorkerSessionRequested {
    public String agentChannelKey;
    public Node config;

    public StartWorkerSessionRequested agentChannelKey(String agentChannelKey) {
        this.agentChannelKey = agentChannelKey;
        return this;
    }

    public StartWorkerSessionRequested config(Node config) {
        this.config = config;
        return this;
    }
}
