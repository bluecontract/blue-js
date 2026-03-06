package blue.language.sdk.patch;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.samples.paynote.PayNoteCookbookExamples;
import blue.language.samples.paynote.voucher.ArmchairProtectionWithVoucherPayNote;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.myos.Agent;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import blue.language.types.myos.SubscriptionToSessionInitiated;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static blue.language.utils.UncheckedObjectMapper.JSON_MAPPER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChangeRequestCompilerTest {

    private static final Blue BLUE = new Blue();

    @Test
    void rootOnlyCounterReplacementProducesSingleChangesetEntry() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone()).replace("/counter", 5).buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertEquals(1, readItems(changeRequest, "/changeset").size());
        assertTrue(sectionChangesEmpty(changeRequest));
    }

    @Test
    void rootOnlyAddFieldProducesAddChangesetEntry() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone()).field("/status", "ready").buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertEquals("add", readText(readItems(changeRequest, "/changeset").get(0), "op"));
        assertTrue(sectionChangesEmpty(changeRequest));
    }

    @Test
    void rootOnlyRemoveFieldProducesRemoveChangesetEntry() {
        Node before = DocBuilder.from(counterDoc()).field("/status", "ready").buildDocument();
        Node after = DocBuilder.from(before.clone()).remove("/status").buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertEquals("remove", readText(readItems(changeRequest, "/changeset").get(0), "op"));
        assertTrue(sectionChangesEmpty(changeRequest));
    }

    @Test
    void changingNameAndDescriptionAddsTwoExplicitReplacements() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .name("Counter v2")
                .description("Updated description")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> changeset = readItems(changeRequest, "/changeset");
        assertEquals(2, changeset.size());
        assertTrue(changeset.stream().anyMatch(node -> "/name".equals(readText(node, "path"))));
        assertTrue(changeset.stream().anyMatch(node -> "/description".equals(readText(node, "path"))));
    }

    @Test
    void addingOperationAndImplCreatesSectionAddEntry() {
        Node before = DocBuilder.doc().name("Ops").channel("ownerChannel").buildDocument();
        Node after = DocBuilder.from(before.clone())
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .steps(steps -> steps.replaceValue("Set", "/counter", 1))
                    .done()
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> addEntries = readItems(changeRequest, "/sectionChanges/add");
        assertEquals(1, addEntries.size());
        Node contracts = readProperty(addEntries.get(0), "contracts");
        assertNotNull(contracts);
        assertEquals(2, contracts.getProperties().size());
    }

    @Test
    void removingOperationAndImplProducesSectionRemoval() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .remove("/contracts/increment")
                .remove("/contracts/incrementImpl")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> removeEntries = readItems(changeRequest, "/sectionChanges/remove");
        assertEquals(1, removeEntries.size());
        assertEquals("flow-ownerChannel", String.valueOf(removeEntries.get(0).getValue()));
    }

    @Test
    void modifyingWorkflowStepsCreatesModifyEntry() {
        Node before = DocBuilder.doc()
                .name("Workflow doc")
                .onInit("initialize", steps -> steps.replaceValue("Set", "/status", "ready"))
                .buildDocument();
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/initialize/steps/0/changeset/0/val", "done")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertFalse(readItems(changeRequest, "/sectionChanges/modify").isEmpty());
    }

    @Test
    void addingChannelAssignsItToParticipantsSection() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone()).channel("reviewerChannel").buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> modify = readItems(changeRequest, "/sectionChanges/modify");
        Node participants = modify.stream()
                .filter(entry -> "participants".equals(readText(entry, "sectionKey")))
                .findFirst()
                .orElseThrow();
        assertNotNull(readProperty(readProperty(participants, "contracts"), "reviewerChannel"));
    }

    @Test
    void mixedRootAndContractChangesPopulateBothContainers() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .replace("/counter", 10)
                .operation("decrement")
                    .channel("ownerChannel")
                    .description("Decrement")
                    .steps(steps -> steps.replaceExpression("Set", "/counter", "document('/counter') - 1"))
                    .done()
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertFalse(readItems(changeRequest, "/changeset").isEmpty());
        assertFalse(totalSectionChangeEntries(changeRequest).isEmpty());
    }

    @Test
    void mixedStatusAndWorkflowModificationPopulateBothContainers() {
        Node before = DocBuilder.doc()
                .name("Workflow")
                .field("/status", "idle")
                .onInit("initialize", steps -> steps.replaceValue("Set", "/status", "ready"))
                .buildDocument();
        Node after = DocBuilder.from(before.clone())
                .replace("/status", "processing")
                .replace("/contracts/initialize/steps/0/changeset/0/val", "done")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertFalse(readItems(changeRequest, "/changeset").isEmpty());
        assertFalse(totalSectionChangeEntries(changeRequest).isEmpty());
    }

    @Test
    void newOperationWithoutSectionCreatesAutoSection() {
        Node before = DocBuilder.doc().name("No sections").channel("ownerChannel").buildDocument();
        Node after = DocBuilder.from(before.clone())
                .operation("approve")
                    .channel("ownerChannel")
                    .description("Approve")
                    .steps(steps -> steps.replaceValue("Set", "/approved", true))
                    .done()
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertFalse(readItems(changeRequest, "/sectionChanges/add").isEmpty());
    }

    @Test
    void operationModifiedUsesExistingSectionKey() {
        Node before = counterDoc();
        addSection(before, "counterOps", "Counter operations", List.of("increment", "incrementImpl"));
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/incrementImpl/steps/0/changeset/0/val", "${document('/counter') + 2}")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> modifyEntries = readItems(changeRequest, "/sectionChanges/modify");
        assertEquals("counterOps", readText(modifyEntries.get(0), "sectionKey"));
    }

    @Test
    void sectionModifyIncludesChangedAndUnchangedContracts() {
        Node before = counterWithTwoOps();
        addSection(before, "counterOps", "Counter operations",
                List.of("increment", "incrementImpl", "decrement", "decrementImpl"));
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/incrementImpl/steps/0/changeset/0/val", "${document('/counter') + 2}")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        Node modifyEntry = readItems(changeRequest, "/sectionChanges/modify").get(0);
        Node contracts = readProperty(modifyEntry, "contracts");
        assertTrue(contracts.getProperties().containsKey("increment"));
        assertTrue(contracts.getProperties().containsKey("decrement"));
    }

    @Test
    void contractListedInTwoSectionsUsesFirstSection() {
        Node before = counterDoc();
        addSection(before, "aSection", "A section", List.of("increment", "incrementImpl"));
        addSection(before, "bSection", "B section", List.of("increment", "incrementImpl"));
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/incrementImpl/steps/0/changeset/0/val", "${document('/counter') + 3}")
                .buildDocument();

        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        assertEquals("aSection", readText(readItems(changeRequest, "/sectionChanges/modify").get(0), "sectionKey"));
    }

    @Test
    void roundtripCounterAddDecrementOperation() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .operation("decrement")
                    .channel("ownerChannel")
                    .description("Decrement")
                    .steps(steps -> steps.replaceExpression("Set", "/counter", "document('/counter') - 1"))
                    .done()
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripCounterChangeIncrementStep() {
        Node before = counterDoc();
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/incrementImpl/steps/0/changeset/0/val", "${document('/counter') + (event.message.request * 2)}")
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripDirectChangeAddSecondParticipant() {
        Node before = DocBuilder.doc()
                .name("Direct change")
                .field("/counter", 1)
                .channel("ownerChannel")
                .directChange("applyPatch", "ownerChannel", "Apply patch")
                .buildDocument();
        Node after = DocBuilder.from(before.clone()).channel("reviewerChannel").buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripMyOsAdminAddPermissionWorkflow() {
        Node before = myOsDoc();
        Node after = DocBuilder.from(before.clone())
                .onInit("requestPermission", steps -> steps.myOs().requestSingleDocPermission(
                        "ownerChannel",
                        "REQ_2",
                        DocBuilder.expr("document('/sessionId')"),
                        MyOsPermissions.create().read(true)))
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripAiDocSessionChangeAndSecondProvider() {
        Node before = aiDoc();
        Node after = DocBuilder.from(before.clone())
                .replace("/llmProviderSessionId", "session-llm-002")
                .field("/secondaryProviderSessionId", "session-llm-003")
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripPaynoteSimpleAddReservePhase() {
        Node before = simpleCapturePayNote();
        Node after = DocBuilder.from(before.clone())
                .onInit("reserveRequestOnInit", steps -> steps.triggerEvent("RequestReserve", new Node().type("PayNote/Reserve Funds Requested")))
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripPaynoteMilestoneChangeAmount() {
        Node before = PayNoteCookbookExamples.milestoneReservePartialCapture();
        Node after = DocBuilder.from(before.clone())
                .replace("/contracts/approveMilestone3Impl/steps/0/event/amount", new Node().value("${600000}"))
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripPaynoteVoucherRemoveHandler() {
        Node before = ArmchairProtectionWithVoucherPayNote.templateDoc();
        Node after = DocBuilder.from(before.clone())
                .remove("/contracts/requestVoucherPayment")
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripCompositeChannelAddThirdParticipant() {
        Node before = compositeDoc();
        Node after = DocBuilder.from(before.clone())
                .channel("channelC")
                .replace("/contracts/participantUnion/channels/2", "channelC")
                .buildDocument();
        assertRoundtrip(before, after);
    }

    @Test
    void roundtripMealPlannerOperationAndPromptChange() {
        Node before = mealPlannerDoc();
        Node after = DocBuilder.from(before.clone())
                .replace("/mealRequest", "Build weekly vegetarian plan")
                .operation("approvePlan")
                    .channel("ownerChannel")
                    .description("Approve meal plan")
                    .steps(steps -> steps.replaceValue("Approve", "/planStatus", "approved"))
                    .done()
                .buildDocument();
        assertRoundtrip(before, after);
    }

    private static void assertRoundtrip(Node before, Node after) {
        Node changeRequest = ChangeRequestCompiler.compile(before, after);
        List<Node> changeset = readItems(changeRequest, "/changeset");
        assertTrue(changeset.stream().noneMatch(node -> {
            String path = readText(node, "path");
            return path != null && path.startsWith("/contracts");
        }));
        Node applied = ChangeRequestApplier.apply(before.clone(), changeRequest);
        assertCanonicalEquals(applied, after);
    }

    private static Node counterDoc() {
        return DocBuilder.doc()
                .name("Counter")
                .field("/counter", 0)
                .channel("ownerChannel")
                .operation("increment")
                    .channel("ownerChannel")
                    .description("Increment")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') + event.message.request"))
                    .done()
                .buildDocument();
    }

    private static Node counterWithTwoOps() {
        return DocBuilder.from(counterDoc())
                .operation("decrement")
                    .channel("ownerChannel")
                    .description("Decrement")
                    .requestType(Integer.class)
                    .steps(steps -> steps.replaceExpression("Apply", "/counter", "document('/counter') - event.message.request"))
                    .done()
                .buildDocument();
    }

    private static Node myOsDoc() {
        return DocBuilder.doc()
                .name("MyOS Doc")
                .type(Agent.class)
                .field("/sessionId", "session-1")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
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

    private static Node simpleCapturePayNote() {
        return PayNotes.payNote("Simple capture")
                .currency("USD")
                .amountMinor(1000)
                .capture()
                    .lockOnInit()
                    .unlockOnOperation("unlockCapture", "payerChannel", "unlock")
                    .requestOnOperation("requestCapture", "guarantorChannel", "request")
                    .done()
                .buildDocument();
    }

    private static Node compositeDoc() {
        return DocBuilder.doc()
                .name("Composite")
                .channels("channelA", "channelB")
                .compositeChannel("participantUnion", "channelA", "channelB")
                .buildDocument();
    }

    private static Node mealPlannerDoc() {
        return DocBuilder.doc()
                .name("Meal Planner")
                .type(Agent.class)
                .field("/llmProviderSessionId", "session-llm-001")
                .field("/mealRequest", "")
                .field("/mealPlan", new Node().properties("days", new Node().items(new ArrayList<Node>())))
                .field("/totalCalories", 0)
                .field("/planStatus", "idle")
                .channel("ownerChannel")
                .operation("requestMealPlan")
                    .channel("ownerChannel")
                    .description("Request a meal plan")
                    .steps(steps -> steps.replaceValue("SetRequested", "/planStatus", "requested"))
                    .done()
                .buildDocument();
    }

    private static void addSection(Node document, String sectionKey, String title, List<String> contracts) {
        Map<String, Node> contractMap = ensureContracts(document);
        contractMap.put(sectionKey, new Node().type("Conversation/Document Section")
                .properties("title", new Node().value(title))
                .properties("summary", new Node().value("section"))
                .properties("relatedContracts", toListNode(contracts)));
    }

    private static Node toListNode(List<String> values) {
        Node list = new Node().items(new ArrayList<Node>());
        for (String value : values) {
            list.getItems().add(new Node().value(value));
        }
        return list;
    }

    private static Map<String, Node> ensureContracts(Node document) {
        if (document.getProperties() == null) {
            document.properties(new LinkedHashMap<String, Node>());
        }
        Node contracts = document.getProperties().get("contracts");
        if (contracts == null) {
            contracts = new Node().properties(new LinkedHashMap<String, Node>());
            document.getProperties().put("contracts", contracts);
        } else if (contracts.getProperties() == null) {
            contracts.properties(new LinkedHashMap<String, Node>());
        }
        return contracts.getProperties();
    }

    private static boolean sectionChangesEmpty(Node changeRequest) {
        return readItems(changeRequest, "/sectionChanges/add").isEmpty()
                && readItems(changeRequest, "/sectionChanges/modify").isEmpty()
                && readItems(changeRequest, "/sectionChanges/remove").isEmpty();
    }

    private static List<Node> totalSectionChangeEntries(Node changeRequest) {
        List<Node> all = new ArrayList<Node>();
        all.addAll(readItems(changeRequest, "/sectionChanges/add"));
        all.addAll(readItems(changeRequest, "/sectionChanges/modify"));
        all.addAll(readItems(changeRequest, "/sectionChanges/remove"));
        return all;
    }

    private static List<Node> readItems(Node root, String pointer) {
        Object raw = root.get(pointer);
        if (!(raw instanceof Node)) {
            return List.of();
        }
        Node node = (Node) raw;
        if (node.getItems() == null) {
            return List.of();
        }
        return node.getItems();
    }

    private static Node readProperty(Node node, String key) {
        if (node == null || node.getProperties() == null) {
            return null;
        }
        return node.getProperties().get(key);
    }

    private static String readText(Node node, String key) {
        Node property = readProperty(node, key);
        if (property == null || property.getValue() == null) {
            return null;
        }
        return String.valueOf(property.getValue());
    }

    private static void assertCanonicalEquals(Node actual, Node expected) {
        Node expectedCanonical = BLUE.preprocess(expected.clone());
        Node actualCanonical = BLUE.preprocess(actual.clone());
        JsonNode expectedTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(expectedCanonical));
        JsonNode actualTree = JSON_MAPPER.readTree(BLUE.nodeToSimpleJson(actualCanonical));
        assertEquals(expectedTree, actualTree);
    }
}
