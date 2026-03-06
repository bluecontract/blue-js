package blue.language.sdk;

import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.WorkerAgencyPermissionGranted;
import blue.language.types.myos.WorkerAgencyPermissionRejected;
import blue.language.types.myos.WorkerAgencyPermissionRevoked;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;

public final class AgencyBuilder<P extends DocBuilder<P>> {

    private final P parent;
    private final String name;
    private String onBehalfOfChannel;
    private final List<Class<?>> allowedTypes = new ArrayList<Class<?>>();
    private final List<String> allowedOperations = new ArrayList<String>();
    private String statusPath;

    private AccessConfig.PermissionTiming permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
    private Class<?> permissionTriggerEventClass;
    private String permissionTriggerDocPath;

    AgencyBuilder(P parent, String name) {
        if (parent == null) {
            throw new IllegalArgumentException("parent is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("agency name is required");
        }
        this.parent = parent;
        this.name = name.trim();
    }

    public AgencyBuilder<P> onBehalfOf(String channelKey) {
        this.onBehalfOfChannel = channelKey;
        return this;
    }

    public AgencyBuilder<P> allowedTypes(Class<?>... allowedTypes) {
        if (allowedTypes != null) {
            this.allowedTypes.addAll(Arrays.asList(allowedTypes));
        }
        return this;
    }

    public AgencyBuilder<P> allowedOperations(String... allowedOperations) {
        if (allowedOperations != null) {
            this.allowedOperations.addAll(Arrays.asList(allowedOperations));
        }
        return this;
    }

    public AgencyBuilder<P> statusPath(String statusPath) {
        this.statusPath = statusPath;
        return this;
    }

    public AgencyBuilder<P> requestPermissionOnInit() {
        this.permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public AgencyBuilder<P> requestPermissionOnEvent(Class<?> eventTypeClass) {
        if (eventTypeClass == null) {
            throw new IllegalArgumentException("eventTypeClass is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_EVENT;
        this.permissionTriggerEventClass = eventTypeClass;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public AgencyBuilder<P> requestPermissionOnDocChange(String path) {
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("path is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_DOC_CHANGE;
        this.permissionTriggerDocPath = path.trim();
        this.permissionTriggerEventClass = null;
        return this;
    }

    public AgencyBuilder<P> requestPermissionManually() {
        this.permissionTiming = AccessConfig.PermissionTiming.MANUAL;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public P done() {
        validate();

        String token = DocBuilder.tokenOf(name, "AGENCY");
        String requestId = "REQ_AGENCY_" + token;

        AgencyConfig config = new AgencyConfig(
                name,
                token,
                onBehalfOfChannel,
                requestId,
                allowedTypes,
                allowedOperations,
                statusPath,
                permissionTiming,
                permissionTriggerEventClass,
                permissionTriggerDocPath);
        parent.registerAgencyConfig(config);

        if (config.statusPath() != null) {
            parent.field(config.statusPath(), "pending");
        }

        if (config.permissionTiming() != AccessConfig.PermissionTiming.MANUAL) {
            String workflowKey = "agency" + token + "RequestPermission";
            Consumer<StepsBuilder> permissionStep = steps -> steps.myOs().grantWorkerAgencyPermission(
                    config.onBehalfOfChannel(),
                    config.requestId(),
                    config.permissionNode());
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

        parent.onMyOsResponse("agency" + token + "Granted",
                WorkerAgencyPermissionGranted.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAgencyGranted", config.statusPath(), "granted");
                    }
                });

        parent.onMyOsResponse("agency" + token + "Rejected",
                WorkerAgencyPermissionRejected.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAgencyRejected", config.statusPath(), "rejected");
                    }
                });

        parent.onMyOsResponse("agency" + token + "Revoked",
                WorkerAgencyPermissionRevoked.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkAgencyRevoked", config.statusPath(), "revoked");
                    }
                });

        return parent;
    }

    private void validate() {
        if (onBehalfOfChannel == null || onBehalfOfChannel.trim().isEmpty()) {
            throw new IllegalArgumentException("agency('" + name + "'): onBehalfOf is required");
        }
    }
}
