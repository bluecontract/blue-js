package blue.language.samples.sdk;

import blue.language.model.Node;
import blue.language.types.TypeAlias;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.SimpleDocBuilder;
import blue.language.types.myos.AddingParticipantRequested;
import blue.language.types.myos.Agent;
import blue.language.types.myos.CallOperationRequested;
import blue.language.types.myos.SessionEpochAdvanced;
import blue.language.types.myos.SingleDocumentPermissionGranted;

import java.util.Map;

public final class DocBuilderExamples {

    private DocBuilderExamples() {
    }

    public static Node simpleAgentWithPermissions() {
        return SimpleDocBuilder.doc()
                .name("Simple Permission Agent")
                .type(Agent.class)
                .description("Requests read access to provider session on init.")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/providerSessionId", "session-abc-123")
                .onInit("requestProviderAccess", steps -> steps.myOs().requestSingleDocPermission(
                        "ownerChannel",
                        "REQ_PROVIDER",
                        DocBuilder.expr("document('/providerSessionId')"),
                        MyOsPermissions.create().read(true).singleOps("getStatus")))
                .onMyOsResponse("onProviderAccessGranted",
                        SingleDocumentPermissionGranted.class,
                        "REQ_PROVIDER",
                        steps -> steps
                                .myOs().subscribeToSession(
                                        "ownerChannel",
                                        DocBuilder.expr("document('/providerSessionId')"),
                                        "SUB_PROVIDER")
                                .replaceValue("MarkReady", "/status", "ready"))
                .buildDocument();
    }

    public static Node agentAddsParticipantAndWaits() {
        return SimpleDocBuilder.doc()
                .name("Collaboration Setup Agent")
                .type(Agent.class)
                .description("Adds Bob as participant and marks setup progress.")
                .channel("aliceChannel")
                .myOsAdmin("myOsAdminChannel")
                .onInit("addBob", steps -> steps
                        .myOs().addParticipant("bobChannel", "bob@gmail.com"))
                .onEvent("onBobAdded",
                        AddingParticipantRequested.class,
                        steps -> steps.replaceValue("MarkBobAdded", "/participants/bob", "added"))
                .onEvent("onEpochAdvanced",
                        SessionEpochAdvanced.class,
                        steps -> steps.replaceValue("Activate", "/status", "active"))
                .buildDocument();
    }

    public static Node agentCallsRemoteOperation() {
        return SimpleDocBuilder.doc()
                .name("Remote Operation Caller")
                .type(Agent.class)
                .description("Calls operation on linked session when /trigger changes.")
                .channel("ownerChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/linkedSessionId", "session-xyz-789")
                .onDocChange("onTriggerChanged", "/trigger", steps -> steps
                        .myOs().callOperation(
                                "ownerChannel",
                                DocBuilder.expr("document('/linkedSessionId')"),
                                "processData",
                                null))
                .onEvent("onCallQueued",
                        CallOperationRequested.class,
                        steps -> steps.replaceValue("MarkQueued", "/remoteCallStatus", "queued"))
                .buildDocument();
    }

    public static Node cvClassifierAgent() {
        return SimpleDocBuilder.doc()
                .name("CV Classifier Agent")
                .type(Agent.class)
                .description("Classifies linked CVs via llm-provider.")
                .channel("recruitmentChannel")
                .myOsAdmin("myOsAdminChannel")
                .field("/llmProviderSessionId", "session-llm-001")
                .field("/recruitmentSessionId", "session-recruitment-001")
                .field("/cvSubscriptionId", "SUB_CV_UPDATES")
                .onInit("requestAccess", steps -> steps
                        .myOs().requestSingleDocPermission(
                                "recruitmentChannel",
                                "REQ_RECRUITMENT_PROVIDER",
                                DocBuilder.expr("document('/llmProviderSessionId')"),
                                MyOsPermissions.create()
                                        .read(true)
                                        .singleOps("provideInstructions"))
                        .myOs().requestLinkedDocsPermission(
                                "recruitmentChannel",
                                "REQ_RECRUITMENT_CVS",
                                DocBuilder.expr("document('/recruitmentSessionId')"),
                                Map.of("cvs", MyOsPermissions.create()
                                        .read(true)
                                        .allOps(true))))
                .onMyOsResponse("onLlmProviderAccessGranted",
                        SingleDocumentPermissionGranted.class,
                        "REQ_RECRUITMENT_PROVIDER",
                        steps -> steps
                                .myOs().subscribeToSession(
                                        "recruitmentChannel",
                                        DocBuilder.expr("document('/llmProviderSessionId')"),
                                        "SUB_RECRUITMENT_PROVIDER"))
                .buildDocument();
    }

    public static Node orchestratorWithAccessAndAgency() {
        return DocBuilder.doc()
                .name("Procurement Orchestrator")
                .description("Accesses catalog data and starts worker sessions through agency.")
                .section("participants", "Participants", "User-facing channels")
                    .channel("userChannel")
                .endSection()
                .section("state", "State", "Session references and tracking")
                    .field("/catalogSessionId", "session-catalog-001")
                    .field("/plannerSessionId", "session-planner-001")
                    .field("/currentTask", "")
                    .field("/negotiations/count", 0)
                .endSection()
                .section("capabilities", "Capabilities", "Access + AI + agency")
                    .access("catalog")
                        .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
                        .onBehalfOf("userChannel")
                        .read(true)
                        .operations("search", "getDetails")
                        .requestPermissionOnInit()
                        .subscribeAfterGranted()
                        .statusPath("/catalog/status")
                        .done()
                    .ai("planner")
                        .sessionId(DocBuilder.expr("document('/plannerSessionId')"))
                        .permissionFrom("userChannel")
                        .task("findBestDeal")
                            .instruction("Find the best deal across catalog results.")
                            .expectsNamed("deal-found", "vendorEmail", "productId", "price")
                            .done()
                        .done()
                    .agency("procurement")
                        .onBehalfOf("userChannel")
                        .allowedTypes(Purchase.class)
                        .allowedOperations("proposeOffer", "accept", "reject")
                        .requestPermissionOnInit()
                        .statusPath("/agency/status")
                        .done()
                .endSection()
                .section("workflow", "Workflow", "Find, analyze, negotiate")
                    .operation("findAndBuy")
                        .channel("userChannel")
                        .requestType(String.class)
                        .description("Find and buy a product")
                        .steps(steps -> steps
                                .replaceExpression("SaveTask", "/currentTask", "event.message.request")
                                .access("catalog").call("search", DocBuilder.expr("event.message.request")))
                        .done()
                    .onCallResponse("catalog", "onSearchResults", steps -> steps
                            .replaceExpression("SaveResults", "/catalog/lastResults", "event.message.response")
                            .askAI("planner", "Analyze", ask -> ask
                                    .task("findBestDeal")
                                    .instruction("Results: ${document('/catalog/lastResults')}")
                                    .instruction("User wants: ${document('/currentTask')}")))
                    .onAIResponse("planner", "onDealFound", "deal-found", steps -> steps
                            .replaceExpression("SaveDeal", "/lastDeal", "event.update.payload")
                            .viaAgency("procurement").startSession(
                                    "StartPurchase",
                                    DocBuilder.doc()
                                            .name("Auto-Purchase")
                                            .type(Purchase.class)
                                            .channel("buyerChannel")
                                            .channel("sellerChannel")
                                            .field("/maxPrice", DocBuilder.expr("event.update.payload.price"))
                                            .buildDocument(),
                                    bindings -> bindings
                                            .bindExpr("sellerChannel", "event.update.payload.vendorEmail")
                                            .bindFromCurrentDoc("buyerChannel", "userChannel"),
                                    options -> options
                                            .initiator("buyerChannel")
                                            .defaultMessage("Purchase negotiation started.")))
                    .onSessionStarted("procurement", "onNegotiationStarted", steps -> steps
                            .replaceExpression("Track", "/negotiations/count",
                                    "document('/negotiations/count') + 1"))
                .endSection()
                .buildDocument();
    }

    public static Node linkedAccessMonitor() {
        return DocBuilder.doc()
                .name("Linked Access Monitor")
                .channel("ownerChannel")
                .field("/projectSessionId", "session-project-99")
                .accessLinked("projectData")
                    .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .link("invoices")
                        .read(true)
                        .operations("list", "get")
                        .done()
                    .link("shipments")
                        .read(true)
                        .operations("track")
                        .done()
                    .statusPath("/projectData/status")
                    .done()
                .onLinkedAccessGranted("projectData", "onLinkedGranted", steps -> steps
                        .replaceValue("MarkReady", "/projectData/ready", true))
                .buildDocument();
    }

    @TypeAlias("Example/Purchase")
    public static final class Purchase {
    }
}
