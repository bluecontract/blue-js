package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.internal.StepsBuilder;
import blue.language.types.conversation.ChatMessage;
import blue.language.types.payments.PaymentRequests;
import blue.language.types.payments.fields.CardTokenPaymentFields;
import blue.language.types.payments.fields.CreditLinePaymentFields;
import blue.language.types.payments.fields.LedgerPaymentFields;
import blue.language.types.payments.fields.SepaPaymentFields;
import blue.language.types.payments.fields.WirePaymentFields;
import org.junit.jupiter.api.Test;

import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocBuilderStepsDslParityTest {

    @Test
    void captureStepBuilderMethodsMatchYamlDefinition() {
        Node built = DocBuilder.doc()
                .name("Capture step parity")
                .onInit("captureFlow", steps -> steps
                        .capture().lock()
                        .capture().unlock()
                        .capture().markLocked()
                        .capture().markUnlocked()
                        .capture().requestNow()
                        .capture().requestPartial("document('/amount/partial')")
                        .capture().releaseFull())
                .buildDocument();

        assertEquals("Conversation/Sequential Workflow", String.valueOf(built.get("/contracts/captureFlow/type/value")));
        assertEquals("initLifecycleChannel", String.valueOf(built.get("/contracts/captureFlow/channel/value")));
        assertEquals("PayNote/Card Transaction Capture Lock Requested", String.valueOf(built.get("/contracts/captureFlow/steps/0/event/type/value")));
        assertEquals("PayNote/Card Transaction Capture Unlock Requested", String.valueOf(built.get("/contracts/captureFlow/steps/1/event/type/value")));
        assertEquals("PayNote/Card Transaction Capture Locked", String.valueOf(built.get("/contracts/captureFlow/steps/2/event/type/value")));
        assertEquals("PayNote/Card Transaction Capture Unlocked", String.valueOf(built.get("/contracts/captureFlow/steps/3/event/type/value")));
        assertEquals("PayNote/Capture Funds Requested", String.valueOf(built.get("/contracts/captureFlow/steps/4/event/type/value")));
        assertEquals("${document('/amount/total')}", String.valueOf(built.get("/contracts/captureFlow/steps/4/event/amount/value")));
        assertEquals("${document('/amount/partial')}", String.valueOf(built.get("/contracts/captureFlow/steps/5/event/amount/value")));
        assertEquals("PayNote/Reservation Release Requested", String.valueOf(built.get("/contracts/captureFlow/steps/6/event/type/value")));
        assertEquals("${document('/amount/total')}", String.valueOf(built.get("/contracts/captureFlow/steps/6/event/amount/value")));
    }

    @Test
    void stepPrimitivesAndEmitHelpersBuildExpectedContracts() {
        Node rawStep = new Node()
                .name("RawStep")
                .type("Conversation/JavaScript Code")
                .properties("code", new Node().value("return { done: true };"));

        Node built = DocBuilder.doc()
                .name("Step primitive parity")
                .field("/counter", 1)
                .onInit("initialize", steps -> steps
                        .jsRaw("Compute", "return { next: 2 };")
                        .updateDocument("ApplyPatch", changeset -> changeset
                                .addValue("/items/0", "x")
                                .replaceValue("/counter", 2)
                                .replaceExpression("/expr", "document('/counter') + 1")
                                .remove("/obsolete"))
                        .updateDocumentFromExpression("ApplyDynamic", "steps.Compute.nextChangeset")
                        .triggerEvent("EmitTriggered", new Node()
                                .type("Conversation/Chat Message")
                                .properties("message", new Node().value("from-trigger")))
                        .emit("EmitBean", new ChatMessage().message("from-bean"))
                        .emitType("EmitTyped", Integer.class,
                                payload -> payload.put("value", 7).putExpression("total", "document('/counter') + 3"))
                        .namedEvent("EmitAdHoc", "AD_HOC", payload -> payload.put("flag", true))
                        .namedEvent("EmitNamed", "NAMED")
                        .namedEvent("EmitNamedWithPayload", "NAMED_PAYLOAD", payload -> payload.put("status", "ok"))
                        .replaceValue("ReplaceValue", "/status", "ready")
                        .replaceExpression("ReplaceExpression", "/calc", "document('/counter') + 5")
                        .raw(rawStep))
                .buildDocument();

        assertEquals("Conversation/JavaScript Code", String.valueOf(built.get("/contracts/initialize/steps/0/type/value")));
        assertEquals("return { next: 2 };", String.valueOf(built.get("/contracts/initialize/steps/0/code/value")));
        assertEquals("add", String.valueOf(built.get("/contracts/initialize/steps/1/changeset/0/op/value")));
        assertEquals("/items/0", String.valueOf(built.get("/contracts/initialize/steps/1/changeset/0/path/value")));
        assertEquals("replace", String.valueOf(built.get("/contracts/initialize/steps/1/changeset/1/op/value")));
        assertEquals("${document('/counter') + 1}",
                String.valueOf(built.get("/contracts/initialize/steps/1/changeset/2/val/value")));
        assertEquals("remove", String.valueOf(built.get("/contracts/initialize/steps/1/changeset/3/op/value")));
        assertEquals("${steps.Compute.nextChangeset}",
                String.valueOf(built.get("/contracts/initialize/steps/2/changeset/value")));
        assertTypeAliasOrBlueId(
                built,
                "/contracts/initialize/steps/3/event",
                "Conversation/Chat Message",
                "AkUKoKY1hHY1CytCrAXDPKCd4md1QGmn1WNcQtWBsyAD");
        assertEquals("from-trigger", String.valueOf(built.get("/contracts/initialize/steps/3/event/message/value")));
        assertTypeAliasOrBlueId(
                built,
                "/contracts/initialize/steps/4/event",
                "Conversation/Chat Message",
                "AkUKoKY1hHY1CytCrAXDPKCd4md1QGmn1WNcQtWBsyAD");
        assertEquals("from-bean", String.valueOf(built.get("/contracts/initialize/steps/4/event/message/value")));
        assertEquals("Integer", String.valueOf(built.get("/contracts/initialize/steps/5/event/type/value")));
        assertEquals("7", String.valueOf(built.get("/contracts/initialize/steps/5/event/value/value")));
        assertEquals("${document('/counter') + 3}",
                String.valueOf(built.get("/contracts/initialize/steps/5/event/total/value")));
        assertTypeAliasOrBlueId(
                built,
                "/contracts/initialize/steps/6/event",
                "Common/Named Event",
                "Common-Named-Event-Demo-BlueId");
        assertEquals("AD_HOC", String.valueOf(built.get("/contracts/initialize/steps/6/event/name/value")));
        assertEquals("true", String.valueOf(built.get("/contracts/initialize/steps/6/event/payload/flag/value")));
        assertEquals("NAMED", String.valueOf(built.get("/contracts/initialize/steps/7/event/name/value")));
        assertEquals("NAMED_PAYLOAD", String.valueOf(built.get("/contracts/initialize/steps/8/event/name/value")));
        assertEquals("ok", String.valueOf(built.get("/contracts/initialize/steps/8/event/payload/status/value")));
        assertEquals("ready", String.valueOf(built.get("/contracts/initialize/steps/9/changeset/0/val/value")));
        assertEquals("${document('/counter') + 5}",
                String.valueOf(built.get("/contracts/initialize/steps/10/changeset/0/val/value")));
        assertEquals("Conversation/JavaScript Code", String.valueOf(built.get("/contracts/initialize/steps/11/type/value")));
        assertEquals("return { done: true };", String.valueOf(built.get("/contracts/initialize/steps/11/code/value")));
    }

    @Test
    void triggerPaymentMapsCoreAndRailSpecificPayloadFields() {
        Node payerNode = new Node().properties("channel", new Node().value("payerChannel"));
        Node payeeNode = new Node().properties("channel", new Node().value("payeeChannel"));
        Node attached = new Node().name("Attached PayNote");

        Node built = DocBuilder.doc()
                .name("Payment payload parity")
                .onInit("bootstrap", steps -> steps.triggerPayment(
                        "RequestPayment",
                        PaymentRequests.CryptoTransferRequested.class,
                        payload -> payload
                                .processor("processorChannel")
                                .payer("payerRef")
                                .payer(payerNode)
                                .payee("payeeRef")
                                .payee(payeeNode)
                                .currency("USD")
                                .amountMinor(1500)
                                .amountMinorExpression("document('/amount/total')")
                                .attachPayNote(attached)
                                .viaAch()
                                    .routingNumber("111000025")
                                    .accountNumber("123456")
                                    .accountType("checking")
                                    .network("ACH")
                                    .companyEntryDescription("PAYROLL")
                                    .done()
                                .viaSepa(new SepaPaymentFields()
                                        .ibanFrom("DE123")
                                        .ibanTo("DE456")
                                        .bicTo("BICCODE")
                                        .remittanceInformation("Invoice #123"))
                                .viaWire(new WirePaymentFields()
                                        .bankSwift("SWIFT-1")
                                        .bankName("Blue Bank")
                                        .beneficiaryName("Jane Doe")
                                        .beneficiaryAddress("Main Street 1"))
                                .viaCard()
                                    .cardOnFileRef("cof-1")
                                    .merchantDescriptor("Blue Shop")
                                    .done()
                                .viaTokenizedCard(new CardTokenPaymentFields()
                                        .networkToken("token-1")
                                        .tokenProvider("provider-1")
                                        .cryptogram("crypt-1"))
                                .viaCreditLine(new CreditLinePaymentFields()
                                        .creditLineId("credit-1")
                                        .merchantAccountId("merchant-1")
                                        .cardholderAccountId("holder-1"))
                                .viaLedger(new LedgerPaymentFields()
                                        .ledgerAccountFrom("ledger-from")
                                        .ledgerAccountTo("ledger-to")
                                        .memo("memo-1"))
                                .viaCrypto()
                                    .asset("BTC")
                                    .chain("bitcoin")
                                    .fromWalletRef("wallet-1")
                                    .toAddress("bc1address")
                                    .txPolicy("fast")
                                    .done()
                                .putCustom("customField", "custom-value")
                                .putCustomExpression("customExpr", "document('/calc')")))
                .buildDocument();

        String eventPath = "/contracts/bootstrap/steps/0/event";
        assertEquals("Payments/Crypto Transfer Requested", built.getAsText(eventPath + "/type/value"));
        assertEquals("processorChannel", built.getAsText(eventPath + "/processor/value"));
        assertEquals("payerChannel", built.getAsText(eventPath + "/payer/channel/value"));
        assertEquals("payeeChannel", built.getAsText(eventPath + "/payee/channel/value"));
        assertEquals("USD", built.getAsText(eventPath + "/currency/value"));
        assertEquals("${document('/amount/total')}", built.getAsText(eventPath + "/amountMinor/value"));
        assertEquals("Attached PayNote", built.getAsNode(eventPath + "/attachedPayNote").getName());
        assertEquals("111000025", built.getAsText(eventPath + "/routingNumber/value"));
        assertEquals("123456", built.getAsText(eventPath + "/accountNumber/value"));
        assertEquals("checking", built.getAsText(eventPath + "/accountType/value"));
        assertEquals("ACH", built.getAsText(eventPath + "/network/value"));
        assertEquals("PAYROLL", built.getAsText(eventPath + "/companyEntryDescription/value"));
        assertEquals("DE123", built.getAsText(eventPath + "/ibanFrom/value"));
        assertEquals("DE456", built.getAsText(eventPath + "/ibanTo/value"));
        assertEquals("BICCODE", built.getAsText(eventPath + "/bicTo/value"));
        assertEquals("Invoice #123", built.getAsText(eventPath + "/remittanceInformation/value"));
        assertEquals("SWIFT-1", built.getAsText(eventPath + "/bankSwift/value"));
        assertEquals("Blue Bank", built.getAsText(eventPath + "/bankName/value"));
        assertEquals("Jane Doe", built.getAsText(eventPath + "/beneficiaryName/value"));
        assertEquals("Main Street 1", built.getAsText(eventPath + "/beneficiaryAddress/value"));
        assertEquals("cof-1", built.getAsText(eventPath + "/cardOnFileRef/value"));
        assertEquals("Blue Shop", built.getAsText(eventPath + "/merchantDescriptor/value"));
        assertEquals("token-1", built.getAsText(eventPath + "/networkToken/value"));
        assertEquals("provider-1", built.getAsText(eventPath + "/tokenProvider/value"));
        assertEquals("crypt-1", built.getAsText(eventPath + "/cryptogram/value"));
        assertEquals("credit-1", built.getAsText(eventPath + "/creditLineId/value"));
        assertEquals("merchant-1", built.getAsText(eventPath + "/merchantAccountId/value"));
        assertEquals("holder-1", built.getAsText(eventPath + "/cardholderAccountId/value"));
        assertEquals("ledger-from", built.getAsText(eventPath + "/ledgerAccountFrom/value"));
        assertEquals("ledger-to", built.getAsText(eventPath + "/ledgerAccountTo/value"));
        assertEquals("memo-1", built.getAsText(eventPath + "/memo/value"));
        assertEquals("BTC", built.getAsText(eventPath + "/asset/value"));
        assertEquals("bitcoin", built.getAsText(eventPath + "/chain/value"));
        assertEquals("wallet-1", built.getAsText(eventPath + "/fromWalletRef/value"));
        assertEquals("bc1address", built.getAsText(eventPath + "/toAddress/value"));
        assertEquals("fast", built.getAsText(eventPath + "/txPolicy/value"));
        assertEquals("custom-value", built.getAsText(eventPath + "/customField/value"));
        assertEquals("${document('/calc')}", built.getAsText(eventPath + "/customExpr/value"));
    }

    @Test
    void requestBackwardPaymentBuildsAbstractIntentAndSupportsOptionalRailHint() {
        Node built = DocBuilder.doc()
                .name("Backward payment parity")
                .onInit("bootstrap", steps -> steps
                        .requestBackwardPayment(
                                "RequestBackwardPaymentAbstract",
                                payload -> payload
                                        .processor("guarantorChannel")
                                        .from("payeeChannel")
                                        .to("payerChannel")
                                        .currency("USD")
                                        .amountMinor(10000)
                                        .reason("voucher-activation"))
                        .requestBackwardPayment(
                                "RequestBackwardPaymentHinted",
                                payload -> payload
                                        .processor("guarantorChannel")
                                        .from("payeeChannel")
                                        .to("payerChannel")
                                        .currency("USD")
                                        .amountMinor(10000)
                                        .reason("voucher-activation")
                                        .viaCreditLine()
                                            .creditLineId("facility-1")
                                            .done()))
                .buildDocument();

        String abstractPath = "/contracts/bootstrap/steps/0/event";
        assertEquals("PayNote/Backward Payment Requested", built.getAsText(abstractPath + "/type/value"));
        assertEquals("guarantorChannel", built.getAsText(abstractPath + "/processor/value"));
        assertEquals("payeeChannel", built.getAsText(abstractPath + "/from/value"));
        assertEquals("payerChannel", built.getAsText(abstractPath + "/to/value"));
        assertEquals("USD", built.getAsText(abstractPath + "/currency/value"));
        assertEquals("10000", String.valueOf(built.get(abstractPath + "/amountMinor/value")));
        assertEquals("voucher-activation", built.getAsText(abstractPath + "/reason/value"));
        assertNull(built.getAsNode(abstractPath).getProperties().get("creditLineId"));

        String hintedPath = "/contracts/bootstrap/steps/1/event";
        assertEquals("PayNote/Backward Payment Requested", built.getAsText(hintedPath + "/type/value"));
        assertEquals("facility-1", built.getAsText(hintedPath + "/creditLineId/value"));
    }

    @Test
    void bootstrapDocumentBuildersMapDocumentBindingsAndOptions() {
        Node child = new Node()
                .name("Child Doc")
                .type("Demo/Child");

        Node built = DocBuilder.doc()
                .name("Bootstrap parity")
                .onInit("bootstrap", steps -> steps
                        .bootstrapDocument(
                                "BootstrapNode",
                                child,
                                java.util.Map.of("participantA", "aliceChannel"),
                                options -> options
                                        .assignee("orchestratorChannel")
                                        .defaultMessage("You have been added.")
                                        .channelMessage("participantA", "Please review and accept."))
                        .bootstrapDocumentExpr(
                                "BootstrapExpr",
                                "document('/childTemplate')",
                                java.util.Map.of("participantB", "bobChannel"),
                                options -> options.assignee("myOsAdminChannel")))
                .buildDocument();

        String first = "/contracts/bootstrap/steps/0/event";
        assertEquals("Conversation/Document Bootstrap Requested", built.getAsText(first + "/type/value"));
        assertEquals("Child Doc", built.getAsText(first + "/document/name/value"));
        assertEquals("aliceChannel", built.getAsText(first + "/channelBindings/participantA/value"));
        assertEquals("orchestratorChannel", built.getAsText(first + "/bootstrapAssignee/value"));
        assertEquals("You have been added.", built.getAsText(first + "/initialMessages/defaultMessage/value"));
        assertEquals("Please review and accept.", built.getAsText(first + "/initialMessages/perChannel/participantA/value"));

        String second = "/contracts/bootstrap/steps/1/event";
        assertEquals("Conversation/Document Bootstrap Requested", built.getAsText(second + "/type/value"));
        assertEquals("${document('/childTemplate')}", built.getAsText(second + "/document/value"));
        assertEquals("bobChannel", built.getAsText(second + "/channelBindings/participantB/value"));
        assertEquals("myOsAdminChannel", built.getAsText(second + "/bootstrapAssignee/value"));
    }

    @Test
    void triggerPaymentRequiresProcessorField() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("Invalid payment request")
                        .onInit("bootstrap", steps -> steps.triggerPayment(
                                "RequestPayment",
                                PaymentRequests.PaymentRequested.class,
                                payload -> payload.currency("USD")))
                        .buildDocument());

        assertEquals("triggerPayment requires non-empty processor field", exception.getMessage());
    }

    @Test
    void paymentBuilderRejectsCustomProcessorKey() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                DocBuilder.doc()
                        .name("Invalid payment custom key")
                        .onInit("bootstrap", steps -> steps.triggerPayment(
                                "RequestPayment",
                                PaymentRequests.PaymentRequested.class,
                                payload -> payload
                                        .processor("processorChannel")
                                        .putCustom("processor", "forbidden")))
                        .buildDocument());

        assertEquals("Use processor(...) to set processor", exception.getMessage());
    }

    @Test
    void paymentPayloadExtSupportsThirdPartyFields() {
        Node built = DocBuilder.doc()
                .name("Payment ext parity")
                .onInit("bootstrap", steps -> steps.triggerPayment(
                        "RequestPayment",
                        PaymentRequests.PaymentRequested.class,
                        payload -> payload
                                .processor("processorChannel")
                                .currency("USD")
                                .amountMinor(100)
                                .ext(DemoBankPaymentFields::new)
                                .creditFacilityId("facility-42")
                                .riskTier("tier-a")))
                .buildDocument();

        String eventPath = "/contracts/bootstrap/steps/0/event";
        assertEquals("facility-42", built.getAsText(eventPath + "/creditFacilityId/value"));
        assertEquals("tier-a", built.getAsText(eventPath + "/riskTier/value"));
    }

    @Test
    void extRejectsNullFactoriesAndNullExtensions() {
        StepsBuilder steps = new StepsBuilder();
        assertThrows(IllegalArgumentException.class, () -> steps.ext(null));
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> steps.ext(ignored -> null));
        assertEquals("extensionFactory cannot return null", exception.getMessage());
    }

    @Test
    void eventEmitHelpersRequireExplicitStepNames() {
        StepsBuilder steps = new StepsBuilder();

        assertThrows(IllegalArgumentException.class,
                () -> steps.triggerEvent(null, new Node().type("Conversation/Event")));
        assertThrows(IllegalArgumentException.class,
                () -> steps.emit(" ", new ChatMessage().message("x")));
        assertThrows(IllegalArgumentException.class,
                () -> steps.emitType("", ChatMessage.class, payload -> payload.put("message", "x")));
        assertThrows(IllegalArgumentException.class,
                () -> steps.namedEvent("", "event-name"));
        assertThrows(IllegalArgumentException.class,
                () -> steps.namedEvent("Named", " "));
    }

    @Test
    void extSupportsCustomStepExtensions() {
        Node built = DocBuilder.doc()
                .name("Custom extension parity")
                .onInit("initialize", steps -> {
                    DemoExtension extension = steps.ext(DemoExtension::new);
                    extension.emitDemo("EXT_SIGNAL");
                })
                .buildDocument();

        assertNotNull(built.getAsNode("/contracts/initialize/steps/0/event"));
        assertEquals("Common/Named Event",
                built.getAsText("/contracts/initialize/steps/0/event/type/value"));
        assertEquals("EXT_SIGNAL",
                built.getAsText("/contracts/initialize/steps/0/event/name/value"));
    }

    private static final class DemoExtension {
        private final StepsBuilder parent;

        private DemoExtension(StepsBuilder parent) {
            this.parent = Objects.requireNonNull(parent, "parent");
        }

        private StepsBuilder emitDemo(String signal) {
            return parent.namedEvent("DemoStep", signal);
        }
    }

    private static final class DemoBankPaymentFields {
        private final StepsBuilder.PaymentRequestPayloadBuilder payload;

        private DemoBankPaymentFields(StepsBuilder.PaymentRequestPayloadBuilder payload) {
            this.payload = Objects.requireNonNull(payload, "payload");
        }

        private DemoBankPaymentFields creditFacilityId(String value) {
            payload.putCustom("creditFacilityId", value);
            return this;
        }

        private DemoBankPaymentFields riskTier(String value) {
            payload.putCustom("riskTier", value);
            return this;
        }
    }

    private static void assertTypeAliasOrBlueId(Node built,
                                                String eventPath,
                                                String expectedAlias,
                                                String expectedBlueId) {
        String alias = String.valueOf(built.get(eventPath + "/type/value"));
        String blueId = String.valueOf(built.get(eventPath + "/type/blueId"));
        assertTrue(
                expectedAlias.equals(alias) || expectedAlias.equals(blueId)
                        || expectedBlueId.equals(alias) || expectedBlueId.equals(blueId),
                () -> "Expected type " + expectedAlias + " or " + expectedBlueId
                        + " but found alias=" + alias + ", blueId=" + blueId);
    }
}
