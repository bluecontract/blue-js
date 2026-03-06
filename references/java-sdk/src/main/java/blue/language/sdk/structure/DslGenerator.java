package blue.language.sdk.structure;

import blue.language.model.Node;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DslGenerator {

    private static final String INDENT_1 = "    ";
    private static final String INDENT_2 = "        ";
    private static final String INDENT_3 = "            ";

    public static String generate(Node document) {
        return generateInternal(document, true);
    }

    static String generateInternal(Node document, boolean includeSteps) {
        if (document == null) {
            return "DocBuilder.doc()\n" + INDENT_1 + ".buildDocument();";
        }

        DocStructure structure = DocStructure.from(document);
        Map<String, Node> contracts = contractsMap(document);
        StringBuilder out = new StringBuilder();

        boolean payNote = isAlias(structure.type, "PayNote/PayNote");
        if (payNote) {
            out.append("PayNotes.payNote(").append(quote(defaultIfBlank(structure.name, "Untitled"))).append(")\n");
        } else {
            out.append("DocBuilder.doc()\n");
            if (structure.name != null) {
                out.append(INDENT_1).append(".name(").append(quote(structure.name)).append(")\n");
            }
        }

        if (structure.description != null) {
            out.append(INDENT_1).append(".description(").append(quote(structure.description)).append(")\n");
        }
        if (!payNote && structure.type != null && structure.type.alias != null) {
            out.append(INDENT_1).append(".type(").append(quote(structure.type.alias)).append(")\n");
        }

        emitRootFields(out, structure, document, payNote);
        if (payNote) {
            emitPayNoteActionBlocks(out, structure);
        }
        emitSectionedContracts(out, structure, document, contracts, includeSteps);

        out.append(INDENT_1).append(".buildDocument();");
        return out.toString();
    }

    private static void emitRootFields(StringBuilder out, DocStructure structure, Node document, boolean payNote) {
        if (payNote) {
            String currency = scalarText(document, "currency");
            if (currency != null) {
                out.append(INDENT_1).append(".currency(").append(quote(currency)).append(")\n");
            }
            Object total = scalarValue(document, "amount", "total");
            if (total != null) {
                out.append(INDENT_1).append(".amountMinor(").append(numberLiteral(total)).append(")\n");
            }
        }

        for (FieldEntry field : structure.rootFields.values()) {
            if (payNote && ("/currency".equals(field.path) || "/amount".equals(field.path))) {
                continue;
            }
            Node fieldNode = rootNode(document, field.path);
            if (fieldNode == null) {
                continue;
            }
            if ("scalar".equals(field.valueKind)) {
                out.append(INDENT_1)
                        .append(".field(")
                        .append(quote(field.path))
                        .append(", ")
                        .append(valueLiteral(fieldNode.getValue()))
                        .append(")\n");
                continue;
            }
            if ("object".equals(field.valueKind)) {
                out.append(INDENT_1)
                        .append(".field(")
                        .append(quote(field.path))
                        .append(") // object, details in JSON\n");
                continue;
            }
            if ("list".equals(field.valueKind)) {
                out.append(INDENT_1)
                        .append(".field(")
                        .append(quote(field.path))
                        .append(") // list, details in JSON\n");
            }
        }
    }

    private static void emitPayNoteActionBlocks(StringBuilder out, DocStructure structure) {
        if (structure.contracts.containsKey("captureLockOnInit")
                || structure.contracts.containsKey("captureRequestOnInit")
                || hasContractPrefix(structure, "capture")) {
            out.append(INDENT_1).append(".capture()\n");
            if (structure.contracts.containsKey("captureLockOnInit")) {
                out.append(INDENT_2).append(".lockOnInit()\n");
            }
            if (structure.contracts.containsKey("captureRequestOnInit")) {
                out.append(INDENT_2).append(".requestOnInit()\n");
            }
            out.append(INDENT_2).append(".done()\n");
        }
        if (structure.contracts.containsKey("reserveLockOnInit")
                || structure.contracts.containsKey("reserveRequestOnInit")
                || hasContractPrefix(structure, "reserve")) {
            out.append(INDENT_1).append(".reserve()\n");
            if (structure.contracts.containsKey("reserveLockOnInit")) {
                out.append(INDENT_2).append(".lockOnInit()\n");
            }
            if (structure.contracts.containsKey("reserveRequestOnInit")) {
                out.append(INDENT_2).append(".requestOnInit()\n");
            }
            out.append(INDENT_2).append(".done()\n");
        }
        if (structure.contracts.containsKey("refundLockOnInit")
                || structure.contracts.containsKey("refundRequestOnInit")
                || hasContractPrefix(structure, "refund")) {
            out.append(INDENT_1).append(".refund()\n");
            if (structure.contracts.containsKey("refundLockOnInit")) {
                out.append(INDENT_2).append(".lockOnInit()\n");
            }
            if (structure.contracts.containsKey("refundRequestOnInit")) {
                out.append(INDENT_2).append(".requestOnInit()\n");
            }
            out.append(INDENT_2).append(".done()\n");
        }
    }

    private static void emitSectionedContracts(StringBuilder out,
                                               DocStructure structure,
                                               Node document,
                                               Map<String, Node> contracts,
                                               boolean includeSteps) {
        Set<String> emittedContracts = new LinkedHashSet<String>();
        if (structure.sections.isEmpty()) {
            out.append(INDENT_1)
                    .append(".section(\"_unsectioned\", \"Other\", \"Contracts without explicit sections\")\n");
            for (ContractEntry contractEntry : structure.contracts.values()) {
                if (contractEntry.kind == ContractKind.SECTION) {
                    continue;
                }
                emitContract(out, contractEntry, contracts, includeSteps, emittedContracts);
            }
            out.append(INDENT_1).append(".endSection()\n");
            return;
        }

        for (SectionEntry section : structure.sections.values()) {
            out.append(INDENT_1)
                    .append(".section(")
                    .append(quote(section.key))
                    .append(", ")
                    .append(quote(defaultIfBlank(section.title, section.key)))
                    .append(", ")
                    .append(quote(defaultIfBlank(section.summary, "Auto-generated section")))
                    .append(")\n");

            if (section.relatedFields != null) {
                for (String path : section.relatedFields) {
                    Node fieldNode = rootNodeByRawPath(document, path);
                    if (fieldNode == null) {
                        continue;
                    }
                    if (fieldNode.getValue() != null) {
                        out.append(INDENT_2)
                                .append(".field(")
                                .append(quote(path))
                                .append(", ")
                                .append(valueLiteral(fieldNode.getValue()))
                                .append(")\n");
                    } else {
                        out.append(INDENT_2)
                                .append(".field(")
                                .append(quote(path))
                                .append(") // complex value\n");
                    }
                }
            }
            if (section.relatedContracts != null) {
                for (String key : section.relatedContracts) {
                    ContractEntry contractEntry = structure.contracts.get(key);
                    if (contractEntry == null) {
                        continue;
                    }
                    emitContract(out, contractEntry, contracts, includeSteps, emittedContracts);
                }
            }
            out.append(INDENT_1).append(".endSection()\n\n");
        }

        List<ContractEntry> remaining = new ArrayList<ContractEntry>();
        for (ContractEntry contractEntry : structure.contracts.values()) {
            if (contractEntry.kind == ContractKind.SECTION || emittedContracts.contains(contractEntry.key)) {
                continue;
            }
            remaining.add(contractEntry);
        }
        if (remaining.isEmpty()) {
            return;
        }

        out.append(INDENT_1).append(".section(\"_unsectioned\", \"Other\", \"Contracts without explicit sections\")\n");
        for (ContractEntry contractEntry : remaining) {
            emitContract(out, contractEntry, contracts, includeSteps, emittedContracts);
        }
        out.append(INDENT_1).append(".endSection()\n");
    }

    private static void emitContract(StringBuilder out,
                                     ContractEntry entry,
                                     Map<String, Node> contracts,
                                     boolean includeSteps,
                                     Set<String> emittedContracts) {
        if (entry == null || emittedContracts.contains(entry.key)) {
            return;
        }
        if (isMyOsAdminPattern(entry, contracts, emittedContracts)) {
            out.append(INDENT_2).append(".myOsAdmin(").append(quote(entry.channel)).append(")\n");
            emittedContracts.add(entry.key);
            emittedContracts.add(entry.key + "Impl");
            return;
        }
        if (isDirectChangePattern(entry, contracts, emittedContracts)) {
            out.append(INDENT_2)
                    .append(".directChange(")
                    .append(quote(entry.key))
                    .append(", ")
                    .append(quote(defaultIfBlank(entry.channel, "ownerChannel")))
                    .append(", ")
                    .append(quote(defaultIfBlank(entry.requestDescription, "Apply incoming changeset")))
                    .append(")\n");
            emittedContracts.add(entry.key);
            emittedContracts.add(entry.key + "Impl");
            return;
        }
        switch (entry.kind) {
            case CHANNEL -> {
                out.append(INDENT_2).append(".channel(").append(quote(entry.key)).append(")\n");
                emittedContracts.add(entry.key);
            }
            case COMPOSITE_CHANNEL -> {
                out.append(INDENT_2).append(".compositeChannel(").append(quote(entry.key));
                if (entry.compositeChildren != null) {
                    for (String child : entry.compositeChildren) {
                        out.append(", ").append(quote(child));
                    }
                }
                out.append(")\n");
                emittedContracts.add(entry.key);
            }
            case OPERATION -> {
                emittedContracts.add(entry.key);
                ContractEntry impl = findOperationImpl(entry.key, contracts);
                if (impl != null) {
                    emittedContracts.add(impl.key);
                }
                emitOperation(out, entry, impl, contracts.get(entry.key), contracts.get(impl == null ? null : impl.key), includeSteps);
            }
            case WORKFLOW -> {
                emittedContracts.add(entry.key);
                emitWorkflow(out, entry, contracts.get(entry.key), includeSteps);
            }
            case OPERATION_IMPL, SECTION -> emittedContracts.add(entry.key);
            case MARKER, OTHER -> {
                out.append(INDENT_2)
                        .append("// contract ")
                        .append(entry.key)
                        .append(" (")
                        .append(entry.kind)
                        .append(")\n");
                emittedContracts.add(entry.key);
            }
        }
    }

    private static void emitOperation(StringBuilder out,
                                      ContractEntry operation,
                                      ContractEntry impl,
                                      Node operationNode,
                                      Node implNode,
                                      boolean includeSteps) {
        out.append(INDENT_2).append(".operation(").append(quote(operation.key)).append(")\n");
        out.append(INDENT_3).append(".channel(").append(quote(defaultIfBlank(operation.channel, "ownerChannel"))).append(")\n");
        if (operation.requestDescription != null) {
            out.append(INDENT_3).append(".description(").append(quote(operation.requestDescription)).append(")\n");
        } else {
            String description = readText(operationNode, "description");
            if (description != null) {
                out.append(INDENT_3).append(".description(").append(quote(description)).append(")\n");
            }
        }
        if (operation.requestType == null) {
            out.append(INDENT_3).append(".noRequest()\n");
        } else {
            out.append(INDENT_3).append(".requestType(").append(classToken(operation.requestType)).append(")\n");
        }
        if (includeSteps && implNode != null) {
            out.append(renderStepsBlock(INDENT_3, implNode));
        } else {
            out.append(INDENT_3).append("// implementation in document JSON\n");
        }
        out.append(INDENT_3).append(".done()\n");
    }

    private static void emitWorkflow(StringBuilder out, ContractEntry workflow, Node workflowNode, boolean includeSteps) {
        String key = workflow.key;
        String channel = defaultIfBlank(workflow.channel, "triggeredEventChannel");
        String eventClassToken = classToken(workflow.eventMatcherType);

        if ("initLifecycleChannel".equals(channel)) {
            out.append(INDENT_2).append(".onInit(").append(quote(key)).append(", ");
            if (includeSteps) {
                out.append("steps -> steps\n");
                out.append(renderStepCalls(INDENT_3, workflowNode));
                out.append(INDENT_2).append(")\n");
            } else {
                out.append("steps -> steps) // implementation in document JSON\n");
            }
            return;
        }

        String requestId = readText(readNode(workflowNode, "event"), "requestId");
        String subscriptionId = readText(readNode(workflowNode, "event"), "subscriptionId");
        String eventAlias = workflow.eventMatcherType == null ? null : workflow.eventMatcherType.alias;

        if ("triggeredEventChannel".equals(channel) && requestId != null) {
            out.append(INDENT_2)
                    .append(".onMyOsResponse(")
                    .append(quote(key))
                    .append(", ")
                    .append(eventClassToken)
                    .append(", ")
                    .append(quote(requestId))
                    .append(", ")
                    .append(includeSteps ? "steps -> steps\n" : "steps -> steps) // implementation in document JSON\n");
            if (includeSteps) {
                out.append(renderStepCalls(INDENT_3, workflowNode));
                out.append(INDENT_2).append(")\n");
            }
            return;
        }
        if ("triggeredEventChannel".equals(channel) && subscriptionId != null && eventAlias != null && eventAlias.contains("Subscription Update")) {
            out.append(INDENT_2)
                    .append(".onSubscriptionUpdate(")
                    .append(quote(key))
                    .append(", ")
                    .append(quote(subscriptionId))
                    .append(", ")
                    .append(eventClassToken)
                    .append(", ")
                    .append(includeSteps ? "steps -> steps\n" : "steps -> steps) // implementation in document JSON\n");
            if (includeSteps) {
                out.append(renderStepCalls(INDENT_3, workflowNode));
                out.append(INDENT_2).append(")\n");
            }
            return;
        }
        if ("triggeredEventChannel".equals(channel) && eventAlias != null) {
            out.append(INDENT_2)
                    .append(".onEvent(")
                    .append(quote(key))
                    .append(", ")
                    .append(eventClassToken)
                    .append(", ")
                    .append(includeSteps ? "steps -> steps\n" : "steps -> steps) // implementation in document JSON\n");
            if (includeSteps) {
                out.append(renderStepCalls(INDENT_3, workflowNode));
                out.append(INDENT_2).append(")\n");
            }
            return;
        }

        if (eventAlias != null) {
            out.append(INDENT_2)
                    .append(".onChannelEvent(")
                    .append(quote(key))
                    .append(", ")
                    .append(quote(channel))
                    .append(", ")
                    .append(eventClassToken)
                    .append(", ")
                    .append(includeSteps ? "steps -> steps\n" : "steps -> steps) // implementation in document JSON\n");
            if (includeSteps) {
                out.append(renderStepCalls(INDENT_3, workflowNode));
                out.append(INDENT_2).append(")\n");
            }
            return;
        }

        out.append(INDENT_2)
                .append("// workflow ")
                .append(key)
                .append(" on channel ")
                .append(channel)
                .append('\n');
    }

    private static String renderStepsBlock(String indent, Node implNode) {
        StringBuilder out = new StringBuilder();
        out.append(indent).append(".steps(steps -> steps\n");
        out.append(renderStepCalls(indent + INDENT_1, implNode));
        out.append(indent).append(")\n");
        return out.toString();
    }

    private static String renderStepCalls(String indent, Node containerNode) {
        StringBuilder out = new StringBuilder();
        Node stepsNode = readNode(containerNode, "steps");
        if (stepsNode == null || stepsNode.getItems() == null) {
            return out.toString();
        }
        int index = 0;
        for (Node step : stepsNode.getItems()) {
            index++;
            String name = defaultIfBlank(step == null ? null : step.getName(), "Step" + index);
            String alias = alias(step == null ? null : step.getType());
            if (alias != null && alias.contains("Update Document")) {
                out.append(renderUpdateDocumentStep(indent, name, step));
                continue;
            }
            if (alias != null && alias.contains("JavaScript Code")) {
                out.append(indent)
                        .append(".jsRaw(")
                        .append(quote(name))
                        .append(", ")
                        .append(codeLiteral(readText(step, "code")))
                        .append(")\n");
                continue;
            }
            if (alias != null && alias.contains("Trigger Event")) {
                String eventAlias = alias(readNode(readNode(step, "event"), "type"));
                out.append(indent)
                        .append(".triggerEvent(")
                        .append(quote(name))
                        .append(", new Node().type(")
                        .append(quote(defaultIfBlank(eventAlias, "Unknown/Event")))
                        .append("))\n");
                continue;
            }
            out.append(indent)
                    .append(".raw(/* ")
                    .append(defaultIfBlank(alias, "Unknown Step"))
                    .append(" */ new Node())\n");
        }
        return out.toString();
    }

    private static String renderUpdateDocumentStep(String indent, String name, Node step) {
        Node changesetNode = readNode(step, "changeset");
        if (changesetNode == null) {
            return indent + ".updateDocument(\"" + escape(name) + "\", cs -> {})\n";
        }
        if (changesetNode.getValue() instanceof String) {
            return indent + ".updateDocumentFromExpression(" + quote(name) + ", " + quote(stripExpression(changesetNode.getValue().toString())) + ")\n";
        }
        if (changesetNode.getItems() != null && changesetNode.getItems().size() == 1) {
            Node patchEntry = changesetNode.getItems().get(0);
            String op = defaultIfBlank(readText(patchEntry, "op"), "replace").toLowerCase();
            String path = defaultIfBlank(readText(patchEntry, "path"), "/");
            Node val = readNode(patchEntry, "val");
            if ("replace".equals(op) && val != null && val.getValue() instanceof String stringVal && isExpression(stringVal)) {
                return indent + ".replaceExpression(" + quote(name) + ", " + quote(path) + ", " + quote(stripExpression(stringVal)) + ")\n";
            }
            if ("replace".equals(op) && val != null) {
                return indent + ".replaceValue(" + quote(name) + ", " + quote(path) + ", " + valueLiteral(val.getValue()) + ")\n";
            }
        }
        return indent + ".updateDocument(" + quote(name) + ", cs -> { /* complex changeset */ })\n";
    }

    private static ContractEntry findOperationImpl(String operationKey, Map<String, Node> contracts) {
        if (operationKey == null || contracts.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, Node> contractEntry : contracts.entrySet()) {
            Node node = contractEntry.getValue();
            String alias = alias(node == null ? null : node.getType());
            if (alias == null || !alias.contains("Sequential Workflow Operation")) {
                continue;
            }
            String boundOperation = readText(node, "operation");
            if (operationKey.equals(boundOperation)) {
                ContractEntry entry = new ContractEntry();
                entry.key = contractEntry.getKey();
                entry.kind = ContractKind.OPERATION_IMPL;
                entry.boundOperation = boundOperation;
                return entry;
            }
        }
        return null;
    }

    private static boolean isMyOsAdminPattern(ContractEntry operation, Map<String, Node> contracts, Set<String> emittedContracts) {
        if (operation == null || operation.kind != ContractKind.OPERATION || operation.channel == null) {
            return false;
        }
        if (emittedContracts.contains(operation.key)) {
            return false;
        }

        Node channelContract = contracts.get(operation.channel);
        String channelAlias = alias(channelContract == null ? null : channelContract.getType());
        if (channelAlias == null || !channelAlias.contains("MyOS Timeline")) {
            return false;
        }

        String derivedEmitKey = deriveEmitOperationKey(operation.channel);
        boolean defaultMyOsShortcut = "myOsAdminChannel".equals(operation.channel)
                && "myOsEmit".equals(operation.key);
        if (!operation.key.equals(derivedEmitKey) && !defaultMyOsShortcut) {
            return false;
        }

        Node impl = contracts.get(operation.key + "Impl");
        if (impl == null) {
            return false;
        }
        String alias = alias(impl.getType());
        if (alias == null || !alias.contains("Sequential Workflow Operation")) {
            return false;
        }
        Node steps = readNode(impl, "steps");
        if (steps == null || steps.getItems() == null || steps.getItems().isEmpty()) {
            return false;
        }
        Node firstStep = steps.getItems().get(0);
        String code = readText(firstStep, "code");
        return code != null
                && (code.contains("events: event")
                || code.contains("event?.message?.request ?? []"));
    }

    private static String deriveEmitOperationKey(String channelKey) {
        if (channelKey == null) {
            return null;
        }
        String trimmed = channelKey.trim();
        if (trimmed.endsWith("Channel") && trimmed.length() > "Channel".length()) {
            return trimmed.substring(0, trimmed.length() - "Channel".length()) + "Emit";
        }
        return trimmed + "Emit";
    }

    private static boolean hasContractPrefix(DocStructure structure, String prefix) {
        for (String key : structure.contracts.keySet()) {
            if (key != null && key.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isDirectChangePattern(ContractEntry operation, Map<String, Node> contracts, Set<String> emittedContracts) {
        if (operation == null || operation.kind != ContractKind.OPERATION || emittedContracts.contains(operation.key)) {
            return false;
        }
        Node impl = contracts.get(operation.key + "Impl");
        if (impl == null) {
            return false;
        }
        Node steps = readNode(impl, "steps");
        if (steps == null || steps.getItems() == null || steps.getItems().size() < 2) {
            return false;
        }
        Node first = steps.getItems().get(0);
        Node second = steps.getItems().get(1);
        String firstCode = readText(first, "code");
        Node changeset = readNode(second, "changeset");
        return firstCode != null
                && firstCode.contains("request.changeset ?? []")
                && changeset != null
                && changeset.getValue() instanceof String
                && String.valueOf(changeset.getValue()).contains("steps.CollectChangeset.changeset");
    }

    private static Map<String, Node> contractsMap(Node document) {
        if (document == null || document.getProperties() == null) {
            return Map.of();
        }
        Node contracts = document.getProperties().get("contracts");
        if (contracts == null || contracts.getProperties() == null) {
            return Map.of();
        }
        return contracts.getProperties();
    }

    private static Node readNode(Node node, String key) {
        if (node == null || node.getProperties() == null) {
            return null;
        }
        return node.getProperties().get(key);
    }

    private static String readText(Node node, String key) {
        Node child = readNode(node, key);
        if (child == null || child.getValue() == null) {
            return null;
        }
        return String.valueOf(child.getValue());
    }

    private static String alias(Node typeNode) {
        if (typeNode == null) {
            return null;
        }
        if (typeNode.getValue() != null) {
            return String.valueOf(typeNode.getValue());
        }
        if (typeNode.getName() != null) {
            return typeNode.getName();
        }
        return null;
    }

    private static boolean isAlias(TypeRef typeRef, String expectedAlias) {
        return typeRef != null && expectedAlias.equals(typeRef.alias);
    }

    private static String classToken(TypeRef typeRef) {
        if (typeRef == null || typeRef.alias == null) {
            return "Object.class";
        }
        return classToken(typeRef.alias);
    }

    private static String classToken(String alias) {
        if (alias == null) {
            return "Object.class";
        }
        String normalized = alias.trim();
        if ("Integer".equals(normalized)) {
            return "Integer.class";
        }
        if ("Text".equals(normalized) || "String".equals(normalized)) {
            return "String.class";
        }
        if ("Boolean".equals(normalized)) {
            return "Boolean.class";
        }
        if ("Double".equals(normalized)) {
            return "Double.class";
        }
        return "/* " + normalized + " */ Object.class";
    }

    private static String valueLiteral(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof String stringValue) {
            return quote(stringValue);
        }
        if (value instanceof Boolean) {
            return String.valueOf(value);
        }
        if (value instanceof BigInteger || value instanceof BigDecimal || value instanceof Number) {
            return String.valueOf(value);
        }
        return quote(String.valueOf(value));
    }

    private static String numberLiteral(Object value) {
        if (value == null) {
            return "0";
        }
        if (value instanceof Number || value instanceof BigInteger || value instanceof BigDecimal) {
            return String.valueOf(value);
        }
        return "0";
    }

    private static String codeLiteral(String code) {
        if (code == null) {
            return quote("");
        }
        if (!code.contains("\n")) {
            return quote(code);
        }
        String normalized = code.replace("\r\n", "\n");
        return "\"\"\"\n" + normalized + "\n\"\"\"";
    }

    private static boolean isExpression(String value) {
        return value != null && value.startsWith("${") && value.endsWith("}");
    }

    private static String stripExpression(String value) {
        if (!isExpression(value)) {
            return value;
        }
        return value.substring(2, value.length() - 1);
    }

    private static Node rootNode(Node document, String fieldPath) {
        if (document == null || document.getProperties() == null || fieldPath == null || !fieldPath.startsWith("/")) {
            return null;
        }
        return document.getProperties().get(fieldPath.substring(1));
    }

    private static Node rootNodeByRawPath(Node document, String fieldPath) {
        if (fieldPath == null || !fieldPath.startsWith("/")) {
            return null;
        }
        String[] segments = fieldPath.substring(1).split("/");
        Node current = document;
        for (String segment : segments) {
            if (current == null || current.getProperties() == null) {
                return null;
            }
            current = current.getProperties().get(segment);
        }
        return current;
    }

    private static Object scalarValue(Node document, String key, String nestedKey) {
        Node root = readNode(document, key);
        if (root == null || root.getProperties() == null) {
            return null;
        }
        Node nested = root.getProperties().get(nestedKey);
        return nested == null ? null : nested.getValue();
    }

    private static String scalarText(Node document, String key) {
        Node root = readNode(document, key);
        if (root == null || root.getValue() == null) {
            return null;
        }
        return String.valueOf(root.getValue());
    }

    private static String defaultIfBlank(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value;
    }

    private static String quote(String value) {
        return "\"" + escape(value) + "\"";
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n");
    }
}
