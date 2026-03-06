package blue.language.sdk.ai;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class AIIntegrationConfig {

    public enum PermissionTiming {
        ON_INIT,
        ON_EVENT,
        ON_DOC_CHANGE,
        MANUAL
    }

    private final String name;
    private final String token;
    private final String sessionIdExpression;
    private final String permissionFromChannel;
    private final String statusPath;
    private final String contextPath;
    private final String requesterId;
    private final PermissionTiming permissionTiming;
    private final Class<?> permissionTriggerEventClass;
    private final String permissionTriggerDocPath;
    private final Map<String, AITaskTemplate> tasks;

    public AIIntegrationConfig(String name,
                               String token,
                               String sessionIdExpression,
                               String permissionFromChannel,
                               String statusPath,
                               String contextPath,
                               String requesterId,
                               PermissionTiming permissionTiming,
                               Class<?> permissionTriggerEventClass,
                               String permissionTriggerDocPath,
                               Map<String, AITaskTemplate> tasks) {
        this.name = required(name, "name");
        this.token = required(token, "token");
        this.sessionIdExpression = required(sessionIdExpression, "sessionIdExpression");
        this.permissionFromChannel = required(permissionFromChannel, "permissionFromChannel");
        this.statusPath = required(statusPath, "statusPath");
        this.contextPath = required(contextPath, "contextPath");
        this.requesterId = required(requesterId, "requesterId");
        this.permissionTiming = permissionTiming == null ? PermissionTiming.ON_INIT : permissionTiming;
        this.permissionTriggerEventClass = permissionTriggerEventClass;
        this.permissionTriggerDocPath = permissionTriggerDocPath == null ? null : permissionTriggerDocPath.trim();
        this.tasks = immutableTasks(tasks);
        validatePermissionTiming();
    }

    public String name() {
        return name;
    }

    public String token() {
        return token;
    }

    public String requestId() {
        return "REQ_" + token;
    }

    public String subscriptionId() {
        return "SUB_" + token;
    }

    public String sessionIdExpression() {
        return sessionIdExpression;
    }

    public String permissionFromChannel() {
        return permissionFromChannel;
    }

    public String statusPath() {
        return statusPath;
    }

    public String contextPath() {
        return contextPath;
    }

    public String requesterId() {
        return requesterId;
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

    public Map<String, AITaskTemplate> tasks() {
        return tasks;
    }

    public AITaskTemplate task(String taskName) {
        if (taskName == null) {
            return null;
        }
        return tasks.get(taskName.trim());
    }

    private static String required(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private static Map<String, AITaskTemplate> immutableTasks(Map<String, AITaskTemplate> tasks) {
        Map<String, AITaskTemplate> result = new LinkedHashMap<String, AITaskTemplate>();
        if (tasks != null) {
            for (Map.Entry<String, AITaskTemplate> entry : tasks.entrySet()) {
                String key = entry.getKey();
                AITaskTemplate value = entry.getValue();
                if (key == null) {
                    throw new IllegalArgumentException("Task key is required");
                }
                if (value == null) {
                    throw new IllegalArgumentException("Task '" + key + "' is required");
                }
                String normalizedKey = key.trim();
                if (normalizedKey.isEmpty()) {
                    throw new IllegalArgumentException("Task key is required");
                }
                if (result.containsKey(normalizedKey)) {
                    throw new IllegalArgumentException("Duplicate task key: " + normalizedKey);
                }
                result.put(normalizedKey, value);
            }
        }
        return Collections.unmodifiableMap(result);
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
}
