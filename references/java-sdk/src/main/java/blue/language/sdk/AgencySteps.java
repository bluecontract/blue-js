package blue.language.sdk;

import blue.language.model.Node;
import blue.language.sdk.internal.NodeObjectBuilder;
import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.StartWorkerSessionRequested;
import blue.language.types.myos.WorkerAgencyPermissionGrantRequested;

import java.util.function.Consumer;

public final class AgencySteps {

    private final StepsBuilder parent;
    private final AgencyConfig config;

    public AgencySteps(StepsBuilder parent, AgencyConfig config) {
        if (parent == null) {
            throw new IllegalArgumentException("parent is required");
        }
        if (config == null) {
            throw new IllegalArgumentException("config is required");
        }
        this.parent = parent;
        this.config = config;
    }

    public StepsBuilder startSession(String stepName,
                                     Node document,
                                     Consumer<AgencyBindingsBuilder> bindings) {
        return startSession(stepName, document, bindings, null);
    }

    public StepsBuilder startSession(String stepName,
                                     Node document,
                                     Consumer<AgencyBindingsBuilder> bindings,
                                     Consumer<AgencyOptionsBuilder> options) {
        if (document == null) {
            throw new IllegalArgumentException("document is required");
        }

        AgencyBindingsBuilder bindingsBuilder = new AgencyBindingsBuilder();
        if (bindings != null) {
            bindings.accept(bindingsBuilder);
        }

        AgencyOptionsBuilder optionsBuilder = new AgencyOptionsBuilder();
        if (options != null) {
            options.accept(optionsBuilder);
        }

        NodeObjectBuilder configPayload = NodeObjectBuilder.create()
                .putNode("document", document)
                .putNode("channelBindings", bindingsBuilder.buildNode());
        optionsBuilder.applyTo(configPayload);

        return parent.emitType(stepName,
                StartWorkerSessionRequested.class,
                payload -> {
                    payload.put("onBehalfOf", config.onBehalfOfChannel());
                    payload.putNode("config", configPayload.build());
                });
    }

    public StepsBuilder requestPermission() {
        return requestPermission("RequestAgencyPermission");
    }

    public StepsBuilder requestPermission(String stepName) {
        return parent.emitType(stepName,
                WorkerAgencyPermissionGrantRequested.class,
                payload -> {
                    payload.put("onBehalfOf", config.onBehalfOfChannel());
                    payload.put("requestId", config.requestId());
                    payload.putNode("workerAgencyPermissions", config.permissionNode());
                });
    }
}
