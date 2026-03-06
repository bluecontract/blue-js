package blue.language.sdk.structure;

import blue.language.model.Node;
import blue.language.samples.paynote.voucher.ArmchairProtectionWithVoucherPayNote;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.myos.Agent;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SubscriptionToSessionInitiated;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocStructureTest {

    @Test
    void counterDocumentExtractsOperationAndChannelKinds() {
        Node document = DocBuilder.doc()
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment counter")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') + event.message.request"))
                    .done()
                .operation("decrement")
                    .channel("ownerChannel")
                    .description("Decrement counter")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') - event.message.request"))
                    .done()
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertEquals(2, countKinds(structure, ContractKind.OPERATION));
        assertEquals(2, countKinds(structure, ContractKind.OPERATION_IMPL));
        assertEquals(1, countKinds(structure, ContractKind.CHANNEL));
        assertTrue(structure.rootFields.containsKey("/counter"));
    }

    @Test
    void compositeChannelContractContainsChildren() {
        Node document = DocBuilder.doc()
                .name("Composite channels")
                .channels("a", "b")
                .compositeChannel("union", "a", "b")
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        ContractEntry entry = structure.contracts.get("union");
        assertNotNull(entry);
        assertEquals(ContractKind.COMPOSITE_CHANNEL, entry.kind);
        assertEquals(java.util.List.of("a", "b"), entry.compositeChildren);
    }

    @Test
    void directChangeRecognizesOperationAndRootFields() {
        Node document = DocBuilder.doc()
                .name("Direct change")
                .field("/counter", 1)
                .channel("ownerChannel")
                .directChange("applyPatch", "ownerChannel", "Apply patch")
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertEquals(ContractKind.OPERATION, structure.contracts.get("applyPatch").kind);
        assertTrue(structure.rootFields.containsKey("/counter"));
    }

    @Test
    void onInitWorkflowIncludesLifecycleChannelReference() {
        Node document = DocBuilder.doc()
                .name("Init workflow")
                .onInit("initialize", steps -> steps.replaceValue("Ready", "/status", "ready"))
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        ContractEntry workflow = structure.contracts.get("initialize");
        assertEquals(ContractKind.WORKFLOW, workflow.kind);
        assertEquals("initLifecycleChannel", workflow.channel);
    }

    @Test
    void onDocChangeDetectsGeneratedDocUpdateChannelAndWorkflow() {
        Node document = DocBuilder.doc()
                .name("Doc change")
                .onDocChange("watchPrice", "/price", steps -> steps.replaceValue("Set", "/changed", true))
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("watchPrice").kind);
        assertTrue(structure.contracts.containsKey("watchPriceDocUpdateChannel"));
    }

    @Test
    void myOsAdminContractsAreOperationAndOperationImpl() {
        Node document = DocBuilder.doc()
                .name("MyOS admin")
                .myOsAdmin("myOsAdminChannel")
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertEquals(ContractKind.OPERATION, structure.contracts.get("myOsAdminEmit").kind);
        assertEquals(ContractKind.OPERATION_IMPL, structure.contracts.get("myOsAdminEmitImpl").kind);
    }

    @Test
    void aiIntegrationDetectsPermissionAndSubscriptionWorkflowsAndSection() {
        Node document = DocBuilder.doc()
                .name("AI agent")
                .type(Agent.class)
                .field("/llmProviderSessionId", "session-llm-001")
                .channel("ownerChannel")
                .onInit("requestLlmAccess", steps -> steps.myOs().requestSingleDocPermission(
                        "ownerChannel",
                        "REQ_LLM",
                        DocBuilder.expr("document('/llmProviderSessionId')"),
                        MyOsPermissions.create().read(true)))
                .onMyOsResponse("onLlmAccessGranted",
                        SingleDocumentPermissionGranted.class,
                        "REQ_LLM",
                        steps -> steps.myOs().subscribeToSession(
                                "ownerChannel",
                                DocBuilder.expr("document('/llmProviderSessionId')"),
                                "SUB_1"))
                .onSubscriptionUpdate("onLlmUpdate",
                        "SUB_1",
                        SubscriptionToSessionInitiated.class,
                        steps -> steps.replaceValue("Ready", "/status", "ready"))
                .buildDocument();
        putSection(document, "aiContracts", "AI contracts", "auto", java.util.List.of("/llmProviderSessionId"),
                java.util.List.of("requestLlmAccess", "onLlmAccessGranted", "onLlmUpdate"));

        DocStructure structure = DocStructure.from(document);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("requestLlmAccess").kind);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("onLlmAccessGranted").kind);
        assertTrue(structure.sections.containsKey("aiContracts"));
        assertEquals(3, structure.sections.get("aiContracts").relatedContracts.size());
    }

    @Test
    void payNoteSimpleCaptureDetectsDefaultChannelsAndCaptureWorkflows() {
        Node document = PayNotes.payNote("Simple capture")
                .currency("USD")
                .amountMinor(1000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation("unlockCapture", "payerChannel", "unlock capture")
                    .requestOnOperation("requestCapture", "guarantorChannel", "request capture")
                    .done()
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertTrue(structure.contracts.containsKey("payerChannel"));
        assertTrue(structure.contracts.containsKey("payeeChannel"));
        assertTrue(structure.contracts.containsKey("guarantorChannel"));
        assertEquals(3, countKinds(structure, ContractKind.CHANNEL));
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("captureLockOnInit").kind);
    }

    @Test
    void payNoteReserveCaptureReleaseDetectsAllWorkflowPhases() {
        Node document = PayNotes.payNote("Reserve + capture + release")
                .currency("USD")
                .amountMinor(1000)
                .reserve().requestOnInit().done()
                .capture().requestOnInit().done()
                .release().requestOnInit().done()
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("reserveRequestOnInit").kind);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("captureRequestOnInit").kind);
        assertEquals(ContractKind.WORKFLOW, structure.contracts.get("releaseRequestOnInit").kind);
    }

    @Test
    void voucherCompositionIsHandledWithoutErrors() {
        Node document = ArmchairProtectionWithVoucherPayNote.templateDoc();
        DocStructure structure = assertDoesNotThrow(() -> DocStructure.from(document));
        assertNotNull(structure.contracts.get("requestVoucherPayment"));
        assertNotNull(document.getAsNode("/contracts/requestVoucherPayment/steps/0/event/attachedPayNote"));
    }

    @Test
    void unknownContractTypeFallsBackToOtherKind() {
        Node document = DocBuilder.doc()
                .name("Unknown contract")
                .buildDocument();
        ensureContracts(document).put("mystery", new Node().type("Custom/Mystery Contract").properties("x", new Node().value(1)));

        DocStructure structure = assertDoesNotThrow(() -> DocStructure.from(document));
        assertEquals(ContractKind.OTHER, structure.contracts.get("mystery").kind);
    }

    @Test
    void emptyDocumentProducesEmptyStructureWithoutErrors() {
        DocStructure structure = assertDoesNotThrow(() -> DocStructure.from(new Node()));
        assertTrue(structure.contracts.isEmpty());
        assertTrue(structure.rootFields.isEmpty());
        assertTrue(structure.sections.isEmpty());
    }

    @Test
    void promptTextContainsDocumentNameAndContractKeys() {
        Node document = DocBuilder.doc()
                .name("Prompt doc")
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .steps(steps -> steps.replaceValue("Set", "/counter", 1))
                    .done()
                .buildDocument();

        DocStructure structure = DocStructure.from(document);
        String prompt = assertDoesNotThrow(structure::toPromptText);
        assertTrue(prompt.contains("Document: Prompt doc"));
        assertTrue(prompt.contains("ownerChannel"));
        assertTrue(prompt.contains("increment"));
    }

    private static int countKinds(DocStructure structure, ContractKind kind) {
        int count = 0;
        for (ContractEntry entry : structure.contracts.values()) {
            if (entry.kind == kind) {
                count++;
            }
        }
        return count;
    }

    private static void putSection(Node document,
                                   String key,
                                   String title,
                                   String summary,
                                   java.util.List<String> relatedFields,
                                   java.util.List<String> relatedContracts) {
        Node section = new Node().type("Conversation/Document Section")
                .properties("title", new Node().value(title))
                .properties("summary", new Node().value(summary))
                .properties("relatedFields", toStringListNode(relatedFields))
                .properties("relatedContracts", toStringListNode(relatedContracts));
        ensureContracts(document).put(key, section);
    }

    private static Node toStringListNode(java.util.List<String> values) {
        Node list = new Node().items(new java.util.ArrayList<Node>());
        for (String value : values) {
            list.getItems().add(new Node().value(value));
        }
        return list;
    }

    private static Map<String, Node> ensureContracts(Node document) {
        if (document.getProperties() == null) {
            document.properties(new LinkedHashMap<String, Node>());
        }
        Node contractsNode = document.getProperties().get("contracts");
        if (contractsNode == null) {
            contractsNode = new Node().properties(new LinkedHashMap<String, Node>());
            document.getProperties().put("contracts", contractsNode);
        } else if (contractsNode.getProperties() == null) {
            contractsNode.properties(new LinkedHashMap<String, Node>());
        }
        return contractsNode.getProperties();
    }
}
