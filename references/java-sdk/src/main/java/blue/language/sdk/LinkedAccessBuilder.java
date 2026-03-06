package blue.language.sdk;

import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.LinkedDocumentsPermissionGranted;
import blue.language.types.myos.LinkedDocumentsPermissionRejected;
import blue.language.types.myos.LinkedDocumentsPermissionRevoked;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public final class LinkedAccessBuilder<P extends DocBuilder<P>> {

    private final P parent;
    private final String name;
    private Object targetSessionId;
    private String onBehalfOfChannel;
    private String statusPath;
    private final Map<String, LinkBuilder<P>> links = new LinkedHashMap<String, LinkBuilder<P>>();

    private AccessConfig.PermissionTiming permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
    private Class<?> permissionTriggerEventClass;
    private String permissionTriggerDocPath;

    LinkedAccessBuilder(P parent, String name) {
        if (parent == null) {
            throw new IllegalArgumentException("parent is required");
        }
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("linked access name is required");
        }
        this.parent = parent;
        this.name = name.trim();
    }

    public LinkedAccessBuilder<P> targetSessionId(Object targetSessionId) {
        this.targetSessionId = targetSessionId;
        return this;
    }

    public LinkedAccessBuilder<P> onBehalfOf(String channelKey) {
        this.onBehalfOfChannel = channelKey;
        return this;
    }

    public LinkedAccessBuilder<P> statusPath(String statusPath) {
        this.statusPath = statusPath;
        return this;
    }

    public LinkBuilder<P> link(String linkName) {
        if (linkName == null || linkName.trim().isEmpty()) {
            throw new IllegalArgumentException("link name is required");
        }
        String normalized = linkName.trim();
        LinkBuilder<P> builder = links.get(normalized);
        if (builder == null) {
            builder = new LinkBuilder<P>(this, normalized);
            links.put(normalized, builder);
        }
        return builder;
    }

    public LinkedAccessBuilder<P> requestPermissionOnInit() {
        this.permissionTiming = AccessConfig.PermissionTiming.ON_INIT;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public LinkedAccessBuilder<P> requestPermissionOnEvent(Class<?> eventTypeClass) {
        if (eventTypeClass == null) {
            throw new IllegalArgumentException("eventTypeClass is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_EVENT;
        this.permissionTriggerEventClass = eventTypeClass;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public LinkedAccessBuilder<P> requestPermissionOnDocChange(String path) {
        if (path == null || path.trim().isEmpty()) {
            throw new IllegalArgumentException("path is required");
        }
        this.permissionTiming = AccessConfig.PermissionTiming.ON_DOC_CHANGE;
        this.permissionTriggerDocPath = path.trim();
        this.permissionTriggerEventClass = null;
        return this;
    }

    public LinkedAccessBuilder<P> requestPermissionManually() {
        this.permissionTiming = AccessConfig.PermissionTiming.MANUAL;
        this.permissionTriggerEventClass = null;
        this.permissionTriggerDocPath = null;
        return this;
    }

    public P done() {
        validate();

        String token = DocBuilder.tokenOf(name, "LINKEDACCESS");
        String requestId = "REQ_LINKED_ACCESS_" + token;

        Map<String, LinkedAccessConfig.LinkConfig> linkConfigs = new LinkedHashMap<String, LinkedAccessConfig.LinkConfig>();
        for (Map.Entry<String, LinkBuilder<P>> entry : links.entrySet()) {
            LinkBuilder<P> builder = entry.getValue();
            linkConfigs.put(entry.getKey(), new LinkedAccessConfig.LinkConfig(builder.read, builder.operations));
        }

        LinkedAccessConfig config = new LinkedAccessConfig(
                name,
                token,
                targetSessionId,
                onBehalfOfChannel,
                requestId,
                statusPath,
                linkConfigs,
                permissionTiming,
                permissionTriggerEventClass,
                permissionTriggerDocPath);
        parent.registerLinkedAccessConfig(config);

        if (config.statusPath() != null) {
            parent.field(config.statusPath(), "pending");
        }

        if (config.permissionTiming() != AccessConfig.PermissionTiming.MANUAL) {
            String workflowKey = "linkedAccess" + token + "RequestPermission";
            Consumer<StepsBuilder> permissionStep = steps -> steps.myOs().requestLinkedDocsPermission(
                    config.onBehalfOfChannel(),
                    config.requestId(),
                    config.targetSessionId(),
                    config.linksAsNodeMap());
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

        parent.onMyOsResponse("linkedAccess" + token + "Granted",
                LinkedDocumentsPermissionGranted.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkLinkedAccessGranted", config.statusPath(), "granted");
                    }
                });

        parent.onMyOsResponse("linkedAccess" + token + "Rejected",
                LinkedDocumentsPermissionRejected.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkLinkedAccessRejected", config.statusPath(), "rejected");
                    }
                });

        parent.onMyOsResponse("linkedAccess" + token + "Revoked",
                LinkedDocumentsPermissionRevoked.class,
                config.requestId(),
                steps -> {
                    if (config.statusPath() != null) {
                        steps.replaceValue("MarkLinkedAccessRevoked", config.statusPath(), "revoked");
                    }
                });

        return parent;
    }

    private void validate() {
        if (targetSessionId == null) {
            throw new IllegalArgumentException("accessLinked('" + name + "'): targetSessionId is required");
        }
        if (onBehalfOfChannel == null || onBehalfOfChannel.trim().isEmpty()) {
            throw new IllegalArgumentException("accessLinked('" + name + "'): onBehalfOf is required");
        }
        if (links.isEmpty()) {
            throw new IllegalArgumentException("accessLinked('" + name + "'): at least one link(...) is required");
        }
    }

    public static final class LinkBuilder<P extends DocBuilder<P>> {
        private final LinkedAccessBuilder<P> parent;
        private final String linkName;
        private boolean read;
        private final List<String> operations = new ArrayList<String>();

        private LinkBuilder(LinkedAccessBuilder<P> parent, String linkName) {
            this.parent = parent;
            this.linkName = linkName;
        }

        public LinkBuilder<P> read(boolean read) {
            this.read = read;
            return this;
        }

        public LinkBuilder<P> operations(String... operations) {
            if (operations != null) {
                this.operations.addAll(Arrays.asList(operations));
            }
            return this;
        }

        public LinkedAccessBuilder<P> done() {
            parent.links.put(linkName, this);
            return parent;
        }
    }
}
