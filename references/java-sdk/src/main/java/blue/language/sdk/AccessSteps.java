package blue.language.sdk;

import blue.language.model.Node;
import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.SingleDocumentPermissionGrantRequested;
import blue.language.types.myos.SingleDocumentPermissionRevokeRequested;
import blue.language.types.myos.SubscribeToSessionRequested;

public final class AccessSteps {

    private final StepsBuilder parent;
    private final AccessConfig config;

    public AccessSteps(StepsBuilder parent, AccessConfig config) {
        if (parent == null) {
            throw new IllegalArgumentException("parent is required");
        }
        if (config == null) {
            throw new IllegalArgumentException("config is required");
        }
        this.parent = parent;
        this.config = config;
    }

    public StepsBuilder call(String operation, Object request) {
        return parent.myOs().callOperation(
                config.onBehalfOfChannel(),
                config.targetSessionId(),
                operation,
                request);
    }

    public StepsBuilder callExpr(String operation, String requestExpression) {
        return call(operation, DocBuilder.expr(requestExpression));
    }

    public StepsBuilder requestPermission() {
        return requestPermission("RequestPermission");
    }

    public StepsBuilder requestPermission(String stepName) {
        return parent.emitType(stepName,
                SingleDocumentPermissionGrantRequested.class,
                payload -> {
                    payload.put("onBehalfOf", config.onBehalfOfChannel());
                    payload.put("requestId", config.requestId());
                    payload.put("targetSessionId", config.targetSessionId());
                    payload.putNode("permissions", config.permissionsNode());
                    if (config.subscribeToCreatedSessions()) {
                        payload.put("grantSessionSubscriptionOnResult", true);
                    }
                });
    }

    public StepsBuilder subscribe() {
        return subscribe("Subscribe");
    }

    public StepsBuilder subscribe(String stepName) {
        Node eventList = new Node().items(new java.util.ArrayList<Node>());
        for (Class<?> eventType : config.subscriptionEvents()) {
            if (eventType == null) {
                continue;
            }
            eventList.getItems().add(new Node().type(blue.language.sdk.internal.TypeRef.of(eventType).asTypeNode()));
        }
        return parent.emitType(stepName,
                SubscribeToSessionRequested.class,
                payload -> {
                    payload.put("onBehalfOf", config.onBehalfOfChannel());
                    payload.put("targetSessionId", config.targetSessionId());
                    Node subscription = parent.subscriptionSpec(config.subscriptionId());
                    subscription.properties("events", eventList);
                    payload.putNode("subscription", subscription);
                });
    }

    public StepsBuilder revokePermission() {
        return revokePermission("RevokePermission");
    }

    public StepsBuilder revokePermission(String stepName) {
        return parent.emitType(stepName,
                SingleDocumentPermissionRevokeRequested.class,
                payload -> {
                    payload.put("onBehalfOf", config.onBehalfOfChannel());
                    payload.put("requestId", config.requestId());
                    payload.put("targetSessionId", config.targetSessionId());
                });
    }
}
