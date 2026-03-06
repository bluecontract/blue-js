package blue.language.types.conversation;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Trigger Event")
@TypeBlueId("GxUtWr3eH9a6YQeioQkujEnsPjD5s9RU8ZhEfmsV1vuU")
public class TriggerEvent {
    public Node event;

    public TriggerEvent event(Node event) {
        this.event = event;
        return this;
    }
}
