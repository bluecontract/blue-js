package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Participant Resolved")
public class ParticipantResolved {
    public String channelKey;

    public ParticipantResolved channelKey(String channelKey) {
        this.channelKey = channelKey;
        return this;
    }
}
