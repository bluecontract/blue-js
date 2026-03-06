package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("MyOS/Session Epoch Advanced")
@TypeBlueId("9CvxqAMJhqcFoLr5nXSEdWDZUMD383xhJtyFwXsCqD9E")
public class SessionEpochAdvanced {
    public String sessionId;
    public String timestamp;
    public Integer epoch;
    public Node document;

    public SessionEpochAdvanced sessionId(String sessionId) {
        this.sessionId = sessionId;
        return this;
    }

    public SessionEpochAdvanced timestamp(String timestamp) {
        this.timestamp = timestamp;
        return this;
    }

    public SessionEpochAdvanced epoch(Integer epoch) {
        this.epoch = epoch;
        return this;
    }

    public SessionEpochAdvanced document(Node document) {
        this.document = document;
        return this;
    }
}
