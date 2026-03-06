package blue.language.types.myos;

import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Worker Session Starting")
public class WorkerSessionStarting {
    public String targetSessionId;

    public WorkerSessionStarting targetSessionId(String targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }
}
