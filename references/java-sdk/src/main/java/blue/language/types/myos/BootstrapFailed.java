package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Bootstrap Failed")
public class BootstrapFailed {
    public String reason;

    public BootstrapFailed reason(String reason) {
        this.reason = reason;
        return this;
    }
}
