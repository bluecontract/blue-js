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
import static org.junit.jupiter.api.Assertions.assertTrue;

class DslStubGeneratorTest {

    @Test
    void counterStubIncludesOperationSignatureWithoutSteps() {
        Node document = counterDoc();
        String stub = DslStubGenerator.generate(document);

        assertTrue(stub.contains(".operation(\"increment\")"));
        assertTrue(stub.contains(".channel(\"ownerChannel\")"));
        assertTrue(stub.contains(".description(\"Increment counter\")"));
        assertTrue(stub.contains("// implementation in document JSON"));
        assertFalse(stub.contains(".replaceExpression(\"Inc\""));
    }

    @Test
    void aiStubListsWorkflowsAndChannelsWithoutStepBodies() {
        Node document = aiDoc();
        String stub = DslStubGenerator.generate(document);

        assertTrue(stub.contains(".onMyOsResponse(\"onLlmAccessGranted\""));
        assertTrue(stub.contains(".onSubscriptionUpdate(\"onLlmUpdate\""));
        assertFalse(stub.contains(".replaceValue(\"SetReady\""));
        assertFalse(stub.contains(".jsRaw("));
    }

    @Test
    void payNoteStubContainsActionBlocksWithoutImplementationDetails() {
        Node document = PayNotes.payNote("Simple capture")
                .currency("USD")
                .amountMinor(1000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation("unlockCapture", "payerChannel", "unlock")
                    .requestOnOperation("requestCapture", "guarantorChannel", "request")
                    .done()
                .reserve().requestOnInit().done()
                .buildDocument();

        String stub = DslStubGenerator.generate(document);
        assertTrue(stub.contains(".capture()"));
        assertTrue(stub.contains(".reserve()"));
        assertTrue(stub.contains("// implementation in document JSON"));
        assertFalse(stub.contains(".jsRaw("));
    }

    @Test
    void keepsSectionStructureInStubWhenSectionsAvailable() {
        Node document = counterDoc();
        addSection(document, "counterOps", "Counter", "Owner counter operations",
                List.of("/counter"),
                List.of("increment", "incrementImpl"));

        String stub = DslStubGenerator.generate(document);
        assertTrue(stub.contains(".section(\"counterOps\", \"Counter\", \"Owner counter operations\")"));
        assertTrue(stub.contains(".operation(\"increment\")"));
        assertTrue(stub.contains(".endSection()"));
        assertTrue(stub.indexOf(".section(\"counterOps\"") < stub.indexOf(".operation(\"increment\")"));
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
