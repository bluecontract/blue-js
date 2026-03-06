package blue.language.sdk;

import blue.language.model.Node;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class AccessConfig {

    public enum PermissionTiming {
        ON_INIT,
        ON_EVENT,
        ON_DOC_CHANGE,
        MANUAL
    }

    private final String name;
    private final String token;
    private final Object targetSessionId;
    private final String onBehalfOfChannel;
    private final String requestId;
    private final String subscriptionId;
    private final boolean read;
    private final List<String> operations;
    private final String statusPath;
    private final boolean subscribeAfterGranted;
    private final List<Class<?>> subscriptionEvents;
    private final boolean subscribeToCreatedSessions;
    private final PermissionTiming permissionTiming;
    private final Class<?> permissionTriggerEventClass;
    private final String permissionTriggerDocPath;

    public AccessConfig(String name,
                        String token,
                        Object targetSessionId,
                        String onBehalfOfChannel,
                        String requestId,
                        String subscriptionId,
                        boolean read,
                        List<String> operations,
                        String statusPath,
                        boolean subscribeAfterGranted,
                        List<Class<?>> subscriptionEvents,
                        boolean subscribeToCreatedSessions,
                        PermissionTiming permissionTiming,
                        Class<?> permissionTriggerEventClass,
                        String permissionTriggerDocPath) {
        this.name = required(name, "name");
        this.token = required(token, "token");
        this.targetSessionId = required(targetSessionId, "targetSessionId");
        this.onBehalfOfChannel = required(onBehalfOfChannel, "onBehalfOfChannel");
        this.requestId = required(requestId, "requestId");
        this.subscriptionId = required(subscriptionId, "subscriptionId");
        this.read = read;
        this.operations = immutableOperations(operations);
        this.statusPath = trimToNull(statusPath);
        this.subscribeAfterGranted = subscribeAfterGranted;
        this.subscriptionEvents = immutableSubscriptionEvents(subscriptionEvents);
        this.subscribeToCreatedSessions = subscribeToCreatedSessions;
        this.permissionTiming = permissionTiming == null ? PermissionTiming.ON_INIT : permissionTiming;
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

    public String subscriptionId() {
        return subscriptionId;
    }

    public boolean read() {
        return read;
    }

    public List<String> operations() {
        return operations;
    }

    public String statusPath() {
        return statusPath;
    }

    public boolean subscribeAfterGranted() {
        return subscribeAfterGranted;
    }

    public List<Class<?>> subscriptionEvents() {
        return subscriptionEvents;
    }

    public boolean subscribeToCreatedSessions() {
        return subscribeToCreatedSessions;
    }

    public PermissionTiming permissionTiming() {
        return permissionTiming;
    }

    public Class<?> permissionTriggerEventClass() {
        return permissionTriggerEventClass;
    }

    public String permissionTriggerDocPath() {
        return permissionTriggerDocPath;
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

    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<String, Object>();
        out.put("name", name);
        out.put("token", token);
        out.put("targetSessionId", targetSessionId);
        out.put("onBehalfOfChannel", onBehalfOfChannel);
        out.put("requestId", requestId);
        out.put("subscriptionId", subscriptionId);
        out.put("read", read);
        out.put("operations", operations);
        out.put("statusPath", statusPath);
        out.put("subscribeAfterGranted", subscribeAfterGranted);
        out.put("subscriptionEvents", subscriptionEvents);
        out.put("subscribeToCreatedSessions", subscribeToCreatedSessions);
        out.put("permissionTiming", permissionTiming.name());
        out.put("permissionTriggerEventClass", permissionTriggerEventClass);
        out.put("permissionTriggerDocPath", permissionTriggerDocPath);
        return out;
    }

    private void validatePermissionTiming() {
        if (permissionTiming == PermissionTiming.ON_EVENT && permissionTriggerEventClass == null) {
            throw new IllegalArgumentException(
                    "permissionTriggerEventClass is required when permissionTiming is ON_EVENT");
        }
        if (permissionTiming == PermissionTiming.ON_DOC_CHANGE
                && (permissionTriggerDocPath == null || permissionTriggerDocPath.isEmpty())) {
            throw new IllegalArgumentException(
                    "permissionTriggerDocPath is required when permissionTiming is ON_DOC_CHANGE");
        }
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

    private static List<Class<?>> immutableSubscriptionEvents(List<Class<?>> events) {
        List<Class<?>> normalized = new ArrayList<Class<?>>();
        if (events != null) {
            for (Class<?> event : events) {
                if (event != null) {
                    normalized.add(event);
                }
            }
        }
        return Collections.unmodifiableList(normalized);
    }
}
