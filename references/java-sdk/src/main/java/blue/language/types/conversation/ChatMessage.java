package blue.language.types.conversation;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Conversation/Chat Message")
@TypeBlueId("AkUKoKY1hHY1CytCrAXDPKCd4md1QGmn1WNcQtWBsyAD")
public class ChatMessage {
    public String message;

    public ChatMessage message(String message) {
        this.message = message;
        return this;
    }
}
