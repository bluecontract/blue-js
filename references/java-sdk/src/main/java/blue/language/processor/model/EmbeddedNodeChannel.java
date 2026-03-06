package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Embedded Node Channel")
@TypeBlueId({
        "Fjbu3QpnUaTruDTcTidETCX2N5STyv7KYxT42PCzGHxm",
        "Embedded Node Channel",
        "Core/Embedded Node Channel",
        "EmbeddedNodeChannel"
})
public class EmbeddedNodeChannel extends ChannelContract {

    private String childPath;

    public String getChildPath() {
        return childPath;
    }

    public EmbeddedNodeChannel setChildPath(String childPath) {
        this.childPath = childPath;
        return this;
    }

    public EmbeddedNodeChannel childPath(String childPath) {
        return setChildPath(childPath);
    }
}
