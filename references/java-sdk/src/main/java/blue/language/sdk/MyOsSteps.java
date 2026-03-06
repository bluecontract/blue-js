package blue.language.sdk;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.sdk.internal.BootstrapOptionsBuilder;
import blue.language.sdk.internal.NodeObjectBuilder;
import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.myos.AddingParticipantRequested;
import blue.language.types.myos.CallOperationRequested;
import blue.language.types.myos.LinkedDocumentsPermissionGrantRequested;
import blue.language.types.myos.LinkedDocumentsPermissionRevokeRequested;
import blue.language.types.myos.RemovingParticipantRequested;
import blue.language.types.myos.SingleDocumentPermissionGrantRequested;
import blue.language.types.myos.SingleDocumentPermissionRevokeRequested;
import blue.language.types.myos.StartWorkerSessionRequested;
import blue.language.types.myos.SubscribeToSessionRequested;
import blue.language.types.myos.WorkerAgencyPermissionGrantRequested;
import blue.language.types.myos.WorkerAgencyPermissionRevokeRequested;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class MyOsSteps {

    private static final Blue BLUE = new Blue();

    private final StepsBuilder parent;
    private final String adminChannelKey;

    public MyOsSteps(StepsBuilder parent) {
        this(parent, "myOsAdminChannel");
    }

    public MyOsSteps(StepsBuilder parent, String adminChannelKey) {
        if (parent == null) {
            throw new IllegalArgumentException("parent cannot be null");
        }
        this.parent = parent;
        this.adminChannelKey = requireText(adminChannelKey, "adminChannelKey is required");
    }

    public StepsBuilder requestSingleDocPermission(String onBehalfOf,
                                                   String requestId,
                                                   Object targetSessionId,
                                                   Object permissions) {
        return requestSingleDocPermission(onBehalfOf, requestId, targetSessionId, permissions, false);
    }

    public StepsBuilder requestSingleDocPermission(String onBehalfOf,
                                                   String requestId,
                                                   Object targetSessionId,
                                                   Object permissions,
                                                   boolean grantSessionSubscriptionOnResult) {
        SingleDocumentPermissionGrantRequested event = new SingleDocumentPermissionGrantRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"))
                .permissions(toNode(permissions, true));
        if (grantSessionSubscriptionOnResult) {
            event.grantSessionSubscriptionOnResult(true);
        }
        return emitBean("RequestSingleDocumentPermission", SingleDocumentPermissionGrantRequested.class, event);
    }

    public StepsBuilder requestLinkedDocsPermission(String onBehalfOf,
                                                    String requestId,
                                                    Object targetSessionId,
                                                    Map<String, ?> links) {
        LinkedDocumentsPermissionGrantRequested event = new LinkedDocumentsPermissionGrantRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"))
                .links(toLinksNode(links));
        return emitBean("RequestLinkedDocumentsPermission", LinkedDocumentsPermissionGrantRequested.class, event);
    }

    public StepsBuilder revokeSingleDocPermission(String onBehalfOf,
                                                  String requestId,
                                                  Object targetSessionId) {
        SingleDocumentPermissionRevokeRequested event = new SingleDocumentPermissionRevokeRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"));
        return emitBean("RevokeSingleDocumentPermission", SingleDocumentPermissionRevokeRequested.class, event);
    }

    public StepsBuilder revokeLinkedDocsPermission(String onBehalfOf,
                                                   String requestId,
                                                   Object targetSessionId) {
        LinkedDocumentsPermissionRevokeRequested event = new LinkedDocumentsPermissionRevokeRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"));
        return emitBean("RevokeLinkedDocumentsPermission", LinkedDocumentsPermissionRevokeRequested.class, event);
    }

    public StepsBuilder addParticipant(String channelKey, String email) {
        AddingParticipantRequested event = new AddingParticipantRequested()
                .channelKey(requireText(channelKey, "channelKey is required"))
                .email(requireText(email, "email is required"));
        return emitBean("AddParticipant", AddingParticipantRequested.class, event);
    }

    public StepsBuilder removeParticipant(String channelKey) {
        RemovingParticipantRequested event = new RemovingParticipantRequested()
                .channelKey(requireText(channelKey, "channelKey is required"));
        return emitBean("RemoveParticipant", RemovingParticipantRequested.class, event);
    }

    public StepsBuilder callOperation(String onBehalfOf,
                                      Object targetSessionId,
                                      String operation,
                                      Object request) {
        CallOperationRequested event = new CallOperationRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"))
                .operation(requireText(operation, "operation is required"));
        if (request != null) {
            event.request(toNode(request, false));
        }
        return emitBean("CallOperation", CallOperationRequested.class, event);
    }

    public StepsBuilder subscribeToSession(String onBehalfOf,
                                           Object targetSessionId,
                                           String subscriptionId) {
        return subscribeToSession(onBehalfOf, targetSessionId, subscriptionId, (Class<?>[]) null);
    }

    public StepsBuilder subscribeToSession(String onBehalfOf,
                                           Object targetSessionId,
                                           String subscriptionId,
                                           Class<?>... eventTypes) {
        SubscribeToSessionRequested event = new SubscribeToSessionRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"))
                .subscription(BLUE.objectToNode(new SubscriptionSpec(
                        requireText(subscriptionId, "subscriptionId is required"),
                        buildSubscriptionEvents(eventTypes))));
        return emitBean("SubscribeToSession", SubscribeToSessionRequested.class, event);
    }

    public StepsBuilder startWorkerSession(String agentChannelKey, Node config) {
        StartWorkerSessionRequested event = new StartWorkerSessionRequested()
                .agentChannelKey(requireText(agentChannelKey, "agentChannelKey is required"))
                .config(config);
        return emitBean("StartWorkerSession", StartWorkerSessionRequested.class, event);
    }

    public StepsBuilder grantWorkerAgencyPermission(String onBehalfOf,
                                                    String requestId,
                                                    Object targetSessionId,
                                                    Object workerAgencyPermissions) {
        WorkerAgencyPermissionGrantRequested event = new WorkerAgencyPermissionGrantRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"))
                .workerAgencyPermissions(toNode(workerAgencyPermissions, true));
        return emitBean("GrantWorkerAgencyPermission", WorkerAgencyPermissionGrantRequested.class, event);
    }

    public StepsBuilder grantWorkerAgencyPermission(String onBehalfOf,
                                                    String requestId,
                                                    Object workerAgencyPermissions) {
        WorkerAgencyPermissionGrantRequested event = new WorkerAgencyPermissionGrantRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .workerAgencyPermissions(toNode(workerAgencyPermissions, true));
        return emitBean("GrantWorkerAgencyPermission", WorkerAgencyPermissionGrantRequested.class, event);
    }

    public StepsBuilder revokeWorkerAgencyPermission(String onBehalfOf,
                                                     String requestId,
                                                     Object targetSessionId) {
        WorkerAgencyPermissionRevokeRequested event = new WorkerAgencyPermissionRevokeRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"))
                .targetSessionId(asText(targetSessionId, "targetSessionId is required"));
        return emitBean("RevokeWorkerAgencyPermission", WorkerAgencyPermissionRevokeRequested.class, event);
    }

    public StepsBuilder revokeWorkerAgencyPermission(String onBehalfOf,
                                                     String requestId) {
        WorkerAgencyPermissionRevokeRequested event = new WorkerAgencyPermissionRevokeRequested()
                .onBehalfOf(requireText(onBehalfOf, "onBehalfOf is required"))
                .requestId(requireText(requestId, "requestId is required"));
        return emitBean("RevokeWorkerAgencyPermission", WorkerAgencyPermissionRevokeRequested.class, event);
    }

    public StepsBuilder bootstrapDocument(String stepName,
                                          Node document,
                                          Map<String, String> channelBindings) {
        return parent.bootstrapDocument(stepName, document, channelBindings,
                options -> options.assignee(adminChannelKey));
    }

    public StepsBuilder bootstrapDocument(String stepName,
                                          Node document,
                                          Map<String, String> channelBindings,
                                          java.util.function.Consumer<BootstrapOptionsBuilder> options) {
        return parent.bootstrapDocument(stepName, document, channelBindings, bootstrap -> {
            bootstrap.assignee(adminChannelKey);
            if (options != null) {
                options.accept(bootstrap);
            }
        });
    }

    private static Node toLinksNode(Map<String, ?> links) {
        Map<String, Object> normalized = new LinkedHashMap<String, Object>();
        if (links != null) {
            for (Map.Entry<String, ?> entry : links.entrySet()) {
                String key = entry.getKey();
                if (key == null || key.trim().isEmpty()) {
                    continue;
                }
                normalized.put(key.trim(), normalizePermissionValue(entry.getValue()));
            }
        }
        return BLUE.objectToNode(normalized);
    }

    private static Object normalizePermissionValue(Object value) {
        if (value == null) {
            return MyOsPermissions.create();
        }
        if (value instanceof MyOsPermissions || value instanceof Node) {
            return value;
        }
        return value;
    }

    private static Node toNode(Object value, boolean defaultToEmptyPermissions) {
        if (value == null) {
            if (defaultToEmptyPermissions) {
                return MyOsPermissions.create().build();
            }
            return null;
        }
        if (value instanceof Node) {
            return (Node) value;
        }
        if (value instanceof MyOsPermissions) {
            return ((MyOsPermissions) value).build();
        }
        return BLUE.objectToNode(value);
    }

    private static String asText(Object value, String message) {
        if (value == null) {
            throw new IllegalArgumentException(message);
        }
        if (value instanceof Node) {
            Object nodeValue = ((Node) value).getValue();
            if (nodeValue == null) {
                throw new IllegalArgumentException(message);
            }
            return String.valueOf(nodeValue);
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return text;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private StepsBuilder emitBean(String stepName, Class<?> eventTypeClass, Object eventBean) {
        Node payload = BLUE.objectToNode(eventBean);
        return parent.emitType(stepName, eventTypeClass, target -> copyProperties(payload, target));
    }

    private static void copyProperties(Node source, NodeObjectBuilder target) {
        if (source == null || source.getProperties() == null) {
            return;
        }
        for (Map.Entry<String, Node> entry : source.getProperties().entrySet()) {
            target.putNode(entry.getKey(), entry.getValue());
        }
    }

    private static final class SubscriptionSpec {
        public String id;
        public java.util.List<Object> events;

        private SubscriptionSpec(String id, java.util.List<Object> events) {
            this.id = id;
            this.events = events;
        }
    }

    private static List<Object> buildSubscriptionEvents(Class<?>... eventTypes) {
        List<Object> events = new ArrayList<Object>();
        if (eventTypes == null) {
            return events;
        }
        for (Class<?> eventType : eventTypes) {
            if (eventType == null) {
                continue;
            }
            events.add(new Node().type(blue.language.sdk.internal.TypeRef.of(eventType).asTypeNode()));
        }
        return events;
    }
}
