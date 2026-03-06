package blue.language.sdk.patch;

import blue.language.model.Node;
import blue.language.sdk.structure.ContractEntry;
import blue.language.sdk.structure.ContractKind;
import blue.language.sdk.structure.DocStructure;
import blue.language.sdk.structure.SectionEntry;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

public class ChangeRequestCompiler {

    private static final String DEFAULT_SUMMARY = "Auto-generated change request";

    public static Node compile(Node before, Node after) {
        return compile(before, after, DEFAULT_SUMMARY);
    }

    public static Node compile(Node before, Node after, String summary) {
        Node safeBefore = before == null ? new Node() : before;
        Node safeAfter = after == null ? new Node() : after;

        PatchSet rootDiff = PatchSet.diff(safeBefore, safeAfter, DiffScope.ROOT_FIELDS_ONLY);
        List<PatchEntry> changesetEntries = withNameAndDescriptionPatches(rootDiff.entries, safeBefore, safeAfter);

        PatchSet contractDiff = PatchSet.diff(safeBefore, safeAfter, DiffScope.CONTRACTS_ONLY);
        Node sectionChangesNode = buildSectionChanges(safeBefore, safeAfter, contractDiff.entries);

        return new Node()
                .type("Conversation/Change Request")
                .properties("summary", new Node().value(summary == null ? DEFAULT_SUMMARY : summary))
                .properties("changeset", toChangesetList(changesetEntries))
                .properties("sectionChanges", sectionChangesNode);
    }

    static Node buildSectionChanges(Node before, Node after, List<PatchEntry> contractDiffEntries) {
        DocStructure beforeStructure = DocStructure.from(before);
        DocStructure afterStructure = DocStructure.from(after);

        LinkedHashMap<String, List<String>> beforeSections = sectionContractMap(before, beforeStructure);
        LinkedHashMap<String, List<String>> afterSections = sectionContractMap(after, beforeStructure);

        TreeSet<String> affectedSectionKeys = new TreeSet<String>();
        for (PatchEntry diffEntry : contractDiffEntries) {
            if (diffEntry == null || diffEntry.path == null) {
                continue;
            }
            String contractKey = diffEntry.path;
            String operation = diffEntry.op == null ? "" : diffEntry.op.trim().toLowerCase();
            ContractEntry beforeEntry = beforeStructure.contracts.get(contractKey);
            ContractEntry afterEntry = afterStructure.contracts.get(contractKey);

            if (isSectionContract(beforeEntry) || isSectionContract(afterEntry)) {
                affectedSectionKeys.add(contractKey);
                continue;
            }

            String beforeSection = null;
            String afterSection = null;
            if ("remove".equals(operation) || "replace".equals(operation)) {
                beforeSection = resolveSectionKey(
                        contractKey,
                        beforeStructure,
                        beforeEntry,
                        beforeEntry,
                        beforeStructure.contracts);
            }
            if ("add".equals(operation) || "replace".equals(operation)) {
                afterSection = resolveSectionKey(
                        contractKey,
                        beforeStructure,
                        beforeEntry,
                        afterEntry,
                        afterStructure.contracts);
            }

            if (beforeSection != null) {
                affectedSectionKeys.add(beforeSection);
            }
            if (afterSection != null) {
                affectedSectionKeys.add(afterSection);
            }
        }

        List<Node> addEntries = new ArrayList<Node>();
        List<Node> modifyEntries = new ArrayList<Node>();
        List<Node> removeEntries = new ArrayList<Node>();

        for (String sectionKey : affectedSectionKeys) {
            List<String> beforeContracts = beforeSections.getOrDefault(sectionKey, List.of());
            List<String> afterContracts = afterSections.getOrDefault(sectionKey, List.of());

            if (afterContracts.isEmpty()) {
                removeEntries.add(new Node().value(sectionKey));
                continue;
            }

            Node changeEntry = buildSectionChangeEntry(sectionKey, beforeStructure, afterStructure, afterContracts, after);
            if (beforeContracts.isEmpty()) {
                addEntries.add(changeEntry);
            } else {
                modifyEntries.add(changeEntry);
            }
        }

        return new Node()
                .type("Conversation/Document Section Changes")
                .properties("add", new Node().items(addEntries))
                .properties("modify", new Node().items(modifyEntries))
                .properties("remove", new Node().items(removeEntries));
    }

    static LinkedHashMap<String, List<String>> sectionContractMap(Node document, DocStructure beforeReference) {
        DocStructure current = DocStructure.from(document);
        LinkedHashMap<String, List<String>> map = inferSectionContracts(current, beforeReference);

        for (SectionEntry section : current.sections.values()) {
            List<String> explicit = section.relatedContracts == null
                    ? new ArrayList<String>()
                    : new ArrayList<String>(section.relatedContracts);
            map.put(section.key, explicit);
        }
        return map;
    }

    static LinkedHashMap<String, List<String>> inferSectionContracts(DocStructure current, DocStructure beforeReference) {
        LinkedHashMap<String, List<String>> sections = new LinkedHashMap<String, List<String>>();
        for (Map.Entry<String, ContractEntry> contractMapEntry : current.contracts.entrySet()) {
            String key = contractMapEntry.getKey();
            ContractEntry currentEntry = contractMapEntry.getValue();
            if (currentEntry == null || currentEntry.kind == ContractKind.SECTION) {
                continue;
            }

            ContractEntry beforeEntry = beforeReference == null ? null : beforeReference.contracts.get(key);
            String sectionKey = resolveSectionKey(
                    key,
                    beforeReference,
                    beforeEntry,
                    currentEntry,
                    current.contracts);
            if (sectionKey == null) {
                continue;
            }
            sections.computeIfAbsent(sectionKey, ignored -> new ArrayList<String>()).add(key);
        }
        return sections;
    }

    static String resolveSectionKey(String contractKey,
                                    DocStructure beforeStructure,
                                    ContractEntry beforeEntry,
                                    ContractEntry currentEntry,
                                    Map<String, ContractEntry> currentContracts) {
        if (contractKey == null) {
            return null;
        }
        if (beforeStructure != null) {
            String bySectionMembership = sectionFromBeforeMembership(contractKey, beforeStructure.sections);
            if (bySectionMembership != null) {
                return bySectionMembership;
            }
        }

        ContractEntry entry = currentEntry != null ? currentEntry : beforeEntry;
        if (entry == null || entry.kind == null) {
            return "misc";
        }

        return switch (entry.kind) {
            case CHANNEL, COMPOSITE_CHANNEL -> "participants";
            case OPERATION, OPERATION_IMPL, WORKFLOW -> flowSectionKey(entry, currentContracts,
                    beforeStructure == null ? null : beforeStructure.contracts);
            case SECTION -> null;
            case MARKER, OTHER -> "misc";
        };
    }

    private static Node buildSectionChangeEntry(String sectionKey,
                                                DocStructure beforeStructure,
                                                DocStructure afterStructure,
                                                List<String> sectionContracts,
                                                Node afterDocument) {
        Map<String, Node> afterContracts = contractsMap(afterDocument);
        SectionEntry afterSection = afterStructure.sections.get(sectionKey);
        SectionEntry beforeSection = beforeStructure.sections.get(sectionKey);

        Node sectionNode = buildSectionNode(sectionKey, beforeSection, afterSection, sectionContracts);
        Node contractsNode = new Node().properties(new LinkedHashMap<String, Node>());
        for (String contractKey : sectionContracts) {
            Node contractNode = afterContracts.get(contractKey);
            if (contractNode == null) {
                continue;
            }
            contractsNode.getProperties().put(contractKey, contractNode.clone());
        }
        Node explicitSectionContract = afterContracts.get(sectionKey);
        if (explicitSectionContract != null) {
            contractsNode.getProperties().put(sectionKey, explicitSectionContract.clone());
        }

        return new Node()
                .type("Conversation/Document Section Change Entry")
                .properties("sectionKey", new Node().value(sectionKey))
                .properties("section", sectionNode)
                .properties("contracts", contractsNode);
    }

    private static Node buildSectionNode(String sectionKey,
                                         SectionEntry beforeSection,
                                         SectionEntry afterSection,
                                         List<String> sectionContracts) {
        String title = firstNonBlank(
                afterSection == null ? null : afterSection.title,
                beforeSection == null ? null : beforeSection.title,
                autoSectionTitle(sectionKey));
        String summary = firstNonBlank(
                afterSection == null ? null : afterSection.summary,
                beforeSection == null ? null : beforeSection.summary,
                "Auto-generated section");

        List<String> relatedFields = afterSection != null && afterSection.relatedFields != null
                ? afterSection.relatedFields
                : (beforeSection == null ? null : beforeSection.relatedFields);

        Node sectionNode = new Node()
                .type("Conversation/Document Section")
                .properties("title", new Node().value(title))
                .properties("summary", new Node().value(summary))
                .properties("relatedContracts", toStringListNode(sectionContracts));

        if (relatedFields != null) {
            sectionNode.properties("relatedFields", toStringListNode(relatedFields));
        }
        return sectionNode;
    }

    private static List<PatchEntry> withNameAndDescriptionPatches(List<PatchEntry> rootEntries, Node before, Node after) {
        List<PatchEntry> entries = new ArrayList<PatchEntry>();
        if (!Objects.equals(before.getName(), after.getName())) {
            entries.add(PatchEntry.replace("/name", new Node().value(after.getName())));
        }
        if (!Objects.equals(before.getDescription(), after.getDescription())) {
            entries.add(PatchEntry.replace("/description", new Node().value(after.getDescription())));
        }
        entries.addAll(rootEntries);
        return entries;
    }

    private static Node toChangesetList(List<PatchEntry> patches) {
        List<Node> items = new ArrayList<Node>();
        for (PatchEntry patch : patches) {
            if (patch == null) {
                continue;
            }
            Node entryNode = new Node()
                    .type("Core/Json Patch Entry")
                    .properties("op", new Node().value(patch.op))
                    .properties("path", new Node().value(patch.path));
            if (!"remove".equalsIgnoreCase(patch.op)) {
                entryNode.properties("val", patch.val == null ? new Node().value(null) : patch.val.clone());
            }
            items.add(entryNode);
        }
        return new Node().items(items);
    }

    private static String sectionFromBeforeMembership(String contractKey, LinkedHashMap<String, SectionEntry> sections) {
        if (sections == null || sections.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, SectionEntry> sectionMapEntry : sections.entrySet()) {
            SectionEntry section = sectionMapEntry.getValue();
            if (section.relatedContracts != null && section.relatedContracts.contains(contractKey)) {
                return sectionMapEntry.getKey();
            }
        }
        return null;
    }

    private static String flowSectionKey(ContractEntry entry,
                                         Map<String, ContractEntry> currentContracts,
                                         Map<String, ContractEntry> beforeContracts) {
        String channel = entry.channel;
        if (channel == null && entry.kind == ContractKind.OPERATION_IMPL && entry.boundOperation != null) {
            ContractEntry operationEntry = currentContracts == null ? null : currentContracts.get(entry.boundOperation);
            if (operationEntry == null && beforeContracts != null) {
                operationEntry = beforeContracts.get(entry.boundOperation);
            }
            channel = operationEntry == null ? null : operationEntry.channel;
        }
        if (channel == null || channel.isBlank()) {
            return "operations";
        }
        return "flow-" + sanitize(channel);
    }

    private static String sanitize(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            return "operations";
        }
        return normalized.replaceAll("[^a-zA-Z0-9_\\-]", "-");
    }

    private static String autoSectionTitle(String sectionKey) {
        if ("participants".equals(sectionKey)) {
            return "Participants";
        }
        if ("misc".equals(sectionKey)) {
            return "Misc";
        }
        if (sectionKey != null && sectionKey.startsWith("flow-")) {
            return "Flow " + sectionKey.substring("flow-".length());
        }
        return "Section " + sectionKey;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static Node toStringListNode(List<String> strings) {
        List<Node> items = new ArrayList<Node>();
        if (strings != null) {
            for (String value : strings) {
                items.add(new Node().value(value));
            }
        }
        return new Node().items(items);
    }

    private static boolean isSectionContract(ContractEntry contractEntry) {
        return contractEntry != null && contractEntry.kind == ContractKind.SECTION;
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
}
