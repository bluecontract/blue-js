package blue.language.processor.model;

import blue.language.model.TypeBlueId;

@TypeBlueId({
        "HCF8mXnX3dFjQ8osjxb4Wzm2Nm1DoXnTYuA5sPnV7NTs",
        "MyOS/MyOS Timeline Channel",
        "MyOSTimelineChannel"
})
public class MyOSTimelineChannel extends TimelineChannel {

    private String accountId;
    private String email;

    public String getAccountId() {
        return accountId;
    }

    public MyOSTimelineChannel setAccountId(String accountId) {
        this.accountId = accountId;
        return this;
    }

    public MyOSTimelineChannel accountId(String accountId) {
        return setAccountId(accountId);
    }

    public String getEmail() {
        return email;
    }

    public MyOSTimelineChannel setEmail(String email) {
        this.email = email;
        return this;
    }

    public MyOSTimelineChannel email(String email) {
        return setEmail(email);
    }
}
