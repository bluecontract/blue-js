package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;
import blue.language.types.conversation.TimelineChannel;

@TypeAlias("MyOS/MyOS Timeline Channel")
@TypeBlueId("HCF8mXnX3dFjQ8osjxb4Wzm2Nm1DoXnTYuA5sPnV7NTs")
public class MyOsTimelineChannel extends TimelineChannel {
    public String accountId;
    public String email;

    @Override
    public MyOsTimelineChannel timelineId(String timelineId) {
        super.timelineId(timelineId);
        return this;
    }

    public MyOsTimelineChannel accountId(String accountId) {
        this.accountId = accountId;
        return this;
    }

    public MyOsTimelineChannel email(String email) {
        this.email = email;
        return this;
    }
}
