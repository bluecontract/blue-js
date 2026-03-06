package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Removing Participant Requested")
@TypeBlueId("Hfoh2g4jJo8Tmk43YX34wVW5YXtL1ncZs7weXVKtTm4b")
public class RemovingParticipantRequested {
    public String channelKey;

    public RemovingParticipantRequested channelKey(String channelKey) {
        this.channelKey = channelKey;
        return this;
    }
}
