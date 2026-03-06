package blue.language.types.myos;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Agent")
@TypeBlueId("8s2rAFDtiB6sCwqeURkT4Lq7fcc2FXBkmX9B9p7R4Boc")
public class Agent {
    public String agentId;

    public Agent agentId(String agentId) {
        this.agentId = agentId;
        return this;
    }
}
