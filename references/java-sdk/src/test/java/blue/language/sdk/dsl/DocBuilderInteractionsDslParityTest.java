package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.types.myos.CallOperationResponded;
import blue.language.types.myos.SingleDocumentPermissionGranted;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DocBuilderInteractionsDslParityTest {

    @Test
    void accessBuilderGeneratesPermissionLifecycleAndSubscription() {
        Node built = DocBuilder.doc()
                .name("Access parity")
                .channel("ownerChannel")
                .field("/catalogSessionId", "session-catalog-1")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .read(true)
                    .operations("search", "getDetails")
                    .requestPermissionOnInit()
                    .subscribeAfterGranted()
                    .statusPath("/catalog/status")
                    .done()
                .buildDocument();

        assertEquals("MyOS/MyOS Timeline", built.getAsText("/contracts/myOsAdminChannel/type/value"));
        assertEquals("Conversation/Operation", built.getAsText("/contracts/myOsEmit/type/value"));

        String requestPath = "/contracts/accessCATALOGRequestPermission/steps/0/event";
        assertEquals("MyOS/Single Document Permission Grant Requested",
                built.getAsText(requestPath + "/type/value"));
        assertEquals("ownerChannel", built.getAsText(requestPath + "/onBehalfOf/value"));
        assertEquals("REQ_ACCESS_CATALOG", built.getAsText(requestPath + "/requestId/value"));
        assertEquals("${document('/catalogSessionId')}", built.getAsText(requestPath + "/targetSessionId/value"));
        assertEquals(Boolean.TRUE, built.get(requestPath + "/permissions/read/value"));
        assertEquals("search", built.getAsText(requestPath + "/permissions/singleOps/0/value"));
        assertEquals("getDetails", built.getAsText(requestPath + "/permissions/singleOps/1/value"));

        String grantedPath = "/contracts/accessCATALOGGranted/steps";
        assertEquals("/catalog/status", built.getAsText(grantedPath + "/0/changeset/0/path/value"));
        assertEquals("granted", built.getAsText(grantedPath + "/0/changeset/0/val/value"));
        assertEquals("MyOS/Subscribe to Session Requested", built.getAsText(grantedPath + "/1/event/type/value"));
        assertEquals("ownerChannel", built.getAsText(grantedPath + "/1/event/onBehalfOf/value"));
        assertEquals("SUB_ACCESS_CATALOG", built.getAsText(grantedPath + "/1/event/subscription/id/value"));

        assertEquals("subscribed",
                built.getAsText("/contracts/accessCATALOGSubscriptionReady/steps/0/changeset/0/val/value"));
        assertEquals("rejected",
                built.getAsText("/contracts/accessCATALOGRejected/steps/0/changeset/0/val/value"));
        assertEquals("revoked",
                built.getAsText("/contracts/accessCATALOGRevoked/steps/0/changeset/0/val/value"));
    }

    @Test
    void accessManualSkipsAutoPermissionAndSupportsStepHelpers() {
        Node built = DocBuilder.doc()
                .name("Access manual parity")
                .channel("ownerChannel")
                .field("/catalogSessionId", "session-catalog-2")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .requestPermissionManually()
                    .done()
                .operation("activate")
                    .channel("ownerChannel")
                    .steps(steps -> steps
                            .access("catalog").requestPermission("RequestCatalogPermission")
                            .access("catalog").call("search", DocBuilder.expr("event.message.request"))
                            .access("catalog").subscribe("SubscribeCatalog")
                            .access("catalog").revokePermission("RevokeCatalogPermission"))
                    .done()
                .buildDocument();

        assertEquals(false,
                built.getAsNode("/contracts").getProperties().containsKey("accessCATALOGRequestPermission"));

        String steps = "/contracts/activateImpl/steps";
        assertEquals("MyOS/Single Document Permission Grant Requested",
                built.getAsText(steps + "/0/event/type/value"));
        assertEquals("REQ_ACCESS_CATALOG", built.getAsText(steps + "/0/event/requestId/value"));

        assertEquals("MyOS/Call Operation Requested",
                built.getAsText(steps + "/1/event/type/value"));
        assertEquals("search", built.getAsText(steps + "/1/event/operation/value"));

        assertEquals("MyOS/Subscribe to Session Requested",
                built.getAsText(steps + "/2/event/type/value"));
        assertEquals("SUB_ACCESS_CATALOG", built.getAsText(steps + "/2/event/subscription/id/value"));

        assertEquals("MyOS/Single Document Permission Revoke Requested",
                built.getAsText(steps + "/3/event/type/value"));
    }

    @Test
    void accessSupportsSubscribeToCreatedSessionsFlag() {
        Node built = DocBuilder.doc()
                .name("Access subscription flag")
                .channel("ownerChannel")
                .field("/targetSessionId", "session-3")
                .access("factory")
                    .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .subscribeToCreatedSessions(true)
                    .done()
                .buildDocument();

        assertEquals(Boolean.TRUE,
                built.get("/contracts/accessFACTORYRequestPermission/steps/0/event/grantSessionSubscriptionOnResult/value"));
    }

    @Test
    void accessSubscriptionEventsAreIncludedInSubscribeRequest() {
        Node built = DocBuilder.doc()
                .name("Access subscription events")
                .channel("ownerChannel")
                .field("/targetSessionId", "session-3b")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .subscribeAfterGranted()
                    .subscriptionEvents(CallOperationResponded.class, SingleDocumentPermissionGranted.class)
                    .done()
                .buildDocument();

        String eventsPath = "/contracts/accessCATALOGGranted/steps/0/event/subscription/events";
        assertEquals("MyOS/Call Operation Responded", built.getAsText(eventsPath + "/0/type/value"));
        assertEquals("MyOS/Single Document Permission Granted", built.getAsText(eventsPath + "/1/type/value"));
    }

    @Test
    void accessSupportsEventAndDocChangePermissionTimings() {
        Node onEvent = DocBuilder.doc()
                .name("Access event timing")
                .channel("ownerChannel")
                .field("/targetSessionId", "session-4")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .requestPermissionOnEvent(SingleDocumentPermissionGranted.class)
                    .done()
                .buildDocument();

        assertEquals("triggeredEventChannel",
                onEvent.getAsText("/contracts/accessCATALOGRequestPermission/channel/value"));
        assertEquals("MyOS/Single Document Permission Granted",
                onEvent.getAsText("/contracts/accessCATALOGRequestPermission/event/type/value"));

        Node onDocChange = DocBuilder.doc()
                .name("Access doc-change timing")
                .channel("ownerChannel")
                .field("/targetSessionId", "session-5")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .requestPermissionOnDocChange("/status")
                    .done()
                .buildDocument();

        assertEquals("Document Update Channel",
                onDocChange.getAsText("/contracts/accessCATALOGRequestPermissionDocUpdateChannel/type/value"));
        assertEquals("/status",
                onDocChange.getAsText("/contracts/accessCATALOGRequestPermissionDocUpdateChannel/path/value"));
        assertEquals("accessCATALOGRequestPermissionDocUpdateChannel",
                onDocChange.getAsText("/contracts/accessCATALOGRequestPermission/channel/value"));
    }

    @Test
    void linkedAccessBuilderGeneratesLinkedDocsPermissionContracts() {
        Node built = DocBuilder.doc()
                .name("Linked access parity")
                .channel("ownerChannel")
                .field("/projectSessionId", "session-project-1")
                .accessLinked("projectData")
                    .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .statusPath("/projectData/status")
                    .link("invoices")
                        .read(true)
                        .operations("list", "get")
                        .done()
                    .link("shipments")
                        .operations("track")
                        .done()
                    .done()
                .buildDocument();

        String request = "/contracts/linkedAccessPROJECTDATARequestPermission/steps/0/event";
        assertEquals("MyOS/Linked Documents Permission Grant Requested",
                built.getAsText(request + "/type/value"));
        assertEquals("REQ_LINKED_ACCESS_PROJECTDATA", built.getAsText(request + "/requestId/value"));
        assertEquals(Boolean.TRUE, built.get(request + "/links/invoices/read/value"));
        assertEquals("list", built.getAsText(request + "/links/invoices/singleOps/0/value"));
        assertEquals("track", built.getAsText(request + "/links/shipments/singleOps/0/value"));

        assertEquals("granted",
                built.getAsText("/contracts/linkedAccessPROJECTDATAGranted/steps/0/changeset/0/val/value"));
        assertEquals("rejected",
                built.getAsText("/contracts/linkedAccessPROJECTDATARejected/steps/0/changeset/0/val/value"));
        assertEquals("revoked",
                built.getAsText("/contracts/linkedAccessPROJECTDATARevoked/steps/0/changeset/0/val/value"));
    }

    @Test
    void linkedAccessValidatesAtLeastOneLink() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("Invalid linked access")
                        .channel("ownerChannel")
                        .field("/projectSessionId", "session-project-2")
                        .accessLinked("projectData")
                            .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
                            .onBehalfOf("ownerChannel")
                            .done()
                        .buildDocument());
        assertEquals("accessLinked('projectData'): at least one link(...) is required", ex.getMessage());
    }

    @Test
    void agencyBuilderGeneratesWorkerAgencyPermissionLifecycle() {
        Node built = DocBuilder.doc()
                .name("Agency parity")
                .channel("ownerChannel")
                .agency("procurement")
                    .onBehalfOf("ownerChannel")
                    .allowedTypes(Integer.class, CallOperationResponded.class)
                    .allowedOperations("propose", "accept")
                    .statusPath("/agency/status")
                    .done()
                .buildDocument();

        String request = "/contracts/agencyPROCUREMENTRequestPermission/steps/0/event";
        assertEquals("MyOS/Worker Agency Permission Grant Requested",
                built.getAsText(request + "/type/value"));
        assertEquals("ownerChannel", built.getAsText(request + "/onBehalfOf/value"));
        assertEquals("REQ_AGENCY_PROCUREMENT", built.getAsText(request + "/requestId/value"));
        assertEquals("Integer",
                built.getAsText(request + "/workerAgencyPermissions/allowedDocumentTypes/0/type/value"));
        assertEquals("MyOS/Call Operation Responded",
                built.getAsText(request + "/workerAgencyPermissions/allowedDocumentTypes/1/type/value"));
        assertEquals("propose",
                built.getAsText(request + "/workerAgencyPermissions/allowedOperations/0/value"));

        assertEquals("granted",
                built.getAsText("/contracts/agencyPROCUREMENTGranted/steps/0/changeset/0/val/value"));
        assertEquals("rejected",
                built.getAsText("/contracts/agencyPROCUREMENTRejected/steps/0/changeset/0/val/value"));
        assertEquals("revoked",
                built.getAsText("/contracts/agencyPROCUREMENTRevoked/steps/0/changeset/0/val/value"));
    }

    @Test
    void agencyManualSupportsViaAgencyStepHelpers() {
        Node built = DocBuilder.doc()
                .name("Agency manual parity")
                .channel("ownerChannel")
                .agency("procurement")
                    .onBehalfOf("ownerChannel")
                    .allowedOperations("propose")
                    .requestPermissionManually()
                    .done()
                .operation("start")
                    .channel("ownerChannel")
                    .steps(steps -> steps
                            .viaAgency("procurement").requestPermission("RequestProcurement")
                            .viaAgency("procurement").startSession(
                                    "StartPurchase",
                                    new Node().name("Purchase"),
                                    bindings -> bindings
                                            .bindFromCurrentDoc("buyerChannel", "ownerChannel")
                                            .bindExpr("sellerChannel", "event.message.request"),
                                    options -> options
                                            .initiator("buyerChannel")
                                            .defaultMessage("Negotiation started")))
                    .done()
                .buildDocument();

        assertEquals(false,
                built.getAsNode("/contracts").getProperties().containsKey("agencyPROCUREMENTRequestPermission"));

        String steps = "/contracts/startImpl/steps";
        assertEquals("MyOS/Worker Agency Permission Grant Requested",
                built.getAsText(steps + "/0/event/type/value"));
        assertEquals("REQ_AGENCY_PROCUREMENT", built.getAsText(steps + "/0/event/requestId/value"));

        assertEquals("MyOS/Start Worker Session Requested",
                built.getAsText(steps + "/1/event/type/value"));
        assertEquals("ownerChannel", built.getAsText(steps + "/1/event/onBehalfOf/value"));
        assertEquals("Purchase", built.getAsText(steps + "/1/event/config/document/name/value"));
        assertEquals("ownerChannel", built.getAsText(steps + "/1/event/config/channelBindings/buyerChannel/value"));
        assertEquals("${event.message.request}", built.getAsText(steps + "/1/event/config/channelBindings/sellerChannel/value"));
        assertEquals("buyerChannel", built.getAsText(steps + "/1/event/config/initiatorChannel/value"));
        assertEquals("Negotiation started", built.getAsText(steps + "/1/event/config/initialMessages/defaultMessage/value"));
    }

    @Test
    void interactionListenerConvenienceMethodsBuildExpectedMatchers() {
        Node built = DocBuilder.doc()
                .name("Listener parity")
                .channel("ownerChannel")
                .field("/catalogSessionId", "session-catalog-6")
                .field("/projectSessionId", "session-project-6")
                .access("catalog")
                    .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .subscribeAfterGranted()
                    .done()
                .accessLinked("projectData")
                    .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
                    .onBehalfOf("ownerChannel")
                    .link("invoices")
                        .read(true)
                        .done()
                    .done()
                .agency("procurement")
                    .onBehalfOf("ownerChannel")
                    .done()
                .onAccessGranted("catalog", "onAccessGranted", steps -> steps.replaceValue("A", "/a", true))
                .onAccessRejected("catalog", "onAccessRejected", steps -> steps.replaceValue("B", "/b", true))
                .onAccessRevoked("catalog", "onAccessRevoked", steps -> steps.replaceValue("C", "/c", true))
                .onCallResponse("catalog", "onCallResponse", steps -> steps.replaceValue("D", "/d", true))
                .onUpdate("catalog", "onUpdate", steps -> steps.replaceValue("E", "/e", true))
                .onSessionCreated("catalog", "onSessionCreated", steps -> steps.replaceValue("F", "/f", true))
                .onLinkedAccessGranted("projectData", "onLinkedGranted", steps -> steps.replaceValue("G", "/g", true))
                .onLinkedAccessRejected("projectData", "onLinkedRejected", steps -> steps.replaceValue("H", "/h", true))
                .onLinkedAccessRevoked("projectData", "onLinkedRevoked", steps -> steps.replaceValue("I", "/i", true))
                .onAgencyGranted("procurement", "onAgencyGranted", steps -> steps.replaceValue("J", "/j", true))
                .onAgencyRejected("procurement", "onAgencyRejected", steps -> steps.replaceValue("K", "/k", true))
                .onAgencyRevoked("procurement", "onAgencyRevoked", steps -> steps.replaceValue("L", "/l", true))
                .buildDocument();

        assertEquals("MyOS/Single Document Permission Granted",
                built.getAsText("/contracts/onAccessGranted/event/type/value"));
        assertEquals("REQ_ACCESS_CATALOG",
                built.getAsText("/contracts/onAccessGranted/event/requestId/value"));

        assertEquals("MyOS/Subscription Update",
                built.getAsText("/contracts/onUpdate/event/type/value"));
        assertEquals("SUB_ACCESS_CATALOG",
                built.getAsText("/contracts/onUpdate/event/subscriptionId/value"));

        assertEquals("MyOS/Subscribable Session Created",
                built.getAsText("/contracts/onSessionCreated/event/type/value"));

        assertEquals("MyOS/Linked Documents Permission Granted",
                built.getAsText("/contracts/onLinkedGranted/event/type/value"));
        assertEquals("REQ_LINKED_ACCESS_PROJECTDATA",
                built.getAsText("/contracts/onLinkedGranted/event/requestId/value"));

        assertEquals("MyOS/Worker Agency Permission Granted",
                built.getAsText("/contracts/onAgencyGranted/event/type/value"));
        assertEquals("REQ_AGENCY_PROCUREMENT",
                built.getAsText("/contracts/onAgencyGranted/event/requestId/value"));
    }

    @Test
    void unknownAccessAndAgencyStepHelpersFailFast() {
        IllegalArgumentException unknownAccess = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("Unknown access")
                        .operation("run")
                            .channel("ownerChannel")
                            .steps(steps -> steps.access("missing").call("x", null))
                            .done()
                        .buildDocument());
        assertNotNull(unknownAccess.getMessage());

        IllegalArgumentException unknownAgency = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("Unknown agency")
                        .operation("run")
                            .channel("ownerChannel")
                            .steps(steps -> steps.viaAgency("missing").requestPermission())
                            .done()
                        .buildDocument());
        assertNotNull(unknownAgency.getMessage());
    }

    @Test
    void sectionTracksContractsGeneratedByInteractionBuilders() {
        Node built = DocBuilder.doc()
                .name("Section tracking parity")
                .section("capabilities", "Capabilities", "Generated contracts")
                    .channel("ownerChannel")
                    .field("/targetSessionId", "session-77")
                    .access("catalog")
                        .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                        .onBehalfOf("ownerChannel")
                        .done()
                    .accessLinked("projectData")
                        .targetSessionId(DocBuilder.expr("document('/targetSessionId')"))
                        .onBehalfOf("ownerChannel")
                        .link("invoices")
                            .read(true)
                            .done()
                        .done()
                    .agency("procurement")
                        .onBehalfOf("ownerChannel")
                        .done()
                .endSection()
                .buildDocument();

        Node relatedContracts = built.getAsNode("/contracts/capabilities/relatedContracts");
        String relatedContractsText = String.valueOf(relatedContracts);
        assertNotNull(relatedContractsText);
        org.junit.jupiter.api.Assertions.assertTrue(
                relatedContractsText.contains("accessCATALOGRequestPermission"));
        org.junit.jupiter.api.Assertions.assertTrue(
                relatedContractsText.contains("linkedAccessPROJECTDATARequestPermission"));
        org.junit.jupiter.api.Assertions.assertTrue(
                relatedContractsText.contains("agencyPROCUREMENTRequestPermission"));
    }

    @Test
    void agencySupportsDocChangePermissionTiming() {
        Node built = DocBuilder.doc()
                .name("Agency doc-change timing")
                .channel("ownerChannel")
                .agency("procurement")
                    .onBehalfOf("ownerChannel")
                    .requestPermissionOnDocChange("/status")
                    .done()
                .buildDocument();

        assertEquals("Document Update Channel",
                built.getAsText("/contracts/agencyPROCUREMENTRequestPermissionDocUpdateChannel/type/value"));
        assertEquals("/status",
                built.getAsText("/contracts/agencyPROCUREMENTRequestPermissionDocUpdateChannel/path/value"));
        assertEquals("agencyPROCUREMENTRequestPermissionDocUpdateChannel",
                built.getAsText("/contracts/agencyPROCUREMENTRequestPermission/channel/value"));
    }
}
