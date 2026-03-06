package blue.language.sdk;

import blue.language.model.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class LinkedAccessConfig {

    private final String name;
    private final String token;
    private final Object targetSessionId;
    private final String onBehalfOfChannel;
    private final String requestId;
    private final String statusPath;
    private final Map<String, LinkConfig> links;
    private final AccessConfig.PermissionTiming permissionTiming;
    private final Class<?> permissionTriggerEventClass;
    private final String permissionTriggerDocPath;

    public LinkedAccessConfig(String name,
                              String token,
                              Object targetSessionId,
                              String onBehalfOfChannel,
                              String requestId,
                              String statusPath,
                              Map<String, LinkConfig> links,
                              AccessConfig.PermissionTiming permissionTiming,
                              Class<?> permissionTriggerEventClass,
                              String permissionTriggerDocPath) {
        this.name = required(name, "name");
        this.token = required(token, "token");
        this.targetSessionId = required(targetSessionId, "targetSessionId");
        this.onBehalfOfChannel = required(onBehalfOfChannel, "onBehalfOfChannel");
        this.requestId = required(requestId, "requestId");
        this.statusPath = trimToNull(statusPath);
        this.links = immutableLinks(links);
        this.permissionTiming = permissionTiming == null ? AccessConfig.PermissionTiming.ON_INIT : permissionTiming;
        this.permissionTriggerEventClass = permissionTriggerEventClass;
        this.permissionTriggerDocPath = trimToNull(permissionTriggerDocPath);
        validatePermissionTiming();
    }

    public String name() {
        return name;
    }

    public String token() {
        return token;
    }

    public Object targetSessionId() {
        return targetSessionId;
    }

    public String onBehalfOfChannel() {
        return onBehalfOfChannel;
    }

    public String requestId() {
        return requestId;
    }

    public String statusPath() {
        return statusPath;
    }

    public Map<String, LinkConfig> links() {
        return links;
    }

    public AccessConfig.PermissionTiming permissionTiming() {
        return permissionTiming;
    }

    public Class<?> permissionTriggerEventClass() {
        return permissionTriggerEventClass;
    }

    public String permissionTriggerDocPath() {
        return permissionTriggerDocPath;
    }

    public Map<String, Node> linksAsNodeMap() {
        Map<String, Node> result = new LinkedHashMap<String, Node>();
        for (Map.Entry<String, LinkConfig> entry : links.entrySet()) {
            result.put(entry.getKey(), entry.getValue().permissionsNode());
        }
        return result;
    }

    private void validatePermissionTiming() {
        if (permissionTiming == AccessConfig.PermissionTiming.ON_EVENT && permissionTriggerEventClass == null) {
            throw new IllegalArgumentException(
                    "permissionTriggerEventClass is required when permissionTiming is ON_EVENT");
        }
        if (permissionTiming == AccessConfig.PermissionTiming.ON_DOC_CHANGE
                && (permissionTriggerDocPath == null || permissionTriggerDocPath.isEmpty())) {
            throw new IllegalArgumentException(
                    "permissionTriggerDocPath is required when permissionTiming is ON_DOC_CHANGE");
        }
    }

    private static Map<String, LinkConfig> immutableLinks(Map<String, LinkConfig> links) {
        Map<String, LinkConfig> result = new LinkedHashMap<String, LinkConfig>();
        if (links != null) {
            for (Map.Entry<String, LinkConfig> entry : links.entrySet()) {
                String key = entry.getKey();
                LinkConfig value = entry.getValue();
                if (key == null || key.trim().isEmpty()) {
                    continue;
                }
                if (value == null) {
                    continue;
                }
                result.put(key.trim(), value);
            }
        }
        return Collections.unmodifiableMap(result);
    }

    private static String required(String value, String field) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }

    private static Object required(Object value, String field) {
        if (value == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static final class LinkConfig {
        private final boolean read;
        private final List<String> operations;

        public LinkConfig(boolean read, List<String> operations) {
            this.read = read;
            this.operations = immutableOperations(operations);
        }

        public boolean read() {
            return read;
        }

        public List<String> operations() {
            return operations;
        }

        public Node permissionsNode() {
            MyOsPermissions permissions = MyOsPermissions.create();
            if (read) {
                permissions.read(true);
            }
            if (!operations.isEmpty()) {
                permissions.singleOps(operations.toArray(new String[0]));
            }
            return permissions.build();
        }

        private static List<String> immutableOperations(List<String> operations) {
            List<String> normalized = new ArrayList<String>();
            if (operations != null) {
                for (String operation : operations) {
                    if (operation == null || operation.trim().isEmpty()) {
                        continue;
                    }
                    normalized.add(operation.trim());
                }
            }
            return Collections.unmodifiableList(normalized);
        }
    }
}
