package blue.language.sdk;

import blue.language.model.Node;

import java.util.LinkedHashMap;

public final class CapabilitiesBuilder {

    private boolean participantsOrchestration;

    public CapabilitiesBuilder participantsOrchestration(boolean enabled) {
        this.participantsOrchestration = enabled;
        return this;
    }

    Node buildNode() {
        Node capabilities = new Node().properties(new LinkedHashMap<String, Node>());
        capabilities.properties("participantsOrchestration", new Node().value(participantsOrchestration));
        return capabilities;
    }
}
