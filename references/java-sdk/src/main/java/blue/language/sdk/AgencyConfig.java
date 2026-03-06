package blue.language.sdk;

import blue.language.model.Node;
import blue.language.sdk.internal.TypeRef;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class AgencyConfig {

    private final String name;
    private final String token;
    private final String onBehalfOfChannel;
    private final String requestId;
    private final List<Class<?>> allowedTypes;
    private final List<String> allowedOperations;
    private final String statusPath;
    private final AccessConfig.PermissionTiming permissionTiming;
    private final Class<?> permissionTriggerEventClass;
    private final String permissionTriggerDocPath;

    public AgencyConfig(String name,
                        String token,
                        String onBehalfOfChannel,
                        String requestId,
                        List<Class<?>> allowedTypes,
                        List<String> allowedOperations,
                        String statusPath,
                        AccessConfig.PermissionTiming permissionTiming,
                        Class<?> permissionTriggerEventClass,
                        String permissionTriggerDocPath) {
        this.name = required(name, "name");
        this.token = required(token, "token");
        this.onBehalfOfChannel = required(onBehalfOfChannel, "onBehalfOfChannel");
        this.requestId = required(requestId, "requestId");
        this.allowedTypes = immutableTypes(allowedTypes);
        this.allowedOperations = immutableOperations(allowedOperations);
        this.statusPath = trimToNull(statusPath);
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

    public String onBehalfOfChannel() {
        return onBehalfOfChannel;
    }

    public String requestId() {
        return requestId;
    }

    public List<Class<?>> allowedTypes() {
        return allowedTypes;
    }

    public List<String> allowedOperations() {
        return allowedOperations;
    }

    public String statusPath() {
        return statusPath;
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

    public Node permissionNode() {
        Node permissions = new Node().properties(new LinkedHashMap<String, Node>());

        if (!allowedTypes.isEmpty()) {
            List<Node> typeItems = new ArrayList<Node>();
            for (Class<?> allowedType : allowedTypes) {
                typeItems.add(new Node().type(TypeRef.of(allowedType).asTypeNode()));
            }
            permissions.properties("allowedDocumentTypes", new Node().items(typeItems));
        }

        if (!allowedOperations.isEmpty()) {
            List<Node> operationItems = new ArrayList<Node>();
            for (String operation : allowedOperations) {
                operationItems.add(new Node().value(operation));
            }
            permissions.properties("allowedOperations", new Node().items(operationItems));
        }

        return permissions;
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

    private static String required(String value, String field) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(field + " is required");
        }
        return value.trim();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static List<Class<?>> immutableTypes(List<Class<?>> types) {
        List<Class<?>> normalized = new ArrayList<Class<?>>();
        if (types != null) {
            for (Class<?> type : types) {
                if (type != null) {
                    normalized.add(type);
                }
            }
        }
        return Collections.unmodifiableList(normalized);
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
