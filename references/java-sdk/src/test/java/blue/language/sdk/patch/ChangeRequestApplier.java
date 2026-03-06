package blue.language.sdk.patch;

import blue.language.model.Node;
import blue.language.sdk.structure.DocStructure;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ChangeRequestApplier {

    private ChangeRequestApplier() {
    }

    public static Node apply(Node base, Node changeRequest) {
        if (base == null) {
            throw new IllegalArgumentException("base document is required");
        }
        if (changeRequest == null) {
            return base;
        }

        applyRootChangeset(base, readProperty(changeRequest, "changeset"));
        DocStructure sectionReference = DocStructure.from(base.clone());
        applySectionChanges(base, readProperty(changeRequest, "sectionChanges"), sectionReference);
        return base;
    }

    private static void applyRootChangeset(Node base, Node changeset) {
        if (changeset == null || changeset.getItems() == null) {
            return;
        }
        PatchSet patchSet = new PatchSet();
        for (Node patchNode : changeset.getItems()) {
            PatchEntry entry = toPatchEntry(patchNode);
            if (entry != null) {
                patchSet.entries.add(entry);
            }
        }
        patchSet.apply(base);
    }

    private static PatchEntry toPatchEntry(Node patchNode) {
        if (patchNode == null || patchNode.getProperties() == null) {
            return null;
        }
        String op = readText(patchNode, "op");
        String path = readText(patchNode, "path");
        if (op == null || path == null) {
            return null;
        }
        Node val = readProperty(patchNode, "val");
        if ("remove".equalsIgnoreCase(op)) {
            return PatchEntry.remove(path);
        }
        if ("add".equalsIgnoreCase(op)) {
            return PatchEntry.add(path, val == null ? new Node().value(null) : val.clone());
        }
        return PatchEntry.replace(path, val == null ? new Node().value(null) : val.clone());
    }

    private static void applySectionChanges(Node base, Node sectionChanges, DocStructure sectionReference) {
        if (sectionChanges == null || sectionChanges.getProperties() == null) {
            return;
        }
        List<Node> removeEntries = readItems(sectionChanges, "remove");
        for (Node removeEntry : removeEntries) {
            if (removeEntry == null || removeEntry.getValue() == null) {
                continue;
            }
            removeSection(base, String.valueOf(removeEntry.getValue()), sectionReference);
        }

        List<Node> modifyEntries = readItems(sectionChanges, "modify");
        for (Node modifyEntry : modifyEntries) {
            applySectionEntry(base, modifyEntry, sectionReference, true);
        }

        List<Node> addEntries = readItems(sectionChanges, "add");
        for (Node addEntry : addEntries) {
            applySectionEntry(base, addEntry, sectionReference, false);
        }
    }

    private static void applySectionEntry(Node base, Node entryNode, DocStructure sectionReference, boolean replaceExisting) {
        if (entryNode == null || entryNode.getProperties() == null) {
            return;
        }
        String sectionKey = readText(entryNode, "sectionKey");
        if (sectionKey == null || sectionKey.isBlank()) {
            return;
        }

        Map<String, Node> contracts = ensureContracts(base);
        if (replaceExisting) {
            removeSectionContracts(base, sectionKey, sectionReference);
        }

        Node contractsNode = readProperty(entryNode, "contracts");
        if (contractsNode != null && contractsNode.getProperties() != null) {
            for (Map.Entry<String, Node> contractEntry : contractsNode.getProperties().entrySet()) {
                contracts.put(contractEntry.getKey(), contractEntry.getValue() == null ? null : contractEntry.getValue().clone());
            }
        }

        Node sectionNode = readProperty(entryNode, "section");
        boolean sectionExistedInReference = sectionReference.sections.containsKey(sectionKey);
        boolean sectionContractProvidedInEntry = contractsNode != null
                && contractsNode.getProperties() != null
                && contractsNode.getProperties().containsKey(sectionKey);
        if (sectionNode != null && (sectionExistedInReference || sectionContractProvidedInEntry)) {
            contracts.put(sectionKey, sectionNode.clone());
        }
    }

    private static void removeSection(Node base, String sectionKey, DocStructure sectionReference) {
        removeSectionContracts(base, sectionKey, sectionReference);
        ensureContracts(base).remove(sectionKey);
    }

    private static void removeSectionContracts(Node base, String sectionKey, DocStructure sectionReference) {
        Map<String, Node> contracts = ensureContracts(base);
        LinkedHashMap<String, List<String>> sections = ChangeRequestCompiler.sectionContractMap(base, sectionReference);
        List<String> keys = sections.get(sectionKey);
        if (keys == null) {
            return;
        }
        for (String key : keys) {
            contracts.remove(key);
        }
    }

    private static List<Node> readItems(Node parent, String key) {
        Node value = readProperty(parent, key);
        if (value == null || value.getItems() == null) {
            return List.of();
        }
        return value.getItems();
    }

    private static Node readProperty(Node parent, String key) {
        if (parent == null || parent.getProperties() == null) {
            return null;
        }
        return parent.getProperties().get(key);
    }

    private static String readText(Node node, String key) {
        Node property = readProperty(node, key);
        if (property == null || property.getValue() == null) {
            return null;
        }
        return String.valueOf(property.getValue());
    }

    private static Map<String, Node> ensureContracts(Node document) {
        if (document.getProperties() == null) {
            document.properties(new LinkedHashMap<String, Node>());
        }
        Node contractsNode = document.getProperties().get("contracts");
        if (contractsNode == null) {
            contractsNode = new Node().properties(new LinkedHashMap<String, Node>());
            document.getProperties().put("contracts", contractsNode);
        }
        if (contractsNode.getProperties() == null) {
            contractsNode.properties(new LinkedHashMap<String, Node>());
        }
        return contractsNode.getProperties();
    }
}
