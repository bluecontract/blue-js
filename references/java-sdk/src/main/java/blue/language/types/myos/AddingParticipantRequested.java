package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Adding Participant Requested")
@TypeBlueId("AZEL7GJEXVcSPp3mgbRtqHYCHAvfBpqqc1k8b2HhQh4T")
public class AddingParticipantRequested {
    public String channelKey;
    public String email;

    public AddingParticipantRequested channelKey(String channelKey) {
        this.channelKey = channelKey;
        return this;
    }

    public AddingParticipantRequested email(String email) {
        this.email = email;
        return this;
    }
}
