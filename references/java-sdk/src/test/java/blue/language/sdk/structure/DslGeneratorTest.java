package blue.language.sdk.structure;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.myos.Agent;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SubscriptionToSessionInitiated;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DslGeneratorTest {

    @Test
    void counterDocIncludesOperationFieldAndSectionSyntax() {
        Node document = counterDoc();
        String dsl = DslGenerator.generate(document);

        assertTrue(dsl.contains(".operation(\"increment\")"));
        assertTrue(dsl.contains(".field(\"/counter\", 0)"));
        assertTrue(dsl.contains(".section("));
    }

    @Test
    void compositeChannelDocContainsCompositeChannelCall() {
        Node document = DocBuilder.doc()
                .name("Composite")
                .channels("a", "b")
                .compositeChannel("union", "a", "b")
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".compositeChannel(\"union\", \"a\", \"b\")"));
    }

    @Test
    void myOsAdminDocUsesMyOsAdminShortcut() {
        Node document = DocBuilder.doc()
                .name("MyOS admin")
                .myOsAdmin("myOsAdminChannel")
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".myOsAdmin(\"myOsAdminChannel\")") || dsl.contains(".myOsAdmin()"));
        assertFalse(dsl.contains("myOsAdminUpdateImpl"));
    }

    @Test
    void onInitAndOnDocChangeDocContainsWorkflowCalls() {
        Node document = DocBuilder.doc()
                .name("Workflow doc")
                .onInit("init", steps -> steps.replaceValue("Ready", "/status", "ready"))
                .onDocChange("onPrice", "/price", steps -> steps.replaceValue("Mark", "/changed", true))
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".onInit(\"init\""));
        assertTrue(dsl.contains(".onChannelEvent(\"onPrice\"") || dsl.contains("onPrice"));
    }

    @Test
    void aiIntegrationContainsMyOsResponseAndSubscriptionWorkflowCalls() {
        Node document = aiDoc();
        String dsl = DslGenerator.generate(document);

        assertTrue(dsl.contains(".onMyOsResponse(\"onLlmAccessGranted\""));
        assertTrue(dsl.contains(".onSubscriptionUpdate(\"onLlmUpdate\""));
    }

    @Test
    void payNoteSimpleCaptureContainsPayNoteEntryPointAndCaptureFlow() {
        Node document = PayNotes.payNote("Simple capture")
                .currency("USD")
                .amountMinor(1000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation("unlockCapture", "payerChannel", "unlock")
                    .requestOnOperation("requestCapture", "guarantorChannel", "request")
                    .done()
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains("PayNotes.payNote(\"Simple capture\")"));
        assertTrue(dsl.contains(".capture()"));
        assertTrue(dsl.contains(".lockOnInit()"));
    }

    @Test
    void payNoteReserveAndCaptureDocContainsReserveAndCaptureBlocks() {
        Node document = PayNotes.payNote("Milestone")
                .currency("USD")
                .amountMinor(1000)
                .reserve().requestOnInit().done()
                .capture().requestOnInit().done()
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".reserve()"));
        assertTrue(dsl.contains(".capture()"));
    }

    @Test
    void documentWithJsStepContainsJsRawCall() {
        Node document = DocBuilder.doc()
                .name("JS doc")
                .onInit("init", steps -> steps.jsRaw("Compute", "return { value: 1 };"))
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".jsRaw(\"Compute\""));
        assertTrue(dsl.contains("return { value: 1 };"));
    }

    @Test
    void directChangeDocumentContainsDirectChangeCall() {
        Node document = DocBuilder.doc()
                .name("Direct change")
                .channel("ownerChannel")
                .directChange("applyPatch", "ownerChannel", "Apply changes")
                .buildDocument();

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".directChange(\"applyPatch\""));
    }

    @Test
    void emptyDocumentProducesMinimalDsl() {
        String dsl = DslGenerator.generate(new Node());
        assertNotNull(dsl);
        assertTrue(dsl.contains("DocBuilder.doc()"));
        assertTrue(dsl.contains(".buildDocument();"));
    }

    @Test
    void keepsSectionStructureWhenDocumentSectionContractsExist() {
        Node document = counterDoc();
        addSection(document, "counterOps", "Counter", "Owner counter operations",
                List.of("/counter"),
                List.of("increment", "incrementImpl"));

        String dsl = DslGenerator.generate(document);
        assertTrue(dsl.contains(".section(\"counterOps\", \"Counter\", \"Owner counter operations\")"));
        assertTrue(dsl.contains(".operation(\"increment\")"));
        assertTrue(dsl.contains(".endSection()"));
        assertTrue(dsl.indexOf(".section(\"counterOps\"") < dsl.indexOf(".operation(\"increment\")"));
    }

    private static Node counterDoc() {
        return DocBuilder.doc()
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                .channel("ownerChannel")
                .description("Increment counter")
                .requestType(Integer.class)
                .steps(steps -> steps.replaceExpression("Inc", "/counter", "document('/counter') + 1"))
                .done()
                .buildDocument();
    }

    private static Node aiDoc() {
        return DocBuilder.doc()
                .name("AI Doc")
                .type(Agent.class)
                .field("/llmProviderSessionId", "session-llm-001")
                .field("/status", "idle")
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
                                "SUB_LLM"))
                .onSubscriptionUpdate("onLlmUpdate",
                        "SUB_LLM",
                        SubscriptionToSessionInitiated.class,
                        steps -> steps.replaceValue("SetReady", "/status", "ready"))
                .buildDocument();
    }

    private static void addSection(Node document,
                                   String key,
                                   String title,
                                   String summary,
                                   List<String> relatedFields,
                                   List<String> relatedContracts) {
        Map<String, Node> contracts = ensureContracts(document);
        contracts.put(key, new Node()
                .type("Conversation/Document Section")
                .properties("title", new Node().value(title))
                .properties("summary", new Node().value(summary))
                .properties("relatedFields", listNode(relatedFields))
                .properties("relatedContracts", listNode(relatedContracts)));
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

    private static Node listNode(List<String> values) {
        Node node = new Node().items(new ArrayList<Node>());
        for (String value : values) {
            node.getItems().add(new Node().value(value));
        }
        return node;
    }
}
