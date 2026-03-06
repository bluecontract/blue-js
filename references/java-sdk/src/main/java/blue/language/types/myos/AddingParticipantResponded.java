package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Adding Participant Responded")
@TypeBlueId("7LwtCE6Urr6JC8bC2RF7PD8Eu8rmjF7rtUwqjAN49GGv")
public class AddingParticipantResponded {
    public String channelKey;
    public String email;

    public AddingParticipantResponded channelKey(String channelKey) {
        this.channelKey = channelKey;
        return this;
    }

    public AddingParticipantResponded email(String email) {
        this.email = email;
        return this;
    }
}
