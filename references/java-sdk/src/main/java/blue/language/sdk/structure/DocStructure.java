package blue.language.sdk.structure;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.utils.Base58Sha256Provider;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;

public class DocStructure {

    private static final Blue BLUE = new Blue();
    private static final Base58Sha256Provider HASH_PROVIDER = new Base58Sha256Provider();

    public static final Set<String> RESERVED_ROOT_KEYS = new LinkedHashSet<String>(List.of(
            "name", "description", "type", "itemType", "keyType", "valueType",
            "value", "items", "blueId", "blue", "schema", "mergePolicy", "contracts", "policies"
    ));

    public String name;
    public String description;
    public TypeRef type;
    public LinkedHashMap<String, FieldEntry> rootFields = new LinkedHashMap<String, FieldEntry>();
    public LinkedHashMap<String, ContractEntry> contracts = new LinkedHashMap<String, ContractEntry>();
    public LinkedHashMap<String, SectionEntry> sections = new LinkedHashMap<String, SectionEntry>();

    public static DocStructure from(Node document) {
        DocStructure structure = new DocStructure();
        if (document == null) {
            return structure;
        }

        structure.name = document.getName();
        structure.description = document.getDescription();
        structure.type = TypeRef.fromNode(document.getType());

        Map<String, Node> properties = document.getProperties();
        if (properties != null) {
            for (String key : new TreeSet<String>(properties.keySet())) {
                if (isReservedRootKey(key)) {
                    continue;
                }
                FieldEntry fieldEntry = buildFieldEntry(key, properties.get(key));
                structure.rootFields.put(fieldEntry.path, fieldEntry);
            }
        }

        Node contractsNode = properties == null ? null : properties.get("contracts");
        Map<String, Node> contractNodes = contractsNode == null ? null : contractsNode.getProperties();
        if (contractNodes == null) {
            return structure;
        }

        for (String key : new TreeSet<String>(contractNodes.keySet())) {
            Node contractNode = contractNodes.get(key);
            ContractEntry contractEntry = buildContractEntry(key, contractNode);
            structure.contracts.put(key, contractEntry);
            if (contractEntry.kind == ContractKind.SECTION) {
                structure.sections.put(key, buildSectionEntry(key, contractNode));
            }
        }

        return structure;
    }

    public String toPromptText() {
        StringBuilder text = new StringBuilder();
        text.append("Document: ").append(name == null ? "(unnamed)" : name).append('\n');
        text.append("Type: ").append(type == null ? "n/a" : safe(type.display())).append('\n');
        if (description != null) {
            text.append("Description: ").append(description).append('\n');
        }

        text.append('\n').append("Root fields:").append('\n');
        if (rootFields.isEmpty()) {
            text.append("  (none)").append('\n');
        } else {
            for (FieldEntry entry : rootFields.values()) {
                text.append("  ")
                        .append(entry.path)
                        .append(" = ")
                        .append(formatFieldPreview(entry))
                        .append('\n');
            }
        }

        text.append('\n').append("Contracts (").append(contracts.size()).append("):").append('\n');
        if (contracts.isEmpty()) {
            text.append("  (none)").append('\n');
        } else {
            for (ContractEntry entry : contracts.values()) {
                text.append("  ")
                        .append(paddedKind(entry.kind))
                        .append(" ")
                        .append(entry.key);
                String typeDisplay = entry.type == null ? null : entry.type.display();
                if (typeDisplay != null) {
                    text.append(" — ").append(typeDisplay);
                }
                List<String> metadata = contractMetadata(entry);
                if (!metadata.isEmpty()) {
                    if (typeDisplay == null) {
                        text.append(" — ");
                    } else {
                        text.append(", ");
                    }
                    text.append(String.join(", ", metadata));
                }
                text.append('\n');
            }
        }

        text.append('\n').append("Sections (").append(sections.size()).append("):").append('\n');
        if (sections.isEmpty()) {
            text.append("  (none)");
        } else {
            for (SectionEntry section : sections.values()) {
                int relatedFieldsCount = section.relatedFields == null ? 0 : section.relatedFields.size();
                int relatedContractsCount = section.relatedContracts == null ? 0 : section.relatedContracts.size();
                text.append("  ")
                        .append(section.key)
                        .append(": ")
                        .append('"')
                        .append(section.title == null ? "" : section.title)
                        .append('"')
                        .append(" — ")
                        .append(relatedFieldsCount)
                        .append(" fields, ")
                        .append(relatedContractsCount)
                        .append(" contracts")
                        .append('\n');
            }
        }

        return text.toString().trim();
    }

    public static boolean isReservedRootKey(String key) {
        return key != null && RESERVED_ROOT_KEYS.contains(key);
    }

    private static FieldEntry buildFieldEntry(String key, Node node) {
        FieldEntry field = new FieldEntry();
        field.path = "/" + key;
        field.valueKind = valueKind(node);
        field.preview = preview(node);
        field.type = node == null ? null : TypeRef.fromNode(node.getType());
        return field;
    }

    private static ContractEntry buildContractEntry(String key, Node contractNode) {
        ContractEntry contract = new ContractEntry();
        contract.key = key;
        contract.type = contractNode == null ? null : TypeRef.fromNode(contractNode.getType());
        contract.kind = detectKind(contract.type);

        contract.channel = readTextProperty(contractNode, "channel");
        contract.boundOperation = readTextProperty(contractNode, "operation");
        contract.compositeChildren = readStringItems(contractNode, "channels");
        contract.fingerprint = fingerprint(contractNode);

        Node requestNode = readProperty(contractNode, "request");
        if (requestNode != null) {
            contract.requestType = TypeRef.fromNode(requestNode.getType());
            contract.requestDescription = readTextProperty(requestNode, "description");
        }

        Node eventNode = readProperty(contractNode, "event");
        if (eventNode != null) {
            contract.eventMatcherType = TypeRef.fromNode(eventNode.getType());
        }
        return contract;
    }

    private static SectionEntry buildSectionEntry(String key, Node sectionNode) {
        SectionEntry section = new SectionEntry();
        section.key = key;
        section.title = readTextProperty(sectionNode, "title");
        section.summary = readTextProperty(sectionNode, "summary");
        section.relatedFields = readStringItems(sectionNode, "relatedFields");
        section.relatedContracts = readStringItems(sectionNode, "relatedContracts");
        return section;
    }

    private static Node readProperty(Node node, String key) {
        if (node == null || node.getProperties() == null) {
            return null;
        }
        return node.getProperties().get(key);
    }

    private static String readTextProperty(Node node, String key) {
        Node property = readProperty(node, key);
        if (property == null || property.getValue() == null) {
            return null;
        }
        return String.valueOf(property.getValue());
    }

    private static List<String> readStringItems(Node node, String key) {
        Node property = readProperty(node, key);
        if (property == null || property.getItems() == null) {
            return null;
        }
        List<String> values = new ArrayList<String>();
        for (Node item : property.getItems()) {
            if (item == null || item.getValue() == null) {
                continue;
            }
            values.add(String.valueOf(item.getValue()));
        }
        return values;
    }

    private static ContractKind detectKind(TypeRef typeRef) {
        String descriptor = typeRef == null ? null : safe(typeRef.display());
        if (descriptor == null) {
            return ContractKind.OTHER;
        }
        String alias = descriptor.toLowerCase();
        if (alias.contains("composite timeline channel")) {
            return ContractKind.COMPOSITE_CHANNEL;
        }
        if (alias.contains("core/channel")) {
            return ContractKind.CHANNEL;
        }
        if (alias.contains("timeline channel")) {
            return ContractKind.CHANNEL;
        }
        if (alias.contains("sequential workflow operation")) {
            return ContractKind.OPERATION_IMPL;
        }
        if (alias.contains("conversation/operation") || alias.contains("change operation")) {
            return ContractKind.OPERATION;
        }
        if (alias.contains("sequential workflow")) {
            return ContractKind.WORKFLOW;
        }
        if (alias.contains("document section")) {
            return ContractKind.SECTION;
        }
        if (alias.contains("marker") || alias.contains("checkpoint") || alias.contains("process embedded")) {
            return ContractKind.MARKER;
        }
        return ContractKind.OTHER;
    }

    private static String valueKind(Node node) {
        if (node == null) {
            return "null";
        }
        if (node.getValue() != null) {
            return "scalar";
        }
        if (node.getItems() != null) {
            return "list";
        }
        if (node.getProperties() != null) {
            return "object";
        }
        return "null";
    }

    private static String preview(Node node) {
        if (node == null) {
            return "null";
        }
        if (node.getValue() != null) {
            return String.valueOf(node.getValue());
        }
        if (node.getItems() != null) {
            return "[" + node.getItems().size() + " items]";
        }
        if (node.getProperties() != null) {
            return "{" + node.getProperties().size() + " fields}";
        }
        return "null";
    }

    private static String fingerprint(Node contractNode) {
        if (contractNode == null) {
            return null;
        }
        JsonNode canonicalTree = JSON_MAPPER.readTree(canonicalSimpleJson(contractNode));
        return HASH_PROVIDER.apply(canonicalTree);
    }

    private static String canonicalSimpleJson(Node node) {
        try {
            return BLUE.nodeToSimpleJson(BLUE.preprocess(node.clone()));
        } catch (Exception ex) {
            return BLUE.nodeToSimpleJson(node.clone());
        }
    }

    private static String paddedKind(ContractKind kind) {
        if (kind == null) {
            return "OTHER      ";
        }
        return switch (kind) {
            case CHANNEL -> "CHANNEL    ";
            case COMPOSITE_CHANNEL -> "COMP_CHAN  ";
            case OPERATION -> "OPERATION  ";
            case OPERATION_IMPL -> "OP_IMPL    ";
            case WORKFLOW -> "WORKFLOW   ";
            case SECTION -> "SECTION    ";
            case MARKER -> "MARKER     ";
            case OTHER -> "OTHER      ";
        };
    }

    private static List<String> contractMetadata(ContractEntry entry) {
        List<String> values = new ArrayList<String>();
        if (entry == null) {
            return values;
        }
        if (entry.channel != null) {
            values.add("channel: " + entry.channel);
        }
        if (entry.boundOperation != null) {
            values.add("implements: " + entry.boundOperation);
        }
        if (entry.eventMatcherType != null && entry.eventMatcherType.display() != null) {
            values.add("event: " + entry.eventMatcherType.display());
        }
        if (entry.requestType != null && entry.requestType.display() != null) {
            values.add("request: " + entry.requestType.display());
        }
        if (entry.compositeChildren != null && !entry.compositeChildren.isEmpty()) {
            values.add("children: " + entry.compositeChildren);
        }
        return values;
    }

    private static String formatFieldPreview(FieldEntry entry) {
        if (entry == null || entry.preview == null) {
            return "null";
        }
        if (!"scalar".equals(entry.valueKind)) {
            return entry.preview;
        }
        String value = entry.preview;
        if (isNumber(value) || "true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value) || "null".equals(value)) {
            return value;
        }
        return '"' + value + '"';
    }

    private static boolean isNumber(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return value.matches("-?\\d+(\\.\\d+)?");
    }

    private static String safe(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }
}
