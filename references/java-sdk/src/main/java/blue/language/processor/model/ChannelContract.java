package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

/**
 * Base contract describing a channel available within a scope.
 */
@TypeAlias("Channel")
@TypeBlueId({
        "DcoJyCh7XXxy1nR5xjy7qfkUgQ1GiZnKKSxh8DJusBSr",
        "Channel",
        "Core/Channel"
})
public abstract class ChannelContract extends Contract {

    private String path;
    private Node definition;

    public String getPath() {
        return path;
    }

    public ChannelContract setPath(String path) {
        this.path = path;
        return this;
    }

    public ChannelContract path(String path) {
        return setPath(path);
    }

    public Node getDefinition() {
        return definition;
    }

    public ChannelContract setDefinition(Node definition) {
        this.definition = definition;
        return this;
    }

    public ChannelContract definition(Node definition) {
        return setDefinition(definition);
    }
}
