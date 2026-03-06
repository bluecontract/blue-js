package blue.language.sdk;

import blue.language.Blue;
import blue.language.model.Constraints;
import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;
import blue.language.sdk.ai.AIIntegrationConfig;
import blue.language.sdk.ai.AITaskTemplate;
import blue.language.sdk.ai.NamedEventExpectation;
import blue.language.sdk.ai.TypeReference;
import blue.language.sdk.internal.ContractsBuilder;
import blue.language.sdk.internal.PoliciesBuilder;
import blue.language.sdk.internal.StepsBuilder;
import blue.language.sdk.internal.TypeAliases;
import blue.language.sdk.internal.TypeRef;
import blue.language.types.common.NamedEvent;
import blue.language.types.conversation.Response;
import blue.language.types.myos.AllParticipantsReady;
import blue.language.types.myos.BootstrapFailed;
import blue.language.types.myos.CallOperationResponded;
import blue.language.types.myos.LinkedDocumentsPermissionGranted;
import blue.language.types.myos.LinkedDocumentsPermissionRejected;
import blue.language.types.myos.LinkedDocumentsPermissionRevoked;
import blue.language.types.myos.ParticipantResolved;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SingleDocumentPermissionRejected;
import blue.language.types.myos.SingleDocumentPermissionRevoked;
import blue.language.types.myos.SubscribableSessionCreated;
import blue.language.types.myos.SubscriptionToSessionFailed;
import blue.language.types.myos.SubscriptionUpdate;
import blue.language.types.myos.SubscriptionToSessionInitiated;
import blue.language.types.myos.TargetDocumentSessionStarted;
import blue.language.types.myos.WorkerAgencyPermissionGranted;
import blue.language.types.myos.WorkerAgencyPermissionRejected;
import blue.language.types.myos.WorkerAgencyPermissionRevoked;
import blue.language.types.myos.WorkerSessionStarting;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

public class DocBuilder<T extends DocBuilder<T>> {

    private static final Blue BLUE = new Blue();

    protected final Node document;
    private final Map<String, AIIntegrationConfig> aiIntegrations =
            new LinkedHashMap<String, AIIntegrationConfig>();
    private final Map<String, AccessConfig> accessConfigs =
            new LinkedHashMap<String, AccessConfig>();
    private final Map<String, LinkedAccessConfig> linkedAccessConfigs =
            new LinkedHashMap<String, LinkedAccessConfig>();
    private final Map<String, AgencyConfig> agencyConfigs =
            new LinkedHashMap<String, AgencyConfig>();
    private SectionContext currentSection;
    private boolean myOsAdminEnsured;

    protected DocBuilder() {
        this.document = new Node();
    }

    protected DocBuilder(Node existingDocument) {
        require(existingDocument, "existing document");
        this.document = existingDocument;
    }

    public static SimpleDocBuilder doc() {
        return SimpleDocBuilder.doc();
    }

    public static SimpleDocBuilder edit(Node existingDocument) {
        return SimpleDocBuilder.edit(existingDocument);
    }

    public static SimpleDocBuilder from(Node existingDocument) {
        return SimpleDocBuilder.from(existingDocument);
    }

    @SuppressWarnings("unchecked")
    protected T self() {
        return (T) this;
    }

    public T name(String name) {
        document.name(name);
        return self();
    }

    public T description(String description) {
        document.description(description);
        return self();
    }

    public T type(String typeAlias) {
        document.type(typeAlias);
        return self();
    }

    public T type(Class<?> typeClass) {
        require(typeClass, "type class");
        document.type(TypeRef.of(typeClass).asTypeNode());
        return self();
    }

    public T section(String key, String title, String summary) {
        require(key, "section key");
        require(title, "section title");
        if (currentSection != null) {
            throw new IllegalStateException(
                    "Already in section '" + currentSection.key + "'. Call endSection() first.");
        }
        currentSection = sectionContextFromDocument(key.trim(), title.trim(), summary);
        if (currentSection == null) {
            currentSection = new SectionContext(key.trim(), title.trim(), summary);
        }
        return self();
    }

    public T section(String key) {
        require(key, "section key");
        if (currentSection != null) {
            throw new IllegalStateException(
                    "Already in section '" + currentSection.key + "'. Call endSection() first.");
        }
        String normalizedKey = key.trim();
        currentSection = sectionContextFromDocument(normalizedKey, normalizedKey, null);
        if (currentSection == null) {
            currentSection = new SectionContext(normalizedKey, normalizedKey, null);
        }
        return self();
    }

    public T endSection() {
        if (currentSection == null) {
            throw new IllegalStateException("Not in a section.");
        }
        contracts().putRaw(currentSection.key, currentSection.buildNode());
        currentSection = null;
        return self();
    }

    public T field(String path, Object value) {
        return set(path, value);
    }

    public FieldBuilder<T> field(String path) {
        trackField(path);
        return new FieldBuilder<T>(self(), path);
    }

    public T channel(String channelKey) {
        require(channelKey, "channel key");
        contracts().timelineChannel(channelKey);
        trackContract(channelKey);
        return self();
    }

    public T channel(String channelKey, Object channelContract) {
        require(channelKey, "channel key");
        require(channelContract, "channel contract");
        Node channelNode = BLUE.objectToNode(channelContract);
        pruneEmptyEventProperty(channelNode);
        channelNode.type(TypeRef.of(channelContract.getClass()).alias());
        contracts().putRaw(channelKey, channelNode);
        trackContract(channelKey);
        return self();
    }

    public T channels(String... channelKeys) {
        if (channelKeys == null) {
            return self();
        }
        for (String channelKey : channelKeys) {
            channel(channelKey);
        }
        return self();
    }

    public T compositeChannel(String compositeChannelKey, String... channelKeys) {
        require(compositeChannelKey, "composite channel key");
        contracts().compositeTimelineChannel(compositeChannelKey, channelKeys);
        trackContract(compositeChannelKey);
        return self();
    }

    public T operation(String key,
                       String channelKey,
                       String description,
                       Consumer<StepsBuilder> implementation) {
        return operation(key, channelKey, null, description, implementation);
    }

    public T operation(String key,
                       String channelKey,
                       String description) {
        return operation(key, channelKey, null, description, null);
    }

    public T operation(String key,
                       String channelKey,
                       Class<?> requestTypeClass,
                       String description) {
        return operation(key, channelKey, requestTypeClass, description, null);
    }

    public T operation(String key,
                       String channelKey,
                       Class<?> requestTypeClass,
                       String description,
                       Consumer<StepsBuilder> implementation) {
        require(key, "operation key");
        require(channelKey, "channel key");
        ContractsBuilder contracts = contracts();
        if (requestTypeClass == null) {
            contracts.operation(key, channelKey, description);
        } else {
            contracts.operation(key, channelKey, requestTypeClass, description);
        }
        if (implementation != null) {
            contracts.implementOperation(key + "Impl", key, implementation);
            trackContract(key + "Impl");
        }
        trackContract(key);
        return self();
    }

    public OperationBuilder<T> operation(String key) {
        return new OperationBuilder<T>(self(), key);
    }

    public T requestDescription(String operationKey, String requestDescription) {
        require(operationKey, "operation key");
        require(requestDescription, "request description");
        contracts().operationRequestDescription(operationKey, requestDescription);
        return self();
    }

    public T onChannelEvent(String workflowKey,
                            String channelKey,
                            Class<?> eventTypeClass,
                            Consumer<StepsBuilder> customizer) {
        require(workflowKey, "workflow key");
        require(channelKey, "channel key");
        require(eventTypeClass, "event type");
        require(customizer, "steps");
        contracts().onEvent(workflowKey, channelKey, eventTypeClass, customizer);
        trackContract(workflowKey);
        return self();
    }

    public T onEvent(String workflowKey,
                     Class<?> eventTypeClass,
                     Consumer<StepsBuilder> customizer) {
        require(workflowKey, "workflow key");
        require(eventTypeClass, "event type");
        require(customizer, "steps");
        ensureTriggeredChannel();
        contracts().onTriggered(workflowKey, eventTypeClass, customizer);
        trackContract(workflowKey);
        return self();
    }

    public T onNamedEvent(String workflowKey,
                          String eventName,
                          Consumer<StepsBuilder> customizer) {
        require(eventName, "event name");
        NamedEventMatcher matcher = new NamedEventMatcher();
        matcher.name = eventName.trim();
        return onTriggeredWithMatcher(workflowKey, NamedEvent.class, matcher, customizer);
    }

    public T onDocChange(String workflowKey, String path, Consumer<StepsBuilder> customizer) {
        require(workflowKey, "workflow key");
        require(path, "path");
        require(customizer, "steps");
        String channelKey = workflowKey + "DocUpdateChannel";
        ContractsBuilder contracts = contracts();
        contracts.documentUpdateChannel(channelKey, path);
        contracts.sequentialWorkflow(
                workflowKey,
                channelKey,
                new Node().type(TypeAliases.CORE_DOCUMENT_UPDATE),
                customizer);
        trackContract(channelKey);
        trackContract(workflowKey);
        return self();
    }

    public T onInit(String workflowKey, Consumer<StepsBuilder> customizer) {
        require(workflowKey, "workflow key");
        require(customizer, "steps");
        ensureInitChannel();
        contracts().onLifecycle(workflowKey, "initLifecycleChannel", customizer);
        trackContract(workflowKey);
        return self();
    }

    public T myOsAdmin() {
        contracts().putRaw("myOsAdminChannel", new Node().type("MyOS/MyOS Timeline"));
        trackContract("myOsAdminChannel");
        canEmit("myOsAdminChannel", "myOsEmit");
        myOsAdminEnsured = true;
        return self();
    }

    public T myOsAdmin(String channelKey) {
        require(channelKey, "channel key");
        contracts().putRaw(channelKey, new Node().type("MyOS/MyOS Timeline"));
        trackContract(channelKey);
        canEmit(channelKey, deriveEmitOperationKey(channelKey));
        myOsAdminEnsured = true;
        return self();
    }

    public T canEmit(String channelKey) {
        return canEmit(channelKey, deriveEmitOperationKey(channelKey));
    }

    public T canEmit(String channelKey, Class<?>... allowedEventTypes) {
        Node request = listRequestSchema();
        if (allowedEventTypes != null && allowedEventTypes.length > 0) {
            List<Node> allowed = new ArrayList<Node>();
            for (Class<?> eventType : allowedEventTypes) {
                if (eventType == null) {
                    continue;
                }
                allowed.add(new Node().type(TypeRef.of(eventType).asTypeNode()));
            }
            if (!allowed.isEmpty()) {
                request.properties("items", new Node().items(allowed));
            }
        }
        return canEmit(channelKey, deriveEmitOperationKey(channelKey), request);
    }

    public T canEmit(String channelKey, Object... allowedEventShapes) {
        Node request = listRequestSchema();
        if (allowedEventShapes != null && allowedEventShapes.length > 0) {
            List<Node> allowed = new ArrayList<Node>();
            for (Object shape : allowedEventShapes) {
                if (shape == null) {
                    continue;
                }
                allowed.add(toRequestNode(shape));
            }
            if (!allowed.isEmpty()) {
                request.properties("items", new Node().items(allowed));
            }
        }
        return canEmit(channelKey, deriveEmitOperationKey(channelKey), request);
    }

    private T canEmit(String channelKey, String operationKey) {
        return canEmit(channelKey, operationKey, listRequestSchema());
    }

    private T canEmit(String channelKey, String operationKey, Node requestSchema) {
        require(channelKey, "channel key");
        require(operationKey, "operation key");
        applyOperationFromBuilder(
                operationKey,
                channelKey,
                null,
                null,
                requestSchema,
                false,
                steps -> steps.jsRaw("EmitEvents", "return { events: event };"));
        return self();
    }

    public T onMyOsResponse(String workflowKey,
                            Class<?> responseEventTypeClass,
                            String requestId,
                            Consumer<StepsBuilder> customizer) {
        if (requestId == null || requestId.trim().isEmpty()) {
            return onTriggeredWithMatcher(workflowKey, responseEventTypeClass, null, customizer);
        }
        return onTriggeredWithId(workflowKey, responseEventTypeClass, "requestId", requestId, customizer);
    }

    public T onMyOsResponse(String workflowKey,
                            Class<?> responseEventTypeClass,
                            Consumer<StepsBuilder> customizer) {
        return onMyOsResponse(workflowKey, responseEventTypeClass, null, customizer);
    }

    public T directChange(String operationName,
                          String channelKey,
                          String description) {
        operation(operationName, channelKey, description, steps -> steps
                .jsRaw(
                        "CollectChangeset",
                        "const request = event?.message?.request ?? {}; return { events: [], changeset: request.changeset ?? [] };")
                .updateDocumentFromExpression("ApplyChangeset", "steps.CollectChangeset.changeset"));
        policies().contractsChangePolicy("direct-change", "operation applies request changeset");
        return self();
    }

    public T onTriggeredWithId(String workflowKey,
                               Class<?> eventClass,
                               String idFieldName,
                               String idValue,
                               Consumer<StepsBuilder> customizer) {
        require(idFieldName, "id field name");
        require(idValue, "id value");

        TriggeredIdMatcher matcher = new TriggeredIdMatcher();
        String normalizedField = idFieldName.trim();
        String normalizedValue = idValue.trim();
        if ("requestId".equals(normalizedField)) {
            matcher.requestId = normalizedValue;
            matcher.inResponseTo = new CorrelationRef();
            matcher.inResponseTo.requestId = normalizedValue;
        } else if ("subscriptionId".equals(normalizedField)) {
            matcher.subscriptionId = normalizedValue;
        } else {
            throw new IllegalArgumentException("Unsupported id field for matcher: " + normalizedField);
        }
        return onTriggeredWithMatcher(workflowKey, eventClass, matcher, customizer);
    }

    public T onTriggeredWithMatcher(String workflowKey,
                                    Class<?> eventClass,
                                    Object matcherBean,
                                    Consumer<StepsBuilder> customizer) {
        require(workflowKey, "workflow key");
        require(eventClass, "event class");
        require(customizer, "steps");
        ensureTriggeredChannel();

        Node matcher = matcherBean == null ? typeOnlyNode(eventClass) : BLUE.objectToNode(matcherBean);
        matcher.type(TypeRef.of(eventClass).alias());
        contracts().onTriggered(workflowKey, matcher, customizer);
        trackContract(workflowKey);
        return self();
    }

    public T onSubscriptionUpdate(String workflowKey,
                                  String subscriptionId,
                                  Class<?> updateTypeClass,
                                  Consumer<StepsBuilder> customizer) {
        require(subscriptionId, "subscription id");

        SubscriptionUpdateMatcher matcher = new SubscriptionUpdateMatcher();
        matcher.subscriptionId = subscriptionId.trim();
        if (updateTypeClass != null) {
            matcher.update = typeOnlyNode(updateTypeClass);
        }
        return onTriggeredWithMatcher(
                workflowKey,
                SubscriptionUpdate.class,
                matcher,
                customizer);
    }

    public T onSubscriptionUpdate(String workflowKey,
                                  String subscriptionId,
                                  Consumer<StepsBuilder> customizer) {
        return onSubscriptionUpdate(workflowKey, subscriptionId, null, customizer);
    }

    public AiIntegrationBuilder<T> ai(String integrationName) {
        ensureMyOsAdmin();
        return new AiIntegrationBuilder<T>(self(), integrationName);
    }

    public AccessBuilder<T> access(String accessName) {
        ensureMyOsAdmin();
        return new AccessBuilder<T>(self(), accessName);
    }

    public LinkedAccessBuilder<T> accessLinked(String linkedAccessName) {
        ensureMyOsAdmin();
        return new LinkedAccessBuilder<T>(self(), linkedAccessName);
    }

    public AgencyBuilder<T> agency(String agencyName) {
        ensureMyOsAdmin();
        return new AgencyBuilder<T>(self(), agencyName);
    }

    public T onAIResponse(String integrationName,
                          String workflowKey,
                          Consumer<StepsBuilder> customizer) {
        return onAIResponse(integrationName, workflowKey, Response.class, customizer);
    }

    public T onAIResponse(String integrationName,
                          String workflowKey,
                          Class<?> responseTypeClass,
                          Consumer<StepsBuilder> customizer) {
        return onAIResponse(integrationName, workflowKey, responseTypeClass, null, customizer);
    }

    public T onAIResponse(String integrationName,
                          String workflowKey,
                          Class<?> responseTypeClass,
                          String taskName,
                          Consumer<StepsBuilder> customizer) {
        require(responseTypeClass, "response type");
        require(customizer, "steps");
        AIIntegrationConfig integration = requireAiIntegration(integrationName);
        String normalizedTask = normalizeTaskName(taskName);
        if (normalizedTask != null && integration.task(normalizedTask) == null) {
            throw new IllegalStateException("Unknown task '" + normalizedTask
                    + "' for AI integration '" + integration.name() + "'");
        }

        SubscriptionUpdateMatcher matcher = new SubscriptionUpdateMatcher();
        matcher.subscriptionId = integration.subscriptionId();

        AIResponseMatcher responseMatcher = new AIResponseMatcher();
        responseMatcher.inResponseTo = new AIResponseInResponseToMatcher();
        responseMatcher.inResponseTo.incomingEvent = new AIIncomingEventMatcher();
        responseMatcher.inResponseTo.incomingEvent.requester = integration.requesterId();
        responseMatcher.inResponseTo.incomingEvent.taskName = normalizedTask;

        Node updateMatcher = BLUE.objectToNode(responseMatcher);
        updateMatcher.type(TypeRef.of(responseTypeClass).alias());
        matcher.update = updateMatcher;

        return onTriggeredWithMatcher(workflowKey, SubscriptionUpdate.class, matcher, steps -> {
            steps.replaceExpression("_SaveAIContext", integration.contextPath(), "event.update.context");
            customizer.accept(steps);
        });
    }

    public T onAIResponse(String integrationName,
                          String workflowKey,
                          String namedEventName,
                          Consumer<StepsBuilder> customizer) {
        return onAIResponse(integrationName, workflowKey, namedEventName, null, customizer);
    }

    public T onAIResponse(String integrationName,
                          String workflowKey,
                          String namedEventName,
                          String taskName,
                          Consumer<StepsBuilder> customizer) {
        require(namedEventName, "named event name");
        require(customizer, "steps");
        AIIntegrationConfig integration = requireAiIntegration(integrationName);
        String normalizedTask = normalizeTaskName(taskName);
        if (normalizedTask != null && integration.task(normalizedTask) == null) {
            throw new IllegalStateException("Unknown task '" + normalizedTask
                    + "' for AI integration '" + integration.name() + "'");
        }

        SubscriptionUpdateMatcher matcher = new SubscriptionUpdateMatcher();
        matcher.subscriptionId = integration.subscriptionId();

        AINamedEventResponseMatcher responseMatcher = new AINamedEventResponseMatcher();
        responseMatcher.name = namedEventName.trim();
        if (normalizedTask != null) {
            responseMatcher.inResponseTo = new AIResponseInResponseToMatcher();
            responseMatcher.inResponseTo.incomingEvent = new AIIncomingEventMatcher();
            responseMatcher.inResponseTo.incomingEvent.taskName = normalizedTask;
        }

        Node updateMatcher = BLUE.objectToNode(responseMatcher);
        updateMatcher.type(TypeRef.of(NamedEvent.class).alias());
        matcher.update = updateMatcher;

        return onTriggeredWithMatcher(workflowKey, SubscriptionUpdate.class, matcher, steps -> {
            steps.replaceExpression("_SaveAIContext", integration.contextPath(), "event.update.context");
            customizer.accept(steps);
        });
    }

    public T onAccessGranted(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AccessConfig config = requireAccessConfig(accessName);
        return onMyOsResponse(workflowKey, SingleDocumentPermissionGranted.class, config.requestId(), customizer);
    }

    public T onAccessRejected(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AccessConfig config = requireAccessConfig(accessName);
        return onMyOsResponse(workflowKey, SingleDocumentPermissionRejected.class, config.requestId(), customizer);
    }

    public T onAccessRevoked(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AccessConfig config = requireAccessConfig(accessName);
        return onMyOsResponse(workflowKey, SingleDocumentPermissionRevoked.class, config.requestId(), customizer);
    }

    public T onCallResponse(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAccessConfig(accessName);
        return onEvent(workflowKey, CallOperationResponded.class, customizer);
    }

    public T onCallResponse(String accessName,
                            String workflowKey,
                            Class<?> responseTypeClass,
                            Consumer<StepsBuilder> customizer) {
        requireAccessConfig(accessName);
        return onEvent(workflowKey, responseTypeClass, customizer);
    }

    public T onUpdate(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AccessConfig config = requireAccessConfig(accessName);
        return onSubscriptionUpdate(workflowKey, config.subscriptionId(), customizer);
    }

    public T onUpdate(String accessName,
                      String workflowKey,
                      Class<?> updateTypeClass,
                      Consumer<StepsBuilder> customizer) {
        AccessConfig config = requireAccessConfig(accessName);
        return onSubscriptionUpdate(workflowKey, config.subscriptionId(), updateTypeClass, customizer);
    }

    public T onSessionCreated(String accessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAccessConfig(accessName);
        return onEvent(workflowKey, SubscribableSessionCreated.class, customizer);
    }

    public T onLinkedAccessGranted(String linkedAccessName,
                                   String workflowKey,
                                   Consumer<StepsBuilder> customizer) {
        LinkedAccessConfig config = requireLinkedAccessConfig(linkedAccessName);
        return onMyOsResponse(workflowKey, LinkedDocumentsPermissionGranted.class, config.requestId(), customizer);
    }

    public T onLinkedAccessRejected(String linkedAccessName,
                                    String workflowKey,
                                    Consumer<StepsBuilder> customizer) {
        LinkedAccessConfig config = requireLinkedAccessConfig(linkedAccessName);
        return onMyOsResponse(workflowKey, LinkedDocumentsPermissionRejected.class, config.requestId(), customizer);
    }

    public T onLinkedAccessRevoked(String linkedAccessName,
                                   String workflowKey,
                                   Consumer<StepsBuilder> customizer) {
        LinkedAccessConfig config = requireLinkedAccessConfig(linkedAccessName);
        return onMyOsResponse(workflowKey, LinkedDocumentsPermissionRevoked.class, config.requestId(), customizer);
    }

    public T onLinkedDocGranted(String linkedAccessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireLinkedAccessConfig(linkedAccessName);
        return onEvent(workflowKey, SingleDocumentPermissionGranted.class, customizer);
    }

    public T onLinkedDocRevoked(String linkedAccessName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireLinkedAccessConfig(linkedAccessName);
        return onEvent(workflowKey, SingleDocumentPermissionRevoked.class, customizer);
    }

    public T onAgencyGranted(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AgencyConfig config = requireAgencyConfig(agencyName);
        return onMyOsResponse(workflowKey, WorkerAgencyPermissionGranted.class, config.requestId(), customizer);
    }

    public T onAgencyRejected(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AgencyConfig config = requireAgencyConfig(agencyName);
        return onMyOsResponse(workflowKey, WorkerAgencyPermissionRejected.class, config.requestId(), customizer);
    }

    public T onAgencyRevoked(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        AgencyConfig config = requireAgencyConfig(agencyName);
        return onMyOsResponse(workflowKey, WorkerAgencyPermissionRevoked.class, config.requestId(), customizer);
    }

    public T onSessionStarting(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAgencyConfig(agencyName);
        return onEvent(workflowKey, WorkerSessionStarting.class, customizer);
    }

    public T onSessionStarted(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAgencyConfig(agencyName);
        return onEvent(workflowKey, TargetDocumentSessionStarted.class, customizer);
    }

    public T onSessionFailed(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAgencyConfig(agencyName);
        return onEvent(workflowKey, BootstrapFailed.class, customizer);
    }

    public T onParticipantResolved(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAgencyConfig(agencyName);
        return onEvent(workflowKey, ParticipantResolved.class, customizer);
    }

    public T onAllParticipantsReady(String agencyName, String workflowKey, Consumer<StepsBuilder> customizer) {
        requireAgencyConfig(agencyName);
        return onEvent(workflowKey, AllParticipantsReady.class, customizer);
    }

    protected T set(String pointer, Object value) {
        setPointer(pointer, toNode(value));
        trackField(pointer);
        return self();
    }

    public T replace(String pointer, Object value) {
        setPointer(pointer, toNode(value));
        trackField(pointer);
        return self();
    }

    public T remove(String pointer) {
        removePointer(pointer);
        return self();
    }

    public Node buildDocument() {
        if (currentSection != null) {
            throw new IllegalStateException(
                    "Unclosed section: '" + currentSection.key + "'. Call endSection() before buildDocument().");
        }
        return document;
    }

    protected void trackField(String path) {
        if (currentSection == null) {
            return;
        }
        currentSection.addField(PointerUtils.normalizeRequiredPointer(path, "field path"));
    }

    protected void trackContract(String key) {
        if (currentSection == null || key == null || key.trim().isEmpty()) {
            return;
        }
        currentSection.addContract(key.trim());
    }

    public static String expr(String expression) {
        if (expression == null) {
            return null;
        }
        String trimmed = expression.trim();
        return trimmed.startsWith("${") ? trimmed : "${" + trimmed + "}";
    }

    private ContractsBuilder contracts() {
        return new ContractsBuilder(
                ensureMap(document, "contracts"),
                aiIntegrations,
                accessConfigs,
                linkedAccessConfigs,
                agencyConfigs);
    }

    private PoliciesBuilder policies() {
        return new PoliciesBuilder(ensureMap(document, "policies"));
    }

    private static Node toNode(Object value) {
        if (value instanceof Node) {
            return (Node) value;
        }
        if (value == null
                || value instanceof String
                || value instanceof Number
                || value instanceof Boolean
                || value instanceof Character) {
            return new Node().value(value);
        }
        if (value instanceof Map<?, ?> || value instanceof Collection<?>) {
            return BLUE.objectToNode(value);
        }
        if (value.getClass().isArray()) {
            return BLUE.objectToNode(value);
        }
        if (value.getClass().getName().startsWith("java.time.")) {
            return new Node().value(value.toString());
        }
        return BLUE.objectToNode(value);
    }

    private static Node toRequestNode(Object value) {
        if (value instanceof Node) {
            return ((Node) value).clone();
        }
        return BLUE.objectToNode(value);
    }

    AccessConfig requireAccessConfig(String accessName) {
        require(accessName, "access name");
        AccessConfig config = accessConfigs.get(accessName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown access: " + accessName);
        }
        return config;
    }

    LinkedAccessConfig requireLinkedAccessConfig(String linkedAccessName) {
        require(linkedAccessName, "linked access name");
        LinkedAccessConfig config = linkedAccessConfigs.get(linkedAccessName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown linked access: " + linkedAccessName);
        }
        return config;
    }

    AgencyConfig requireAgencyConfig(String agencyName) {
        require(agencyName, "agency name");
        AgencyConfig config = agencyConfigs.get(agencyName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown agency: " + agencyName);
        }
        return config;
    }

    T registerAccessConfig(AccessConfig config) {
        require(config, "access config");
        if (accessConfigs.containsKey(config.name())) {
            throw new IllegalStateException("Duplicate access config: " + config.name());
        }
        accessConfigs.put(config.name(), config);
        return self();
    }

    T registerLinkedAccessConfig(LinkedAccessConfig config) {
        require(config, "linked access config");
        if (linkedAccessConfigs.containsKey(config.name())) {
            throw new IllegalStateException("Duplicate linked access config: " + config.name());
        }
        linkedAccessConfigs.put(config.name(), config);
        return self();
    }

    T registerAgencyConfig(AgencyConfig config) {
        require(config, "agency config");
        if (agencyConfigs.containsKey(config.name())) {
            throw new IllegalStateException("Duplicate agency config: " + config.name());
        }
        agencyConfigs.put(config.name(), config);
        return self();
    }

    private void ensureMyOsAdmin() {
        if (myOsAdminEnsured) {
            return;
        }
        myOsAdmin();
    }

    static String tokenOf(String input, String fallback) {
        if (input == null) {
            return fallback;
        }
        StringBuilder token = new StringBuilder();
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                token.append(Character.toUpperCase(c));
            }
        }
        if (token.length() == 0) {
            return fallback;
        }
        return token.toString();
    }

    private static Node listRequestSchema() {
        return new Node().type("List");
    }

    private AIIntegrationConfig requireAiIntegration(String integrationName) {
        require(integrationName, "ai integration");
        AIIntegrationConfig config = aiIntegrations.get(integrationName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown AI integration: " + integrationName);
        }
        return config;
    }

    T registerAiIntegration(AiIntegrationDefinition definition) {
        String name = definition.name.trim();
        String sessionId = definition.sessionId.trim();
        String permissionFrom = definition.permissionFrom.trim();
        String requesterId = definition.requesterId.trim();
        String statusPath = definition.statusPath.trim();
        String contextPath = definition.contextPath.trim();

        String token = aiToken(name);
        AIIntegrationConfig config = new AIIntegrationConfig(
                name,
                token,
                sessionId,
                permissionFrom,
                statusPath,
                contextPath,
                requesterId,
                definition.permissionTiming,
                definition.permissionTriggerEventClass,
                definition.permissionTriggerDocPath,
                definition.tasks);
        if (aiIntegrations.containsKey(name)) {
            throw new IllegalStateException("Duplicate AI integration: " + name);
        }
        aiIntegrations.put(name, config);

        set(statusPath, "pending");
        set(contextPath, new Node().properties(new LinkedHashMap<String, Node>()));

        String keyPrefix = "ai" + token;
        Consumer<StepsBuilder> permissionSteps = steps -> steps.myOs().requestSingleDocPermission(
                permissionFrom,
                config.requestId(),
                sessionId,
                MyOsPermissions.create().read(true).singleOps("provideInstructions"));

        switch (config.permissionTiming()) {
            case ON_INIT:
                onInit(keyPrefix + "RequestPermission", permissionSteps);
                break;
            case ON_EVENT:
                if (config.permissionTriggerEventClass() == null) {
                    throw new IllegalStateException("ai('" + name
                            + "'): requestPermissionOnEvent requires event class");
                }
                onEvent(keyPrefix + "RequestPermission",
                        config.permissionTriggerEventClass(),
                        permissionSteps);
                break;
            case ON_DOC_CHANGE:
                if (config.permissionTriggerDocPath() == null
                        || config.permissionTriggerDocPath().trim().isEmpty()) {
                    throw new IllegalStateException("ai('" + name
                            + "'): requestPermissionOnDocChange requires path");
                }
                onDocChange(keyPrefix + "RequestPermission",
                        config.permissionTriggerDocPath(),
                        permissionSteps);
                break;
            case MANUAL:
                break;
            default:
                throw new IllegalStateException("Unsupported permission timing: " + config.permissionTiming());
        }

        onMyOsResponse(keyPrefix + "Subscribe",
                SingleDocumentPermissionGranted.class,
                config.requestId(),
                steps -> steps.myOs().subscribeToSession(permissionFrom, sessionId, config.subscriptionId()));

        onSubscriptionUpdate(keyPrefix + "SubscriptionReady",
                config.subscriptionId(),
                SubscriptionToSessionInitiated.class,
                steps -> steps.replaceValue("Mark" + token + "Ready", statusPath, "ready"));

        onMyOsResponse(keyPrefix + "PermissionRejected",
                SingleDocumentPermissionRejected.class,
                config.requestId(),
                steps -> steps.replaceValue("Mark" + token + "Revoked", statusPath, "revoked"));

        return self();
    }

    private static String normalizeTaskName(String taskName) {
        if (taskName == null) {
            return null;
        }
        String normalized = taskName.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String aiToken(String name) {
        StringBuilder token = new StringBuilder();
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                token.append(Character.toUpperCase(c));
            }
        }
        if (token.length() == 0) {
            token.append("AI");
        }
        return token.toString();
    }

    private void ensureTriggeredChannel() {
        Map<String, Node> contracts = ensureMap(document, "contracts");
        if (!contracts.containsKey("triggeredEventChannel")) {
            new ContractsBuilder(contracts, aiIntegrations, accessConfigs, linkedAccessConfigs, agencyConfigs)
                    .triggeredEventChannel("triggeredEventChannel");
        }
    }

    private void ensureInitChannel() {
        Map<String, Node> contracts = ensureMap(document, "contracts");
        if (!contracts.containsKey("initLifecycleChannel")) {
            new ContractsBuilder(contracts, aiIntegrations, accessConfigs, linkedAccessConfigs, agencyConfigs)
                    .lifecycleEventChannel(
                    "initLifecycleChannel",
                    TypeAliases.CORE_DOCUMENT_PROCESSING_INITIATED);
        }
    }

    private static Map<String, Node> ensureProperties(Node node) {
        if (node.getProperties() == null) {
            node.properties(new LinkedHashMap<String, Node>());
        }
        return node.getProperties();
    }

    private static Map<String, Node> ensureMap(Node parent, String key) {
        Map<String, Node> props = ensureProperties(parent);
        Node child = props.get(key);
        if (child == null) {
            child = new Node().properties(new LinkedHashMap<String, Node>());
            props.put(key, child);
        } else if (child.getProperties() == null) {
            child.properties(new LinkedHashMap<String, Node>());
        }
        return child.getProperties();
    }

    private SectionContext sectionContextFromDocument(String sectionKey,
                                                      String fallbackTitle,
                                                      String fallbackSummary) {
        Map<String, Node> contracts = ensureMap(document, "contracts");
        Node section = contracts.get(sectionKey);
        if (section == null) {
            return null;
        }

        String title = fallbackTitle;
        String summary = fallbackSummary;
        if (section.getProperties() != null) {
            Node titleNode = section.getProperties().get("title");
            if (titleNode != null && titleNode.getValue() != null) {
                title = String.valueOf(titleNode.getValue());
            }
            if (fallbackSummary == null) {
                Node summaryNode = section.getProperties().get("summary");
                if (summaryNode != null && summaryNode.getValue() != null) {
                    summary = String.valueOf(summaryNode.getValue());
                }
            }
        }

        SectionContext context = new SectionContext(sectionKey, title, summary);
        if (section.getProperties() == null) {
            return context;
        }
        readStringList(section.getProperties().get("relatedFields"), context.fields);
        readStringList(section.getProperties().get("relatedContracts"), context.contracts);
        return context;
    }

    private static void readStringList(Node listNode, Set<String> sink) {
        if (listNode == null || listNode.getItems() == null) {
            return;
        }
        for (Node item : listNode.getItems()) {
            if (item == null || item.getValue() == null) {
                continue;
            }
            String value = String.valueOf(item.getValue()).trim();
            if (!value.isEmpty()) {
                sink.add(value);
            }
        }
    }

    private void setPointer(String pointer, Node valueNode) {
        String normalized = PointerUtils.normalizeRequiredPointer(pointer, "pointer");
        if ("/".equals(normalized)) {
            throw new IllegalArgumentException("pointer cannot target root");
        }
        List<String> segments = PointerUtils.splitPointerSegmentsList(normalized);
        Node current = document;
        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            String nextSegment = segments.get(i + 1);
            current = descendOrCreate(current, segment, nextSegment, normalized);
        }
        String leaf = segments.get(segments.size() - 1);
        assign(current, leaf, valueNode, normalized);
    }

    private void removePointer(String pointer) {
        String normalized = PointerUtils.normalizeRequiredPointer(pointer, "pointer");
        if ("/".equals(normalized)) {
            throw new IllegalArgumentException("pointer cannot target root");
        }
        List<String> segments = PointerUtils.splitPointerSegmentsList(normalized);
        Node current = document;
        for (int i = 0; i < segments.size() - 1; i++) {
            current = descendExisting(current, segments.get(i), normalized);
            if (current == null) {
                return;
            }
        }
        String leaf = segments.get(segments.size() - 1);
        if (current.getItems() != null) {
            int index = PointerUtils.parseArrayIndex(leaf);
            if (index >= 0 && index < current.getItems().size()) {
                current.getItems().remove(index);
            }
            return;
        }
        if (current.getProperties() != null) {
            current.getProperties().remove(leaf);
        }
    }

    private Node descendOrCreate(Node current,
                                 String segment,
                                 String nextSegment,
                                 String fullPath) {
        if (current.getItems() != null) {
            int index = PointerUtils.parseArrayIndex(segment);
            if (index < 0) {
                throw new IllegalArgumentException("Expected numeric array segment in path: " + fullPath);
            }
            List<Node> items = current.getItems();
            while (items.size() <= index) {
                items.add(new Node());
            }
            Node child = items.get(index);
            if (child == null) {
                child = new Node();
                items.set(index, child);
            }
            ensureContainerForNextSegment(child, nextSegment);
            return child;
        }
        Map<String, Node> properties = ensureProperties(current);
        Node child = properties.get(segment);
        if (child == null) {
            child = new Node();
            properties.put(segment, child);
        }
        ensureContainerForNextSegment(child, nextSegment);
        return child;
    }

    private Node descendExisting(Node current, String segment, String fullPath) {
        if (current.getItems() != null) {
            int index = PointerUtils.parseArrayIndex(segment);
            if (index < 0) {
                throw new IllegalArgumentException("Expected numeric array segment in path: " + fullPath);
            }
            if (index >= current.getItems().size()) {
                return null;
            }
            return current.getItems().get(index);
        }
        if (current.getProperties() == null) {
            return null;
        }
        return current.getProperties().get(segment);
    }

    private void assign(Node current, String leaf, Node value, String fullPath) {
        if (current.getItems() != null) {
            int index = PointerUtils.parseArrayIndex(leaf);
            if (index < 0) {
                throw new IllegalArgumentException("Expected numeric array segment in path: " + fullPath);
            }
            List<Node> items = current.getItems();
            while (items.size() <= index) {
                items.add(new Node());
            }
            items.set(index, value);
            return;
        }
        ensureProperties(current).put(leaf, value);
    }

    private void ensureContainerForNextSegment(Node node, String nextSegment) {
        if (node.getProperties() != null || node.getItems() != null) {
            return;
        }
        if (PointerUtils.isArrayIndexSegment(nextSegment)) {
            node.items(new ArrayList<Node>());
        } else {
            node.properties(new LinkedHashMap<String, Node>());
        }
    }

    private static void require(Object value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (value instanceof String && ((String) value).trim().isEmpty()) {
            throw new IllegalArgumentException(name + " is required");
        }
    }

    protected T applyOperationFromBuilder(String key,
                                          String channelKey,
                                          String description,
                                          Class<?> requestTypeClass,
                                          Object requestSchema,
                                          boolean clearRequest,
                                          Consumer<StepsBuilder> implementation) {
        Map<String, Node> contractsMap = ensureMap(document, "contracts");
        Node operation = contractsMap.get(key);
        if (operation == null) {
            operation = new Node().type(TypeAliases.CONVERSATION_OPERATION);
            contractsMap.put(key, operation);
        } else {
            operation.type(TypeAliases.CONVERSATION_OPERATION);
        }

        String resolvedChannel = channelKey;
        if (resolvedChannel == null || resolvedChannel.trim().isEmpty()) {
            resolvedChannel = operation.getProperties() != null && operation.getProperties().get("channel") != null
                    ? String.valueOf(operation.getProperties().get("channel").getValue())
                    : null;
        }
        require(resolvedChannel, "channel");
        operation.properties("channel", new Node().value(resolvedChannel.trim()));

        if (description != null) {
            operation.properties("description", new Node().value(description));
        }

        if (requestSchema != null) {
            operation.properties("request", toRequestNode(requestSchema));
        } else if (requestTypeClass != null) {
            operation.properties("request", new Node().type(TypeRef.of(requestTypeClass).asTypeNode()));
        } else if (clearRequest && operation.getProperties() != null) {
            operation.getProperties().remove("request");
        }

        contractsMap.put(key, operation);
        trackContract(key);
        if (implementation != null) {
            contracts().implementOperation(key + "Impl", key, implementation);
            trackContract(key + "Impl");
        }
        return self();
    }

    private static String deriveEmitOperationKey(String channelKey) {
        String trimmed = channelKey.trim();
        if (trimmed.endsWith("Channel") && trimmed.length() > "Channel".length()) {
            return trimmed.substring(0, trimmed.length() - "Channel".length()) + "Emit";
        }
        return trimmed + "Emit";
    }

    private static Node typeOnlyNode(Class<?> typeClass) {
        try {
            Object instance = typeClass.getDeclaredConstructor().newInstance();
            return BLUE.objectToNode(instance);
        } catch (Exception ignored) {
            return new Node().type(TypeRef.of(typeClass).asTypeNode());
        }
    }

    private static void pruneEmptyEventProperty(Node channelNode) {
        if (channelNode == null || channelNode.getProperties() == null) {
            return;
        }
        Node event = channelNode.getProperties().get("event");
        if (event == null) {
            return;
        }
        boolean emptyObject = event.getValue() == null
                && event.getType() == null
                && event.getBlueId() == null
                && event.getItems() == null
                && (event.getProperties() == null || event.getProperties().isEmpty());
        if (emptyObject) {
            channelNode.getProperties().remove("event");
        }
    }

    private static final class TriggeredIdMatcher {
        public String requestId;
        public String subscriptionId;
        public CorrelationRef inResponseTo;
    }

    private static final class CorrelationRef {
        public String requestId;
    }

    private static final class SubscriptionUpdateMatcher {
        public String subscriptionId;
        public Node update;
    }

    private static final class AIResponseMatcher {
        public AIResponseInResponseToMatcher inResponseTo;
    }

    private static final class AINamedEventResponseMatcher {
        public String name;
        public AIResponseInResponseToMatcher inResponseTo;
    }

    private static final class AIResponseInResponseToMatcher {
        public AIIncomingEventMatcher incomingEvent;
    }

    private static final class AIIncomingEventMatcher {
        public String requester;
        public String taskName;
    }

    private static final class NamedEventMatcher {
        public String name;
    }

    private static final class AiIntegrationDefinition {
        public String name;
        public String sessionId;
        public String permissionFrom;
        public String statusPath;
        public String contextPath;
        public String requesterId;
        public AIIntegrationConfig.PermissionTiming permissionTiming = AIIntegrationConfig.PermissionTiming.ON_INIT;
        public Class<?> permissionTriggerEventClass;
        public String permissionTriggerDocPath;
        public Map<String, AITaskTemplate> tasks = new LinkedHashMap<String, AITaskTemplate>();
    }

    public static final class AiIntegrationBuilder<P extends DocBuilder<P>> {
        private final P parent;
        private final AiIntegrationDefinition definition = new AiIntegrationDefinition();

        private AiIntegrationBuilder(P parent, String name) {
            this.parent = parent;
            this.definition.name = requireValue(name, "ai name");
            String normalized = this.definition.name.trim();
            this.definition.statusPath = "/ai/" + normalized + "/status";
            this.definition.contextPath = "/ai/" + normalized + "/context";
            this.definition.requesterId = aiToken(normalized);
        }

        public AiIntegrationBuilder<P> sessionId(String sessionId) {
            this.definition.sessionId = requireValue(sessionId, "sessionId");
            return this;
        }

        public AiIntegrationBuilder<P> permissionFrom(String channelKey) {
            this.definition.permissionFrom = requireValue(channelKey, "permissionFrom");
            return this;
        }

        public AiIntegrationBuilder<P> statusPath(String pointer) {
            this.definition.statusPath = requireValue(pointer, "statusPath");
            return this;
        }

        public AiIntegrationBuilder<P> contextPath(String pointer) {
            this.definition.contextPath = requireValue(pointer, "contextPath");
            return this;
        }

        public AiIntegrationBuilder<P> requesterId(String requesterId) {
            this.definition.requesterId = requireValue(requesterId, "requesterId");
            return this;
        }

        public AiIntegrationBuilder<P> requestPermissionOnInit() {
            this.definition.permissionTiming = AIIntegrationConfig.PermissionTiming.ON_INIT;
            this.definition.permissionTriggerEventClass = null;
            this.definition.permissionTriggerDocPath = null;
            return this;
        }

        public AiIntegrationBuilder<P> requestPermissionOnEvent(Class<?> eventClass) {
            require(eventClass, "permission trigger event class");
            this.definition.permissionTiming = AIIntegrationConfig.PermissionTiming.ON_EVENT;
            this.definition.permissionTriggerEventClass = eventClass;
            this.definition.permissionTriggerDocPath = null;
            return this;
        }

        public AiIntegrationBuilder<P> requestPermissionOnDocChange(String path) {
            this.definition.permissionTiming = AIIntegrationConfig.PermissionTiming.ON_DOC_CHANGE;
            this.definition.permissionTriggerDocPath = requireValue(path, "permission trigger doc path");
            this.definition.permissionTriggerEventClass = null;
            return this;
        }

        public AiIntegrationBuilder<P> requestPermissionManually() {
            this.definition.permissionTiming = AIIntegrationConfig.PermissionTiming.MANUAL;
            this.definition.permissionTriggerEventClass = null;
            this.definition.permissionTriggerDocPath = null;
            return this;
        }

        public TaskBuilder<P> task(String taskName) {
            return new TaskBuilder<P>(this, taskName);
        }

        private void registerTask(AITaskTemplate taskTemplate) {
            String taskName = taskTemplate.name();
            if (definition.tasks.containsKey(taskName)) {
                throw new IllegalArgumentException("Duplicate AI task name: " + taskName);
            }
            definition.tasks.put(taskName, taskTemplate);
        }

        public P done() {
            requireValue(definition.sessionId, "sessionId");
            requireValue(definition.permissionFrom, "permissionFrom");
            requireValue(definition.statusPath, "statusPath");
            requireValue(definition.contextPath, "contextPath");
            requireValue(definition.requesterId, "requesterId");
            return parent.registerAiIntegration(definition);
        }

        private static String requireValue(String value, String fieldName) {
            if (value == null || value.trim().isEmpty()) {
                throw new IllegalArgumentException(fieldName + " is required");
            }
            return value.trim();
        }
    }

    public static final class TaskBuilder<P extends DocBuilder<P>> {
        private final AiIntegrationBuilder<P> parent;
        private final String taskName;
        private final List<String> instructions = new ArrayList<String>();
        private final List<TypeReference> expectedResponses = new ArrayList<TypeReference>();
        private final List<NamedEventExpectation> expectedNamedEvents = new ArrayList<NamedEventExpectation>();

        private TaskBuilder(AiIntegrationBuilder<P> parent, String taskName) {
            this.parent = parent;
            if (taskName == null || taskName.trim().isEmpty()) {
                throw new IllegalArgumentException("task name is required");
            }
            this.taskName = taskName.trim();
        }

        public TaskBuilder<P> instruction(String text) {
            if (text == null || text.trim().isEmpty()) {
                return this;
            }
            instructions.add(text.trim());
            return this;
        }

        public TaskBuilder<P> expects(Class<?> eventTypeClass) {
            expectedResponses.add(TypeReference.of(eventTypeClass));
            return this;
        }

        public TaskBuilder<P> expects(Node eventTypeNode) {
            expectedResponses.add(TypeReference.of(eventTypeNode));
            return this;
        }

        public TaskBuilder<P> expectsNamed(String eventName) {
            expectedNamedEvents.add(NamedEventExpectation.named(eventName).build());
            return this;
        }

        public TaskBuilder<P> expectsNamed(String eventName,
                                           Consumer<NamedEventExpectation.Builder> fieldsCustomizer) {
            NamedEventExpectation.Builder builder = NamedEventExpectation.named(eventName);
            if (fieldsCustomizer != null) {
                fieldsCustomizer.accept(builder);
            }
            expectedNamedEvents.add(builder.build());
            return this;
        }

        public TaskBuilder<P> expectsNamed(String eventName, String... fieldNames) {
            NamedEventExpectation.Builder builder = NamedEventExpectation.named(eventName);
            if (fieldNames != null) {
                for (String fieldName : fieldNames) {
                    builder.field(fieldName);
                }
            }
            expectedNamedEvents.add(builder.build());
            return this;
        }

        public AiIntegrationBuilder<P> done() {
            if (instructions.isEmpty()) {
                throw new IllegalStateException(
                        "Task '" + taskName + "': at least one instruction required");
            }
            parent.registerTask(new AITaskTemplate(taskName, instructions, expectedResponses, expectedNamedEvents));
            return parent;
        }
    }

    public static final class FieldBuilder<P extends DocBuilder<P>> {
        private final P parent;
        private final String path;
        private Node typeNode;
        private String description;
        private Object value;
        private boolean valueSet;
        private Boolean required;
        private Number minimum;
        private Number maximum;

        private FieldBuilder(P parent, String path) {
            this.parent = parent;
            this.path = PointerUtils.normalizeRequiredPointer(path, "field path");
        }

        public FieldBuilder<P> type(Class<?> typeClass) {
            require(typeClass, "type class");
            this.typeNode = TypeRef.of(typeClass).asTypeNode();
            return this;
        }

        public FieldBuilder<P> type(String typeAlias) {
            require(typeAlias, "type alias");
            this.typeNode = new Node().value(typeAlias.trim()).inlineValue(true);
            return this;
        }

        public FieldBuilder<P> type(Node typeNode) {
            require(typeNode, "type node");
            this.typeNode = typeNode.clone();
            return this;
        }

        public FieldBuilder<P> description(String description) {
            require(description, "description");
            this.description = description;
            return this;
        }

        public FieldBuilder<P> value(Object value) {
            this.value = value;
            this.valueSet = true;
            return this;
        }

        public FieldBuilder<P> required(boolean required) {
            this.required = required;
            return this;
        }

        public FieldBuilder<P> minimum(Number minimum) {
            require(minimum, "minimum");
            this.minimum = minimum;
            return this;
        }

        public FieldBuilder<P> maximum(Number maximum) {
            require(maximum, "maximum");
            this.maximum = maximum;
            return this;
        }

        public P done() {
            Node working = resolveExistingFieldNode(parent.document, path);
            boolean mutated = valueSet
                    || typeNode != null
                    || description != null
                    || required != null
                    || minimum != null
                    || maximum != null;
            if (!mutated && working == null) {
                return parent;
            }
            if (working == null) {
                working = new Node();
            } else {
                working = working.clone();
            }

            if (valueSet) {
                working = toNode(value);
            }
            if (typeNode != null) {
                working.type(typeNode.clone());
            }
            if (description != null) {
                working.description(description);
            }
            if (required != null || minimum != null || maximum != null) {
                Constraints constraints = working.getConstraints() == null
                        ? new Constraints()
                        : working.getConstraints().clone();
                if (required != null) {
                    constraints.required(required);
                }
                if (minimum != null) {
                    constraints.minimum(new java.math.BigDecimal(minimum.toString()));
                }
                if (maximum != null) {
                    constraints.maximum(new java.math.BigDecimal(maximum.toString()));
                }
                working.constraints(constraints);
            }
            return parent.set(path, working);
        }

        private static Node resolveExistingFieldNode(Node document, String path) {
            try {
                Object value = document.get(path);
                if (value instanceof Node) {
                    return (Node) value;
                }
                return null;
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private static final class SectionContext {
        private final String key;
        private final String title;
        private final String summary;
        private final Set<String> fields = new LinkedHashSet<String>();
        private final Set<String> contracts = new LinkedHashSet<String>();

        private SectionContext(String key, String title, String summary) {
            this.key = key;
            this.title = title;
            this.summary = summary;
        }

        private void addField(String path) {
            fields.add(path);
        }

        private void addContract(String contractKey) {
            contracts.add(contractKey);
        }

        private Node buildNode() {
            Node section = new Node().type(TypeAliases.CONVERSATION_DOCUMENT_SECTION);
            section.properties("title", new Node().value(title));
            if (summary != null && !summary.trim().isEmpty()) {
                section.properties("summary", new Node().value(summary.trim()));
            }
            if (!fields.isEmpty()) {
                List<Node> relatedFields = new ArrayList<Node>();
                for (String field : fields) {
                    relatedFields.add(new Node().value(field));
                }
                section.properties("relatedFields", new Node().items(relatedFields));
            }
            if (!contracts.isEmpty()) {
                List<Node> relatedContracts = new ArrayList<Node>();
                for (String contract : contracts) {
                    relatedContracts.add(new Node().value(contract));
                }
                section.properties("relatedContracts", new Node().items(relatedContracts));
            }
            return section;
        }
    }

    public static final class OperationBuilder<P extends DocBuilder<P>> {
        private final P parent;
        private final String key;
        private String channelKey;
        private String description;
        private Class<?> requestTypeClass;
        private Object requestSchema;
        private boolean clearRequest;
        private String requestDescription;
        private Consumer<StepsBuilder> implementation;

        private OperationBuilder(P parent, String key) {
            this.parent = parent;
            this.key = key;
        }

        public OperationBuilder<P> channel(String channelKey) {
            this.channelKey = channelKey;
            return this;
        }

        public OperationBuilder<P> description(String description) {
            this.description = description;
            return this;
        }

        public OperationBuilder<P> requestType(Class<?> requestTypeClass) {
            this.requestTypeClass = requestTypeClass;
            this.requestSchema = null;
            this.clearRequest = false;
            return this;
        }

        public OperationBuilder<P> request(Object requestSchema) {
            require(requestSchema, "request");
            this.requestSchema = requestSchema;
            this.requestTypeClass = null;
            this.clearRequest = false;
            return this;
        }

        public OperationBuilder<P> requestDescription(String requestDescription) {
            require(requestDescription, "request description");
            this.requestDescription = requestDescription;
            return this;
        }

        public OperationBuilder<P> noRequest() {
            this.requestTypeClass = null;
            this.requestSchema = null;
            this.clearRequest = true;
            return this;
        }

        public OperationBuilder<P> steps(Consumer<StepsBuilder> implementation) {
            this.implementation = implementation;
            return this;
        }

        public P done() {
            P result = parent.applyOperationFromBuilder(
                    key,
                    channelKey,
                    description,
                    requestTypeClass,
                    requestSchema,
                    clearRequest,
                    implementation);
            if (requestDescription != null) {
                result.requestDescription(key, requestDescription);
            }
            return result;
        }
    }
}
