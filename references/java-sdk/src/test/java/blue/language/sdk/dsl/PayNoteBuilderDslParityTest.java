package blue.language.sdk.dsl;

import blue.language.model.Node;
import blue.language.sdk.paynote.PayNotes;
import blue.language.types.paynote.FundsCaptured;
import blue.language.types.paynote.FundsReserved;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PayNoteBuilderDslParityTest {

    @Test
    void payNoteDefaultsAndAmountMinorBuildExpectedDocument() {
        Node built = PayNotes.payNote("Basic PayNote")
                .description("Simple paynote")
                .currency("USD")
                .amountMinor(1500)
                .buildDocument();

        assertEquals("Basic PayNote", built.getName());
        assertEquals("PayNote/PayNote", built.getAsText("/type/value"));
        assertEquals("USD", built.getAsText("/currency/value"));
        assertEquals(1500, built.getAsInteger("/amount/total/value").intValue());
        assertEquals("Core/Channel", built.getAsText("/contracts/payerChannel/type/value"));
        assertEquals("Core/Channel", built.getAsText("/contracts/payeeChannel/type/value"));
        assertEquals("Core/Channel", built.getAsText("/contracts/guarantorChannel/type/value"));
    }

    @Test
    void amountMajorConvertsUsingCurrencyScale() {
        Node usd = PayNotes.payNote("USD major amount")
                .currency("USD")
                .amountMajor("12.34")
                .buildDocument();
        assertEquals(1234, usd.getAsInteger("/amount/total/value").intValue());

        Node jpy = PayNotes.payNote("JPY major amount")
                .currency("JPY")
                .amountMajor(new BigDecimal("500"))
                .buildDocument();
        assertEquals(500, jpy.getAsInteger("/amount/total/value").intValue());
    }

    @Test
    void amountMajorRequiresCurrencyAndExactScale() {
        IllegalStateException missingCurrency = assertThrows(IllegalStateException.class, () ->
                PayNotes.payNote("Missing currency")
                        .amountMajor("10.00"));
        assertEquals("call currency() before amountMajor()", missingCurrency.getMessage());

        assertThrows(ArithmeticException.class, () ->
                PayNotes.payNote("Scale mismatch")
                        .currency("USD")
                        .amountMajor("10.001"));
    }

    @Test
    void amountMinorRejectsNegativeValues() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                PayNotes.payNote("Negative amount")
                        .currency("USD")
                        .amountMinor(-1));
        assertEquals("amount cannot be negative", exception.getMessage());
    }

    @Test
    void captureActionBuilderCoversLockUnlockAndRequestVariants() {
        Node built = PayNotes.payNote("Capture action parity")
                .currency("USD")
                .amountMinor(10000)
                .capture()
                    .lockOnInit()
                    .unlockOnEvent(FundsCaptured.class)
                    .unlockOnDocPathChange("/capture/open")
                    .unlockOnOperation(
                            "unlockCaptureByOperation",
                            "payerChannel",
                            "Unlock capture with extra step.",
                            steps -> steps.replaceValue("MarkCaptureUnlocked", "/capture/openedByOp", true))
                    .unlockOnOperation(
                            "unlockCaptureBySimpleOperation",
                            "payerChannel",
                            "Unlock capture directly.")
                    .requestOnInit()
                    .requestOnEvent(FundsCaptured.class)
                    .requestOnDocPathChange("/capture/open")
                    .requestOnOperation(
                            "requestCaptureByOperation",
                            "guarantorChannel",
                            "Request capture by operation.")
                    .requestPartialOnOperation(
                            "requestCapturePartialByOperation",
                            "guarantorChannel",
                            "Request partial capture by operation.",
                            "event.message.request.amount")
                    .requestPartialOnEvent(FundsCaptured.class, "event.amountCaptured")
                    .done()
                .buildDocument();

        Map<String, Node> contracts = built.getAsNode("/contracts").getProperties();
        assertTrue(contracts.containsKey("captureLockOnInit"));
        assertTrue(contracts.containsKey("captureUnlockOnFundsCaptured"));
        assertTrue(contracts.containsKey("captureUnlockOnDoccaptureopen"));
        assertTrue(contracts.containsKey("unlockCaptureByOperation"));
        assertTrue(contracts.containsKey("unlockCaptureBySimpleOperation"));
        assertTrue(contracts.containsKey("captureRequestOnInit"));
        assertTrue(contracts.containsKey("captureRequestOnFundsCaptured"));
        assertTrue(contracts.containsKey("captureRequestOnDoccaptureopen"));
        assertTrue(contracts.containsKey("requestCaptureByOperation"));
        assertTrue(contracts.containsKey("requestCapturePartialByOperation"));
        assertTrue(contracts.containsKey("capturePartialOnFundsCaptured"));

        assertEquals("PayNote/Card Transaction Capture Lock Requested",
                built.getAsText("/contracts/captureLockOnInit/steps/0/event/type/value"));
        assertEquals("PayNote/Card Transaction Capture Unlock Requested",
                built.getAsText("/contracts/captureUnlockOnFundsCaptured/steps/0/event/type/value"));
        assertEquals("PayNote/Card Transaction Capture Unlock Requested",
                built.getAsText("/contracts/unlockCaptureBySimpleOperationImpl/steps/0/event/type/value"));
        assertEquals("PayNote/Capture Funds Requested",
                built.getAsText("/contracts/requestCaptureByOperationImpl/steps/0/event/type/value"));
        assertEquals("${document('/amount/total')}",
                built.getAsText("/contracts/requestCaptureByOperationImpl/steps/0/event/amount/value"));
        assertEquals("${event.message.request.amount}",
                built.getAsText("/contracts/requestCapturePartialByOperationImpl/steps/0/event/amount/value"));
        assertEquals("${event.amountCaptured}",
                built.getAsText("/contracts/capturePartialOnFundsCaptured/steps/0/event/amount/value"));
    }

    @Test
    void reserveAndReleaseActionBuildersSupportAllTriggers() {
        Node built = PayNotes.payNote("Reserve + release action parity")
                .currency("USD")
                .amountMinor(10000)
                .reserve()
                    .lockOnInit()
                    .unlockOnEvent(FundsReserved.class)
                    .unlockOnDocPathChange("/reserve/open")
                    .unlockOnOperation("unlockReserve", "guarantorChannel", "Unlock reserve")
                    .requestOnInit()
                    .requestOnEvent(FundsReserved.class)
                    .requestOnDocPathChange("/reserve/open")
                    .requestOnOperation("requestReserve", "guarantorChannel", "Request reserve")
                    .requestPartialOnOperation(
                            "requestReservePartial",
                            "guarantorChannel",
                            "Request partial reserve",
                            "event.message.request.amount")
                    .requestPartialOnEvent(FundsReserved.class, "event.amountReserved")
                    .done()
                .release()
                    .lockOnInit()
                    .unlockOnEvent(FundsCaptured.class)
                    .unlockOnDocPathChange("/release/open")
                    .unlockOnOperation("unlockRelease", "guarantorChannel", "Unlock release")
                    .requestOnInit()
                    .requestOnEvent(FundsCaptured.class)
                    .requestOnDocPathChange("/release/open")
                    .requestOnOperation("requestRelease", "payerChannel", "Request release")
                    .requestPartialOnOperation(
                            "requestReleasePartial",
                            "payerChannel",
                            "Request partial release",
                            "event.message.request.amount")
                    .requestPartialOnEvent(FundsCaptured.class, "event.amountCaptured")
                    .done()
                .buildDocument();

        Map<String, Node> contracts = built.getAsNode("/contracts").getProperties();
        assertTrue(contracts.containsKey("reserveLockOnInit"));
        assertTrue(contracts.containsKey("reserveUnlockOnFundsReserved"));
        assertTrue(contracts.containsKey("reserveUnlockOnDocreserveopen"));
        assertTrue(contracts.containsKey("requestReservePartial"));
        assertTrue(contracts.containsKey("reservePartialOnFundsReserved"));

        assertTrue(contracts.containsKey("releaseLockOnInit"));
        assertTrue(contracts.containsKey("releaseUnlockOnFundsCaptured"));
        assertTrue(contracts.containsKey("releaseUnlockOnDocreleaseopen"));
        assertTrue(contracts.containsKey("requestReleasePartial"));
        assertTrue(contracts.containsKey("releasePartialOnFundsCaptured"));

        assertEquals("PayNote/Reserve Lock Requested",
                built.getAsText("/contracts/reserveLockOnInit/steps/0/event/type/value"));
        assertEquals("PayNote/Reserve Unlock Requested",
                built.getAsText("/contracts/reserveUnlockOnFundsReserved/steps/0/event/type/value"));
        assertEquals("PayNote/Reserve Funds Requested",
                built.getAsText("/contracts/requestReserveImpl/steps/0/event/type/value"));
        assertEquals("${event.message.request.amount}",
                built.getAsText("/contracts/requestReservePartialImpl/steps/0/event/amount/value"));
        assertEquals("${event.amountReserved}",
                built.getAsText("/contracts/reservePartialOnFundsReserved/steps/0/event/amount/value"));

        assertEquals("PayNote/Reservation Release Lock Requested",
                built.getAsText("/contracts/releaseLockOnInit/steps/0/event/type/value"));
        assertEquals("PayNote/Reservation Release Unlock Requested",
                built.getAsText("/contracts/releaseUnlockOnFundsCaptured/steps/0/event/type/value"));
        assertEquals("PayNote/Reservation Release Requested",
                built.getAsText("/contracts/requestReleaseImpl/steps/0/event/type/value"));
        assertEquals("${event.message.request.amount}",
                built.getAsText("/contracts/requestReleasePartialImpl/steps/0/event/amount/value"));
        assertEquals("${event.amountCaptured}",
                built.getAsText("/contracts/releasePartialOnFundsCaptured/steps/0/event/amount/value"));
    }

    @Test
    void lockOnInitRequiresConfiguredUnlockPathForEachAction() {
        IllegalStateException captureFailure = assertThrows(IllegalStateException.class, () ->
                PayNotes.payNote("Capture lock only")
                        .currency("USD")
                        .amountMinor(100)
                        .capture().lockOnInit().done()
                        .buildDocument());
        assertEquals("capture locked on init but no unlock path configured", captureFailure.getMessage());

        IllegalStateException reserveFailure = assertThrows(IllegalStateException.class, () ->
                PayNotes.payNote("Reserve lock only")
                        .currency("USD")
                        .amountMinor(100)
                        .reserve().lockOnInit().done()
                        .buildDocument());
        assertEquals("reserve locked on init but no unlock path configured", reserveFailure.getMessage());

        IllegalStateException releaseFailure = assertThrows(IllegalStateException.class, () ->
                PayNotes.payNote("Release lock only")
                        .currency("USD")
                        .amountMinor(100)
                        .release().lockOnInit().done()
                        .buildDocument());
        assertEquals("release locked on init but no unlock path configured", releaseFailure.getMessage());
    }

    @Test
    void payNotesFactoryReturnsConfiguredBuilder() {
        Node built = PayNotes.payNote("Factory parity")
                .currency("USD")
                .amountMinor(1)
                .buildDocument();
        assertNotNull(built);
        assertEquals("Factory parity", built.getName());
    }
}
