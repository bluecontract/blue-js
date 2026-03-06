package blue.language.sdk;

import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SingleDocumentPermissionRejected;
import blue.language.types.myos.SingleDocumentPermissionRevoked;
import blue.language.types.myos.SubscriptionToSessionFailed;
import blue.language.types.myos.SubscriptionToSessionInitiated;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;

public final class AccessBuilder<P extends DocBuilder<P>> {

    private final P parent;
    private final String name;
    private Object targetSessionId;
    private String onBehalfOfChannel;
    private boolean read;
    private final List<String> operations = new ArrayList<String>();
    private String statusPath;
    private boolean subscribeAfterGranted;
    private final List<Class<?>> subscriptionEvents = new ArrayList<Class<?>>();
    private boolean subscribeToCreatedSessions;

    private AccessConfig.PermissionTiming permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
    private Class<?> permissionTriggerEventClass;
    private String permissionTriggerDocPath;

    AccessBuilder(P parent, String name) {
        if (parent == null) {
            throw new IllegalArgumentException("parent is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("access name is required");
        }
        this.parent = parent;
        this.name = name.trim();
    }

    public AccessBuilder<P> targetSessionId(Object targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public AccessBuilder<P> onBehalfOf(String channelKey) {
        this.onBehalfOfChannel = channelKey;
        return this;
    }

    public AccessBuilder<P> read(boolean read) {
        this.read = read;
        return this;
    }

    public AccessBuilder<P> operations(String... operations) {
        if (operations != null) {
            this.operations.addAll(Arrays.asList(operations));
        }
        return this;
    }

    public AccessBuilder<P> statusPath(String statusPath) {
        this.statusPath = statusPath;
        return this;
    }

    public AccessBuilder<P> subscribeAfterGranted() {
        this.subscribeAfterGranted = true;
        return this;
    }

    public AccessBuilder<P> subscriptionEvents(Class<?>... eventTypes) {
        if (eventTypes != null) {
            this.subscriptionEvents.addAll(Arrays.asList(eventTypes));
        }
        return this;
    }

    public AccessBuilder<P> subscribeToCreatedSessions(boolean enabled) {
        this.subscribeToCreatedSessions = enabled;
        return this;
    }

    public AccessBuilder<P> requestPermissionOnInit() {
        this.permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public AccessBuilder<P> requestPermissionOnEvent(Class<?> eventTypeClass) {
        if (eventTypeClass == null) {
            throw new IllegalArgumentException("eventTypeClass is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_EVENT;
        this.permissionTriggerEventClass = eventTypeClass;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public AccessBuilder<P> requestPermissionOnDocChange(String path) {
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("path is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_DOC_CHANGE;
        this.permissionTriggerDocPath = path.trim();
        this.permissionTriggerEventClass = null;
        return this;
    }

    public AccessBuilder<P> requestPermissionManually() {
        this.permissionTiming = AccessConfig.PermissionTiming.MANUAL;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public P done() {
        validate();

        String token = DocBuilder.tokenOf(name, "ACCESS");
        String requestId = "REQ_ACCESS_" + token;
        String subscriptionId = "SUB_ACCESS_" + token;

        AccessConfig config = new AccessConfig(
                name,
                token,
                targetSessionId,
                onBehalfOfChannel,
                requestId,
                subscriptionId,
                read,
                operations,
                statusPath,
                subscribeAfterGranted,
                subscriptionEvents,
                subscribeToCreatedSessions,
                permissionTiming,
                permissionTriggerEventClass,
                permissionTriggerDocPath);
        parent.registerAccessConfig(config);

        if (config.statusPath() != null) {
            parent.field(config.statusPath(), "pending");
        }

        if (config.permissionTiming() != AccessConfig.PermissionTiming.MANUAL) {
            String workflowKey = "access" + token + "RequestPermission";
            Consumer<StepsBuilder> permissionStep = steps -> steps.myOs().requestSingleDocPermission(
                    config.onBehalfOfChannel(),
                    config.requestId(),
                    config.targetSessionId(),
                    config.permissionsNode(),
                    config.subscribeToCreatedSessions());
            switch (config.permissionTiming()) {
                case ON_INIT:
                    parent.onInit(workflowKey, permissionStep);
                    break;
                case ON_EVENT:
                    parent.onEvent(workflowKey, config.permissionTriggerEventClass(), permissionStep);
                    break;
                case ON_DOC_CHANGE:
                    parent.onDocChange(workflowKey, config.permissionTriggerDocPath(), permissionStep);
                    break;
                default:
                    break;
            }
        }

        parent.onMyOsResponse("access" + token + "Granted",
                SingleDocumentPermissionGranted.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAccessGranted", config.statusPath(), "granted");
                    }
                    if (config.subscribeAfterGranted()) {
                        Class<?>[] eventTypes = config.subscriptionEvents().toArray(new Class<?>[0]);
                        steps.myOs().subscribeToSession(
                                config.onBehalfOfChannel(),
                                config.targetSessionId(),
                                config.subscriptionId(),
                                eventTypes);
                    }
                });

        parent.onMyOsResponse("access" + token + "Rejected",
                SingleDocumentPermissionRejected.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAccessRejected", config.statusPath(), "rejected");
                    }
                });

        parent.onMyOsResponse("access" + token + "Revoked",
                SingleDocumentPermissionRevoked.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAccessRevoked", config.statusPath(), "revoked");
                    }
                });

        if (config.subscribeAfterGranted()) {
            parent.onSubscriptionUpdate("access" + token + "SubscriptionReady",
                    config.subscriptionId(),
                    SubscriptionToSessionInitiated.class,
                    steps -> {
                        if (config.statusPath() != null) {
                            steps.replaceValue("MarkAccessSubscribed", config.statusPath(), "subscribed");
                        }
                    });
            parent.onEvent("access" + token + "SubscriptionFailed",
                    SubscriptionToSessionFailed.class,
                    steps -> {
                        if (config.statusPath() != null) {
                            steps.replaceValue("MarkAccessSubscriptionFailed", config.statusPath(), "subscription-failed");
                        }
                    });
        }

        return parent;
    }

    private void validate() {
        if (targetSessionId == null) {
            throw new IllegalArgumentException("access('" + name + "'): targetSessionId is required");
        }
        if (onBehalfOfChannel == null || onBehalfOfChannel.trim().isEmpty()) {
            throw new IllegalArgumentException("access('" + name + "'): onBehalfOf is required");
        }
    }
}
