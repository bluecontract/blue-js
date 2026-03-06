package blue.language.processor.registry.processors;

import blue.language.model.Node;
import blue.language.NodeProvider;
import blue.language.blueid.BlueIdCalculator;
import blue.language.processor.ContractBundle;
import blue.language.processor.HandlerProcessor;
import blue.language.processor.ProcessorExecutionContext;
import blue.language.processor.model.MarkerContract;
import blue.language.processor.model.OperationMarker;
import blue.language.processor.model.SequentialWorkflowOperation;
import blue.language.processor.util.ProcessorPointerConstants;
import blue.language.processor.workflow.WorkflowStepRunner;

import java.util.List;

public class SequentialWorkflowOperationProcessor implements HandlerProcessor<SequentialWorkflowOperation> {

    private static final String CONVERSATION_OPERATION_REQUEST_BLUE_ID = "Conversation/Operation Request";
    private static final String OPERATION_REQUEST_BLUE_ID = "Operation Request";

    private final WorkflowStepRunner stepRunner;
    private final boolean allowDirectOperationShape;

    public SequentialWorkflowOperationProcessor() {
        this(WorkflowStepRunner.defaultRunner(), false);
    }

    public SequentialWorkflowOperationProcessor(WorkflowStepRunner stepRunner) {
        this(stepRunner, false);
    }

    public SequentialWorkflowOperationProcessor(boolean allowDirectOperationShape) {
        this(WorkflowStepRunner.defaultRunner(), allowDirectOperationShape);
    }

    public SequentialWorkflowOperationProcessor(WorkflowStepRunner stepRunner, boolean allowDirectOperationShape) {
        this.stepRunner = stepRunner;
        this.allowDirectOperationShape = allowDirectOperationShape;
    }

    @Override
    public Class<SequentialWorkflowOperation> contractType() {
        return SequentialWorkflowOperation.class;
    }

    @Override
    public String deriveChannel(SequentialWorkflowOperation contract) {
        if (contract.getChannelKey() != null && !contract.getChannelKey().trim().isEmpty()) {
            return contract.getChannelKey().trim();
        }
        return null;
    }

    @Override
    public boolean matches(SequentialWorkflowOperation contract, ProcessorExecutionContext context) {
        Node eventNode = context.event();
        if (eventNode == null) {
            return false;
        }
        NodeProvider nodeProvider = context.nodeProvider();

        Node requestNode = extractOperationRequestNode(eventNode, nodeProvider);
        if (requestNode == null) {
            return false;
        }
        if (!isOperationRequestForContract(contract, eventNode, requestNode, nodeProvider)) {
            return false;
        }

        Node operationNode = loadOperationNode(contract, context);
        if (operationNode == null) {
            return false;
        }

        String operationChannel = extractOperationChannel(operationNode);
        String handlerChannel = normalizeChannel(contract.getChannelKey());
        if (!channelsCompatible(operationChannel, handlerChannel)) {
            return false;
        }
        if (!isRequestTypeCompatible(requestNode, operationNode, nodeProvider)) {
            return false;
        }
        if (!isPinnedDocumentAllowed(requestNode, context)) {
            return false;
        }

        return true;
    }

    @Override
    public void execute(SequentialWorkflowOperation contract, ProcessorExecutionContext context) {
        List<Node> steps = contract.getSteps();
        if (steps == null || steps.isEmpty()) {
            return;
        }
        stepRunner.run(contract, steps, context.event(), context, resolveContractNode(contract, context));
    }

    @Override
    public String deriveChannel(SequentialWorkflowOperation contract, ContractBundle scopeContracts) {
        String declared = deriveChannel(contract);
        if (declared != null) {
            return declared;
        }
        if (scopeContracts == null || contract.getOperation() == null || contract.getOperation().trim().isEmpty()) {
            return null;
        }
        String operationKey = contract.getOperation().trim();
        MarkerContract marker = scopeContracts.marker(operationKey);
        if (!(marker instanceof OperationMarker)) {
            return null;
        }
        String channel = ((OperationMarker) marker).getChannel();
        return channel != null && !channel.trim().isEmpty() ? channel.trim() : null;
    }

    private Node extractOperationRequestNode(Node eventNode, NodeProvider nodeProvider) {
        if (allowDirectOperationShape && isOperationRequestNode(eventNode)) {
            return eventNode;
        }
        if (!TimelineEventSupport.isConversationOrMyOSTimelineEntry(eventNode)) {
            return null;
        }
        if (eventNode.getProperties() == null) {
            return null;
        }
        Node message = eventNode.getProperties().get("message");
        if (isOperationRequestNode(message) && isTypedOperationRequestNode(message, nodeProvider)) {
            return message;
        }
        return null;
    }

    private boolean isOperationRequestNode(Node node) {
        return node != null
                && node.getProperties() != null
                && node.getProperties().containsKey("operation")
                && node.getProperties().containsKey("request");
    }

    private boolean isTypedOperationRequestNode(Node node, NodeProvider nodeProvider) {
        return matchesOperationRequestType(node, CONVERSATION_OPERATION_REQUEST_BLUE_ID, nodeProvider)
                || matchesOperationRequestType(node, OPERATION_REQUEST_BLUE_ID, nodeProvider);
    }

    private boolean matchesOperationRequestType(Node node, String expectedBlueId, NodeProvider nodeProvider) {
        Node requirement = new Node().type(new Node().blueId(expectedBlueId));
        return WorkflowContractSupport.matchesTypeRequirement(node, requirement, nodeProvider);
    }

    private boolean isOperationRequestForContract(SequentialWorkflowOperation contract,
                                                  Node eventNode,
                                                  Node requestNode,
                                                  NodeProvider nodeProvider) {
        String operationKey = normalize(contract.getOperation());
        if (operationKey == null) {
            return false;
        }
        String requestOperation = valueAsString(requestNode, "operation");
        if (!operationKey.equals(requestOperation)) {
            return false;
        }
        if (!WorkflowContractSupport.matchesEventFilter(eventNode, contract.getEvent(), nodeProvider)) {
            return false;
        }
        if (eventNode == requestNode) {
            return allowDirectOperationShape;
        }
        return true;
    }

    private Node loadOperationNode(SequentialWorkflowOperation contract, ProcessorExecutionContext context) {
        String operationKey = normalize(contract.getOperation());
        if (operationKey == null) {
            return null;
        }
        String operationPointer = context.resolvePointer("/contracts/" + operationKey);
        Node operationNode = context.documentAt(operationPointer);
        if (operationNode == null) {
            return null;
        }
        if (!isOperationNode(operationNode, context.nodeProvider())) {
            return null;
        }
        return operationNode;
    }

    private boolean isOperationNode(Node node, NodeProvider nodeProvider) {
        if (node == null) {
            return false;
        }
        return matchesOperationType(node, "Conversation/Operation", nodeProvider)
                || matchesOperationType(node, "Operation", nodeProvider)
                || matchesOperationType(node, "Conversation/Change Operation", nodeProvider)
                || matchesOperationType(node, "ChangeOperation", nodeProvider);
    }

    private boolean matchesOperationType(Node node, String expectedBlueId, NodeProvider nodeProvider) {
        Node requirement = new Node().type(new Node().blueId(expectedBlueId));
        return WorkflowContractSupport.matchesTypeRequirement(node, requirement, nodeProvider);
    }

    private String extractOperationChannel(Node operationNode) {
        return normalize(valueAsString(operationNode, "channel"));
    }

    private boolean channelsCompatible(String operationChannel, String handlerChannel) {
        return !(operationChannel != null
                && handlerChannel != null
                && !operationChannel.equals(handlerChannel));
    }

    private boolean isRequestTypeCompatible(Node requestNode, Node operationNode, NodeProvider nodeProvider) {
        if (requestNode.getProperties() == null || operationNode.getProperties() == null) {
            return false;
        }
        Node requestPayload = requestNode.getProperties().get("request");
        Node requiredType = operationNode.getProperties().get("request");
        if (requestPayload == null || requiredType == null) {
            return false;
        }
        return WorkflowContractSupport.matchesTypeRequirement(requestPayload, requiredType, nodeProvider);
    }

    private boolean isPinnedDocumentAllowed(Node requestNode, ProcessorExecutionContext context) {
        Boolean allowNewer = valueAsBoolean(requestNode, "allowNewerVersion");
        if (allowNewer == null || allowNewer.booleanValue()) {
            return true;
        }
        Node pinnedDocument = requestNode.getProperties() != null
                ? requestNode.getProperties().get("document")
                : null;
        String pinnedBlueId = resolvePinnedDocumentBlueId(pinnedDocument);
        if (pinnedBlueId == null) {
            return true;
        }

        Node root = context.documentAt("/");
        if (root == null || root.getProperties() == null) {
            return false;
        }
        Node contracts = root.getProperties().get("contracts");
        if (contracts == null || contracts.getProperties() == null) {
            return false;
        }
        Node initialized = contracts.getProperties().get("initialized");
        String storedBlueId = null;
        if (initialized != null && initialized.getProperties() != null) {
            Node documentId = initialized.getProperties().get("documentId");
            if (documentId != null && documentId.getValue() instanceof String) {
                String normalized = ((String) documentId.getValue()).trim();
                if (!normalized.isEmpty()) {
                    storedBlueId = normalized;
                }
            }
        }
        String expectedBlueId = storedBlueId != null ? storedBlueId : BlueIdCalculator.calculateSemanticBlueId(root);
        return pinnedBlueId.equals(expectedBlueId);
    }

    private String resolvePinnedDocumentBlueId(Node documentNode) {
        if (documentNode == null) {
            return null;
        }
        if (documentNode.getBlueId() != null && !documentNode.getBlueId().trim().isEmpty()) {
            return documentNode.getBlueId().trim();
        }
        if (documentNode.getProperties() == null) {
            return null;
        }
        Node blueIdNode = documentNode.getProperties().get("blueId");
        if (blueIdNode == null || !(blueIdNode.getValue() instanceof String)) {
            return null;
        }
        return ((String) blueIdNode.getValue()).trim();
    }

    private String valueAsString(Node node, String property) {
        if (node == null || node.getProperties() == null) {
            return null;
        }
        Node valueNode = node.getProperties().get(property);
        if (valueNode == null || valueNode.getValue() == null) {
            return null;
        }
        return String.valueOf(valueNode.getValue()).trim();
    }

    private Boolean valueAsBoolean(Node node, String property) {
        if (node == null || node.getProperties() == null) {
            return null;
        }
        Node valueNode = node.getProperties().get(property);
        if (valueNode == null || valueNode.getValue() == null) {
            return null;
        }
        Object value = valueNode.getValue();
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.valueOf((String) value);
        }
        return null;
    }

    private String normalize(String channel) {
        if (channel == null) {
            return null;
        }
        String trimmed = channel.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeChannel(String channel) {
        return normalize(channel);
    }

    private Node resolveContractNode(SequentialWorkflowOperation contract, ProcessorExecutionContext context) {
        if (contract == null || contract.getKey() == null || contract.getKey().trim().isEmpty()) {
            return null;
        }
        String contractPointer = context.resolvePointer(
                ProcessorPointerConstants.relativeContractsEntry(contract.getKey().trim()));
        return context.documentAt(contractPointer);
    }
}
