package blue.language.processor.model;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Processing Terminated Marker")
@TypeBlueId({
        "5NiEhupJ6uF54Q3vs4GwQX4UX4ExtwHpKRVvjKEHtvjR",
        "Processing Terminated Marker",
        "Core/Processing Terminated Marker",
        "ProcessingTerminatedMarker"
})
public class ProcessingTerminatedMarker extends MarkerContract {

    private String cause;
    private String reason;

    public String getCause() {
        return cause;
    }

    public ProcessingTerminatedMarker setCause(String cause) {
        this.cause = cause;
        return this;
    }

    public String getReason() {
        return reason;
    }

    public ProcessingTerminatedMarker setReason(String reason) {
        this.reason = reason;
        return this;
    }

    public ProcessingTerminatedMarker cause(String cause) {
        return setCause(cause);
    }

    public ProcessingTerminatedMarker reason(String reason) {
        return setReason(reason);
    }

    public Node toNode() {
        Node node = new Node()
                .type(new Node().blueId("5NiEhupJ6uF54Q3vs4GwQX4UX4ExtwHpKRVvjKEHtvjR"))
                .properties("cause", new Node().value(cause));
        if (reason != null) {
            node.properties("reason", new Node().value(reason));
        }
        return node;
    }
}
