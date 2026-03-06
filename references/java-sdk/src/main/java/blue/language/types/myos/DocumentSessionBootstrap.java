package blue.language.types.myos;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

import java.util.Map;

@TypeAlias("MyOS/Document Session Bootstrap")
@TypeBlueId("84xMEnEYr3DPBuYZL3JtcsZBBTtRH9fEEJiPnk7ASj1o")
public class DocumentSessionBootstrap {
    public Node document;
    public Map<String, Node> channelBindings;
    public Node initialMessages;
    public Node capabilities;
    public String bootstrapStatus;
    public String bootstrapError;
    public Node initiatorSessionIds;
    public Node participantsState;
    public Node contracts;

    public DocumentSessionBootstrap document(Node document) {
        this.document = document;
        return this;
    }

    public DocumentSessionBootstrap channelBindings(Map<String, Node> channelBindings) {
        this.channelBindings = channelBindings;
        return this;
    }

    public DocumentSessionBootstrap initialMessages(Node initialMessages) {
        this.initialMessages = initialMessages;
        return this;
    }

    public DocumentSessionBootstrap capabilities(Node capabilities) {
        this.capabilities = capabilities;
        return this;
    }

    public DocumentSessionBootstrap bootstrapStatus(String bootstrapStatus) {
        this.bootstrapStatus = bootstrapStatus;
        return this;
    }

    public DocumentSessionBootstrap bootstrapError(String bootstrapError) {
        this.bootstrapError = bootstrapError;
        return this;
    }

    public DocumentSessionBootstrap initiatorSessionIds(Node initiatorSessionIds) {
        this.initiatorSessionIds = initiatorSessionIds;
        return this;
    }

    public DocumentSessionBootstrap participantsState(Node participantsState) {
        this.participantsState = participantsState;
        return this;
    }

    public DocumentSessionBootstrap contracts(Node contracts) {
        this.contracts = contracts;
        return this;
    }
}
