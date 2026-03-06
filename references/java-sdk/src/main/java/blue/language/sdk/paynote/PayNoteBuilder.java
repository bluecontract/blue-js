package blue.language.sdk.paynote;

import blue.language.model.Node;
import blue.language.sdk.DocBuilder;
import blue.language.sdk.internal.PayNoteAliases;
import blue.language.sdk.internal.PayNoteEvents;
import blue.language.sdk.internal.StepsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class PayNoteBuilder extends DocBuilder<PayNoteBuilder> {

    private static final String TOTAL_AMOUNT_EXPRESSION = "document('/amount/total')";
    private static final String RESERVE_LOCK_REQUESTED = "PayNote/Reserve Lock Requested";
    private static final String RESERVE_UNLOCK_REQUESTED = "PayNote/Reserve Unlock Requested";
    private static final String RELEASE_LOCK_REQUESTED = "PayNote/Reservation Release Lock Requested";
    private static final String RELEASE_UNLOCK_REQUESTED = "PayNote/Reservation Release Unlock Requested";

    private Currency currency;
    private final ActionState captureState = new ActionState();
    private final ActionState reserveState = new ActionState();
    private final ActionState releaseState = new ActionState();

    private PayNoteBuilder(String name) {
        super();
        type(PayNoteAliases.PAYNOTE);
        name(name);
        channels("payerChannel", "payeeChannel", "guarantorChannel");
    }

    public static PayNoteBuilder payNote(String name) {
        return new PayNoteBuilder(name);
    }

    public PayNoteBuilder currency(String code) {
        require(code, "currency code");
        this.currency = Currency.getInstance(code.trim().toUpperCase());
        return set("/currency", currency.getCurrencyCode());
    }

    public PayNoteBuilder amountMinor(long totalMinor) {
        if (totalMinor < 0) {
            throw new IllegalArgumentException("amount cannot be negative");
        }
        set("/amount/total", totalMinor);
        return this;
    }

    public PayNoteBuilder amountMajor(String totalMajor) {
        require(totalMajor, "amount");
        return amountMajor(new BigDecimal(totalMajor.trim()));
    }

    public PayNoteBuilder amountMajor(BigDecimal totalMajor) {
        if (totalMajor == null) {
            throw new IllegalArgumentException("amount is required");
        }
        if (currency == null) {
            throw new IllegalStateException("call currency() before amountMajor()");
        }
        int fractionDigits = currency.getDefaultFractionDigits();
        if (fractionDigits < 0) {
            throw new IllegalStateException("currency does not define default fraction digits: "
                    + currency.getCurrencyCode());
        }
        long minor = totalMajor
                .movePointRight(fractionDigits)
                .setScale(0, RoundingMode.UNNECESSARY)
                .longValueExact();
        return amountMinor(minor);
    }

    public ActionBuilder capture() {
        return new ActionBuilder(
                this,
                "capture",
                captureState,
                steps -> steps.capture().lock(),
                steps -> steps.capture().unlock(),
                steps -> steps.capture().requestNow(),
                (steps, amountExpr) -> steps.capture().requestPartial(amountExpr));
    }

    public ActionBuilder reserve() {
        return new ActionBuilder(
                this,
                "reserve",
                reserveState,
                PayNoteBuilder::requestReserveLock,
                PayNoteBuilder::requestReserveUnlock,
                PayNoteBuilder::requestReserveNow,
                PayNoteBuilder::requestReservePartial);
    }

    public ActionBuilder release() {
        return new ActionBuilder(
                this,
                "release",
                releaseState,
                PayNoteBuilder::requestReleaseLock,
                PayNoteBuilder::requestReleaseUnlock,
                PayNoteBuilder::requestReleaseNow,
                PayNoteBuilder::requestReleasePartial);
    }

    @Override
    public Node buildDocument() {
        validate(captureState, "capture");
        validate(reserveState, "reserve");
        validate(releaseState, "release");
        return super.buildDocument();
    }

    private static void validate(ActionState state, String name) {
        if (state.locked && state.unlockPaths == 0) {
            throw new IllegalStateException(name + " locked on init but no unlock path configured");
        }
    }

    private static void requestReserveLock(StepsBuilder steps) {
        steps.triggerEvent("RequestReserveLock", eventOfType(RESERVE_LOCK_REQUESTED));
    }

    private static void requestReserveUnlock(StepsBuilder steps) {
        steps.triggerEvent("RequestReserveUnlock", eventOfType(RESERVE_UNLOCK_REQUESTED));
    }

    private static void requestReserveNow(StepsBuilder steps) {
        steps.triggerEvent("ReserveFundsRequested",
                PayNoteEvents.reserveFundsRequested(new Node().value(expr(TOTAL_AMOUNT_EXPRESSION))));
    }

    private static void requestReservePartial(StepsBuilder steps, String amountExpr) {
        steps.triggerEvent("ReserveFundsRequested",
                PayNoteEvents.reserveFundsRequested(new Node().value(expr(amountExpr))));
    }

    private static void requestReleaseLock(StepsBuilder steps) {
        steps.triggerEvent("RequestReleaseLock", eventOfType(RELEASE_LOCK_REQUESTED));
    }

    private static void requestReleaseUnlock(StepsBuilder steps) {
        steps.triggerEvent("RequestReleaseUnlock", eventOfType(RELEASE_UNLOCK_REQUESTED));
    }

    private static void requestReleaseNow(StepsBuilder steps) {
        steps.triggerEvent("RequestRelease",
                PayNoteEvents.reservationReleaseRequested(new Node().value(expr(TOTAL_AMOUNT_EXPRESSION))));
    }

    private static void requestReleasePartial(StepsBuilder steps, String amountExpr) {
        steps.triggerEvent("RequestRelease",
                PayNoteEvents.reservationReleaseRequested(new Node().value(expr(amountExpr))));
    }

    private static Node eventOfType(String typeAlias) {
        return new Node().type(typeAlias);
    }

    private static void require(Object value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (value instanceof String && ((String) value).trim().isEmpty()) {
            throw new IllegalArgumentException(name + " is required");
        }
    }

    private static String sanitize(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "Signal";
        }
        return value.replaceAll("[^a-zA-Z0-9]", "");
    }

    private static final class ActionState {
        private boolean locked;
        private int unlockPaths;
    }

    public static final class ActionBuilder {
        private final PayNoteBuilder parent;
        private final String prefix;
        private final ActionState state;
        private final Consumer<StepsBuilder> lockStep;
        private final Consumer<StepsBuilder> unlockStep;
        private final Consumer<StepsBuilder> requestStep;
        private final BiConsumer<StepsBuilder, String> partialRequestStep;

        private ActionBuilder(PayNoteBuilder parent,
                              String prefix,
                              ActionState state,
                              Consumer<StepsBuilder> lockStep,
                              Consumer<StepsBuilder> unlockStep,
                              Consumer<StepsBuilder> requestStep,
                              BiConsumer<StepsBuilder, String> partialRequestStep) {
            this.parent = parent;
            this.prefix = prefix;
            this.state = state;
            this.lockStep = lockStep;
            this.unlockStep = unlockStep;
            this.requestStep = requestStep;
            this.partialRequestStep = partialRequestStep;
        }

        public ActionBuilder lockOnInit() {
            if (!state.locked) {
                parent.onInit(prefix + "LockOnInit", lockStep);
                state.locked = true;
            }
            return this;
        }

        public ActionBuilder unlockOnEvent(Class<?> eventType) {
            parent.onEvent(prefix + "UnlockOn" + eventType.getSimpleName(), eventType, unlockStep);
            state.unlockPaths++;
            return this;
        }

        public ActionBuilder unlockOnDocPathChange(String path) {
            parent.onDocChange(prefix + "UnlockOnDoc" + sanitize(path), path, unlockStep);
            state.unlockPaths++;
            return this;
        }

        public ActionBuilder unlockOnOperation(String operationKey,
                                               String channelKey,
                                               String description) {
            return unlockOnOperation(operationKey, channelKey, description, null);
        }

        public ActionBuilder unlockOnOperation(String operationKey,
                                               String channelKey,
                                               String description,
                                               Consumer<StepsBuilder> extra) {
            parent.operation(operationKey, channelKey, description, steps -> {
                if (extra != null) {
                    extra.accept(steps);
                }
                unlockStep.accept(steps);
            });
            state.unlockPaths++;
            return this;
        }

        public ActionBuilder requestOnInit() {
            parent.onInit(prefix + "RequestOnInit", requestStep);
            return this;
        }

        public ActionBuilder requestOnEvent(Class<?> eventType) {
            parent.onEvent(prefix + "RequestOn" + eventType.getSimpleName(), eventType, requestStep);
            return this;
        }

        public ActionBuilder requestOnDocPathChange(String path) {
            parent.onDocChange(prefix + "RequestOnDoc" + sanitize(path), path, requestStep);
            return this;
        }

        public ActionBuilder requestOnOperation(String operationKey,
                                                String channelKey,
                                                String description) {
            parent.operation(operationKey, channelKey, description, requestStep);
            return this;
        }

        public ActionBuilder requestPartialOnOperation(String operationKey,
                                                       String channelKey,
                                                       String description,
                                                       String amountExpr) {
            parent.operation(operationKey, channelKey, description,
                    steps -> partialRequestStep.accept(steps, amountExpr));
            return this;
        }

        public ActionBuilder requestPartialOnEvent(Class<?> eventType,
                                                   String amountExpr) {
            parent.onEvent(prefix + "PartialOn" + eventType.getSimpleName(),
                    eventType, steps -> partialRequestStep.accept(steps, amountExpr));
            return this;
        }

        public PayNoteBuilder done() {
            return parent;
        }
    }
}
