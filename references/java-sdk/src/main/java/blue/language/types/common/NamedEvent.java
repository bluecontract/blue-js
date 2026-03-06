package blue.language.types.common;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Common/Named Event")
@TypeBlueId("Common-Named-Event-Demo-BlueId")
public class NamedEvent {
    public String name;
    public Node payload;

    public NamedEvent name(String name) {
        this.name = name;
        return this;
    }

    public NamedEvent payload(Node payload) {
        this.payload = payload;
        return this;
    }
}
