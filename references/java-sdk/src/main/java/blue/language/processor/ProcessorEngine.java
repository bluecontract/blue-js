package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.Contract;
import blue.language.processor.model.HandlerContract;
import blue.language.processor.model.JsonPatch;
import blue.language.processor.util.NodeCanonicalizer;
import blue.language.processor.util.PointerUtils;
import blue.language.processor.util.ProcessorContractConstants;
import blue.language.processor.util.ProcessorPointerConstants;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class ProcessorEngine {

    private ProcessorEngine() {
    }

    static DocumentProcessingResult initializeDocument(DocumentProcessor owner, Node document) {
        Objects.requireNonNull(document, "document");
        if (isInitialized(owner, document)) {
            throw new IllegalStateException("Document already initialized");
        }
        Execution execution = new Execution(owner, document.clone());
        try {
            execution.initializeScope("/", true);
        } catch (RunTerminationException ignored) {
            // Initialization run terminated early (e.g., graceful root termination).
        } catch (MustUnderstandFailureException ex) {
            return DocumentProcessingResult.capabilityFailure(document.clone(), ex.getMessage());
        }
        return execution.result();
    }

    static DocumentProcessingResult processDocument(DocumentProcessor owner, Node document, Node event) {
        Objects.requireNonNull(document, "document");
        Objects.requireNonNull(event, "event");
        if (!isInitialized(owner, document)) {
            throw new IllegalStateException("Document not initialized");
        }
        Node cloned = document.clone();
        Execution execution = new Execution(owner, cloned);
        try {
            execution.loadBundles("/");
            execution.processExternalEvent("/", event);
        } catch (RunTerminationException ignored) {
            // Processing terminated early; result still returned.
        } catch (MustUnderstandFailureException ex) {
            return DocumentProcessingResult.capabilityFailure(document.clone(), ex.getMessage());
        }
        return execution.result();
    }

    static boolean isInitialized(DocumentProcessor owner, Node document) {
        Objects.requireNonNull(document, "document");
        String pointer = PointerUtils.resolvePointer("/", ProcessorPointerConstants.RELATIVE_INITIALIZED);
        Node marker = null;
        try {
            marker = nodeAt(document, pointer);
        } catch (Exception ignored) {
        }
        if (marker == null) {
            return false;
        }
        validateInitializationMarker(marker, pointer);
        return true;
    }

    @SuppressWarnings("unchecked")
    static ChannelMatch evaluateChannel(DocumentProcessor owner,
                                            String bindingKey,
                                            ChannelContract contract,
                                            ContractBundle bundle,
                                            String scopePath,
                                            Node event) {
        ChannelProcessor<? extends ChannelContract> processor = owner.registry().lookupChannel(contract).orElse(null);
        if (processor == null) {
            return ChannelMatch.noMatch();
        }
        Node clonedEvent = event != null ? event.clone() : null;
        Object eventObject = null;
        try {
            eventObject = owner.contractConverter().convertWithType(clonedEvent, Object.class, false);
        } catch (Exception ignored) {
        }
        @SuppressWarnings("unchecked")
        ChannelProcessor<ChannelContract> typed = (ChannelProcessor<ChannelContract>) processor;
        ChannelEvaluationContext context = new ChannelEvaluationContext(scopePath,
                bindingKey,
                clonedEvent,
                eventObject,
                bundle.markers(),
                bundle,
                owner.registry());
        ChannelProcessorEvaluation evaluation = typed.evaluate(contract, context);
        if (evaluation == null || !evaluation.matches()) {
            return ChannelMatch.noMatch();
        }
        Node eventNode = evaluation.eventNode() != null ? evaluation.eventNode() : context.event();
        return new ChannelMatch(true, evaluation.eventId(), typed, context, eventNode, evaluation.deliveries());
    }

    static Node createLifecycleInitiatedEvent(String documentId) {
        Node event = new Node()
                .type(new Node().blueId("Document Processing Initiated"))
                .properties("type", new Node()
                .value("Document Processing Initiated")
                .type(new Node().blueId("Document Processing Initiated")));
        event.properties("documentId", new Node().value(documentId));
        return event;
    }

    static String canonicalSignature(Node node) {
        return NodeCanonicalizer.canonicalSignature(node);
    }

    static Node createDocumentUpdateEvent(DocumentProcessingRuntime.DocumentUpdateData data, String scopePath) {
        String relativePath = PointerUtils.relativizePointer(scopePath, data.path());
        Node event = new Node().properties("type", new Node().value("Document Update"));
        event.properties("op", new Node().value(data.op().name().toLowerCase()));
        Node beforeNode = data.before() != null ? data.before().clone() : new Node().value(null);
        Node afterNode = data.after() != null ? data.after().clone() : new Node().value(null);
        event.properties("path", new Node().value(relativePath));
        event.properties("before", beforeNode);
        event.properties("after", afterNode);
        return event;
    }

    static boolean matchesDocumentUpdate(String scopePath, String watchPath, String changedPath) {
        if (watchPath == null || watchPath.isEmpty()) {
            return false;
        }
        String watch = PointerUtils.resolvePointer(scopePath, watchPath);
        String changed = PointerUtils.normalizePointer(changedPath);
        if (watch.equals("/")) {
            return true;
        }
        if (changed.equals(watch)) {
            return true;
        }
        return changed.startsWith(watch + "/");
    }

    static Node nodeAt(Node root, String pointer) {
        Objects.requireNonNull(root, "root");
        String[] segments = PointerUtils.splitPointerSegments(pointer);
        Node current = root;
        for (String segment : segments) {
            if (current == null) {
                return null;
            }
            Map<String, Node> props = current.getProperties();
            if (props != null && props.containsKey(segment)) {
                current = props.get(segment);
                continue;
            }

            if (PointerUtils.isArrayIndexSegment(segment)) {
                int index = PointerUtils.parseArrayIndex(segment);
                List<Node> items = current.getItems();
                if (items == null || index < 0 || index >= items.size()) {
                    return null;
                }
                current = items.get(index);
                continue;
            }

            if ("type".equals(segment)) {
                current = current.getType();
                continue;
            }
            if ("itemType".equals(segment)) {
                current = current.getItemType();
                continue;
            }
            if ("keyType".equals(segment)) {
                current = current.getKeyType();
                continue;
            }
            if ("valueType".equals(segment)) {
                current = current.getValueType();
                continue;
            }
            if ("blue".equals(segment)) {
                current = current.getBlue();
                continue;
            }

            return null;
        }
        return current;
    }

    static boolean hasInitializationMarker(Node root, String scopePath) {
        String pointer = PointerUtils.resolvePointer(scopePath, ProcessorPointerConstants.RELATIVE_INITIALIZED);
        Node marker;
        try {
            marker = nodeAt(root, pointer);
        } catch (Exception ignored) {
            return false;
        }
        if (marker == null) {
            return false;
        }
        validateInitializationMarker(marker, pointer);
        return true;
    }

    static void validateInitializationMarker(Node marker, String pointer) {
        if (marker == null) {
            return;
        }
        Node type = marker.getType();
        String blueId = type != null ? type.getBlueId() : null;
        boolean validBlueId = "EVguxFmq5iFtMZaBQgHfjWDojaoesQ1vEXCQFZ59yL28".equals(blueId)
                || "Processing Initialized Marker".equals(blueId)
                || "Core/Processing Initialized Marker".equals(blueId)
                || "InitializationMarker".equals(blueId);
        if (!validBlueId) {
            throw new IllegalStateException(
                    "Reserved key 'initialized' must contain an Initialization Marker at " + pointer);
        }
    }

    static final class Execution {
        private final DocumentProcessor owner;
        private final DocumentProcessingRuntime runtime;
        private final Map<String, ContractBundle> bundles = new LinkedHashMap<>();
        private final Map<String, PendingTermination> pendingTerminations = new LinkedHashMap<>();
        private final Set<String> cutOffScopes = new LinkedHashSet<>();
        private final CheckpointManager checkpointManager;
        private final TerminationService terminationService;
        private final ChannelRunner channelRunner;
        private final ScopeExecutor scopeExecutor;

        Execution(DocumentProcessor owner, Node document) {
            this.owner = owner;
            this.runtime = new DocumentProcessingRuntime(document);
            this.checkpointManager = new CheckpointManager(runtime, ProcessorEngine::canonicalSignature);
            this.terminationService = new TerminationService(runtime);
            this.channelRunner = new ChannelRunner(owner, this, runtime, checkpointManager);
            this.scopeExecutor = new ScopeExecutor(owner, this, runtime, bundles, channelRunner);
        }

        void initializeScope(String scopePath, boolean chargeScopeEntry) {
            scopeExecutor.initializeScope(scopePath, chargeScopeEntry);
        }

        void loadBundles(String scopePath) {
            scopeExecutor.loadBundles(scopePath);
        }

        void processExternalEvent(String scopePath, Node event) {
            scopeExecutor.processExternalEvent(scopePath, event);
        }

        void handlePatch(String scopePath,
                         ContractBundle bundle,
                         JsonPatch patch,
                         boolean allowReservedMutation) {
            handlePatch(scopePath, bundle, patch, allowReservedMutation, false);
        }

        void handlePatch(String scopePath,
                         ContractBundle bundle,
                         JsonPatch patch,
                         boolean allowReservedMutation,
                         boolean allowTerminatedWork) {
            scopeExecutor.handlePatch(scopePath, bundle, patch, allowReservedMutation, allowTerminatedWork);
        }

        ProcessorExecutionContext createContext(String scopePath,
                                                ContractBundle bundle,
                                                Node event) {
            return createContext(scopePath, bundle, event, false, false);
        }

        ProcessorExecutionContext createContext(String scopePath,
                                                ContractBundle bundle,
                                                Node event,
                                                boolean allowTerminatedWork) {
            return createContext(scopePath, bundle, event, allowTerminatedWork, false);
        }

        ProcessorExecutionContext createContext(String scopePath,
                                                ContractBundle bundle,
                                                Node event,
                                                boolean allowTerminatedWork,
                                                boolean allowReservedMutation) {
            return new ProcessorExecutionContext(this, bundle, scopePath,
                    cloneEvent(event), allowTerminatedWork, allowReservedMutation);
        }

        DocumentProcessingResult result() {
            return DocumentProcessingResult.of(runtime.document(), runtime.rootEmissions(), runtime.totalGas());
        }

        DocumentProcessingRuntime runtime() {
            return runtime;
        }

        DocumentProcessor owner() {
            return owner;
        }

        boolean isScopeInactive(String scopePath) {
            String normalized = PointerUtils.normalizeScope(scopePath);
            return cutOffScopes.contains(normalized)
                    || pendingTerminations.containsKey(normalized)
                    || runtime.isScopeTerminated(normalized);
        }

        void enterGracefulTermination(String scopePath, ContractBundle bundle, String reason) {
            terminate(scopePath, bundle, ScopeRuntimeContext.TerminationKind.GRACEFUL, reason);
        }

        void enterFatalTermination(String scopePath, ContractBundle bundle, String reason) {
            terminate(scopePath, bundle, ScopeRuntimeContext.TerminationKind.FATAL, reason);
        }

        private void terminate(String scopePath,
                               ContractBundle bundle,
                               ScopeRuntimeContext.TerminationKind kind,
                               String reason) {
            String normalized = PointerUtils.normalizeScope(scopePath);
            if (pendingTerminations.containsKey(normalized) || runtime.isScopeTerminated(normalized)) {
                return;
            }
            pendingTerminations.put(normalized, new PendingTermination(kind, reason));
            terminationService.terminateScope(this, scopePath, bundle, kind, reason);
        }

        ContractBundle bundleForScope(String scopePath) {
            return bundles.get(PointerUtils.normalizeScope(scopePath));
        }

        void recordPendingTermination(String scopePath,
                                      ScopeRuntimeContext.TerminationKind kind,
                                      String reason) {
            pendingTerminations.put(PointerUtils.normalizeScope(scopePath), new PendingTermination(kind, reason));
        }

        void clearPendingTermination(String scopePath) {
            pendingTerminations.remove(PointerUtils.normalizeScope(scopePath));
        }

        void markCutOff(String scopePath) {
            String normalized = PointerUtils.normalizeScope(scopePath);
            if (cutOffScopes.add(normalized)) {
                ScopeRuntimeContext context = runtime.existingScope(normalized);
                if (context != null) {
                    context.markCutOff();
                }
            }
        }

        String fatalReason(Throwable throwable, String defaultReason) {
            String message = throwable != null ? throwable.getMessage() : null;
            return message != null ? message : defaultReason;
        }

        void deliverLifecycle(String scopePath,
                              ContractBundle bundle,
                              Node event,
                              boolean finalizeAfter) {
            scopeExecutor.deliverLifecycle(scopePath, bundle, event, finalizeAfter);
        }

        void recordLifecycleForBridging(String scopePath, Node event) {
            ScopeRuntimeContext scopeContext = runtime.scope(scopePath);
            scopeContext.recordBridgeable(event.clone());
            if ("/".equals(scopePath)) {
                runtime.recordRootEmission(event.clone());
            }
        }

        private Node cloneEvent(Node event) {
            return event != null ? event.clone() : null;
        }
    }

    private static final class PendingTermination {
        final ScopeRuntimeContext.TerminationKind kind;
        final String reason;

        PendingTermination(ScopeRuntimeContext.TerminationKind kind, String reason) {
            this.kind = kind;
            this.reason = reason;
        }
    }


    @SuppressWarnings("unchecked")
    static void executeHandler(DocumentProcessor owner, HandlerContract contract, ProcessorExecutionContext context) {
        HandlerProcessor<? extends HandlerContract> processor = owner.registry()
                .lookupHandler(contract)
                .orElseThrow(() -> new IllegalStateException(
                        "No processor registered for contract type " + contract.getClass().getName()));
        HandlerProcessor<HandlerContract> typed = (HandlerProcessor<HandlerContract>) processor;
        if (!typed.matches(contract, context)) {
            return;
        }
        typed.execute(contract, context);
    }

    static final class ChannelMatch {
        final boolean matches;
        final String eventId;
        final ChannelProcessor<ChannelContract> processor;
        final ChannelEvaluationContext context;
        final Node eventNode;
        final List<ChannelProcessorEvaluation.ChannelDelivery> deliveries;

        ChannelMatch(boolean matches,
                     String eventId,
                     ChannelProcessor<ChannelContract> processor,
                     ChannelEvaluationContext context,
                     Node eventNode,
                     List<ChannelProcessorEvaluation.ChannelDelivery> deliveries) {
            this.matches = matches;
            this.eventId = eventId;
            this.processor = processor;
            this.context = context;
            this.eventNode = eventNode;
            this.deliveries = deliveries;
        }

        Node eventNode() {
            return eventNode;
        }

        static ChannelMatch noMatch() {
            return new ChannelMatch(false, null, null, null, null, java.util.Collections.<ChannelProcessorEvaluation.ChannelDelivery>emptyList());
        }
    }

    static final class BoundaryViolationException extends RuntimeException {
        BoundaryViolationException(String message) {
            super(message);
        }
    }
}
