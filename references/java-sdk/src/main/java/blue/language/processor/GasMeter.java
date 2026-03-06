package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.util.NodeCanonicalizer;
import blue.language.processor.util.PointerUtils;

import java.math.BigInteger;

/**
 * Tracks and charges gas usage for a processing run.
 */
final class GasMeter {

    private long totalGas;

    long totalGas() {
        return totalGas;
    }

    void add(long amount) {
        totalGas += amount;
    }

    void chargeScopeEntry(String scopePath) {
        add(GasCharges.scopeEntry(PointerUtils.splitPointerSegments(scopePath).length));
    }

    void chargeInitialization() {
        add(GasCharges.INITIALIZATION);
    }

    void chargeChannelMatchAttempt() {
        add(GasCharges.CHANNEL_MATCH_ATTEMPT);
    }

    void chargeHandlerOverhead() {
        add(GasCharges.HANDLER_OVERHEAD);
    }

    void chargeBoundaryCheck() {
        add(GasCharges.BOUNDARY_CHECK);
    }

    void chargePatchAddOrReplace(Node value) {
        add(GasCharges.patchAddOrReplace(payloadSizeCharge(value)));
    }

    void chargePatchRemove() {
        add(GasCharges.PATCH_REMOVE);
    }

    void chargeCascadeRouting(int scopeCount) {
        if (scopeCount > 0) {
            add(GasCharges.cascadeRouting(scopeCount));
        }
    }

    void chargeEmitEvent(Node event) {
        add(GasCharges.emitEvent(payloadSizeCharge(event)));
    }

    void chargeBridge(Node event) {
        add(GasCharges.BRIDGE_NODE);
    }

    void chargeDrainEvent() {
        add(GasCharges.DRAIN_EVENT);
    }

    void chargeCheckpointUpdate() {
        add(GasCharges.CHECKPOINT_UPDATE);
    }

    void chargeTerminationMarker() {
        add(GasCharges.TERMINATION_MARKER);
    }

    void chargeLifecycleDelivery() {
        add(GasCharges.LIFECYCLE_DELIVERY);
    }

    void chargeFatalTerminationOverhead() {
        add(GasCharges.FATAL_TERMINATION_OVERHEAD);
    }

    void chargeTriggerEventBase() {
        add(GasCharges.TRIGGER_EVENT_BASE);
    }

    void chargeUpdateDocumentBase(int changesetLength) {
        add(GasCharges.updateDocumentBase(changesetLength));
    }

    void chargeDocumentSnapshot(String absolutePointer, Node snapshot) {
        long bytes = snapshot != null ? NodeCanonicalizer.canonicalSize(snapshot) : 0L;
        add(GasCharges.documentSnapshot(absolutePointer, bytes));
    }

    void chargeWasmGas(BigInteger wasmFuel) {
        if (wasmFuel == null) {
            return;
        }
        long charge = ProcessorGasSchedule.wasmFuelToHostGas(wasmFuel);
        if (charge > 0L) {
            add(charge);
        }
    }

    void chargeWasmGas(long wasmFuel) {
        if (wasmFuel <= 0L) {
            return;
        }
        chargeWasmGas(BigInteger.valueOf(wasmFuel));
    }

    private long payloadSizeCharge(Node node) {
        long bytes = NodeCanonicalizer.canonicalSize(node);
        return GasCharges.ceil100(bytes);
    }

    private static final class GasCharges {
        private static final long INITIALIZATION = 1_000L;
        private static final long CHANNEL_MATCH_ATTEMPT = 5L;
        private static final long HANDLER_OVERHEAD = 50L;
        private static final long BOUNDARY_CHECK = 2L;
        private static final long PATCH_REMOVE = 10L;
        private static final long BRIDGE_NODE = 10L;
        private static final long DRAIN_EVENT = 10L;
        private static final long CHECKPOINT_UPDATE = 20L;
        private static final long TERMINATION_MARKER = 20L;
        private static final long LIFECYCLE_DELIVERY = 30L;
        private static final long TRIGGER_EVENT_BASE = 30L;
        private static final long FATAL_TERMINATION_OVERHEAD = 100L;

        private static long scopeEntry(int depth) {
            return 50L + 10L * depth;
        }

        private static long patchAddOrReplace(long sizeCharge) {
            return 20L + sizeCharge;
        }

        private static long cascadeRouting(int scopeCount) {
            return 10L * scopeCount;
        }

        private static long emitEvent(long sizeCharge) {
            return 20L + sizeCharge;
        }

        private static long ceil100(long amount) {
            return (amount + 99L) / 100L;
        }

        private static int pointerDepth(String absolutePointer) {
            String normalized = PointerUtils.normalizePointer(absolutePointer);
            if ("/".equals(normalized)) {
                return 0;
            }
            int depth = 0;
            for (int i = 0; i < normalized.length(); i++) {
                if (normalized.charAt(i) == '/') {
                    depth++;
                }
            }
            return depth;
        }

        private static long updateDocumentBase(int changesetLength) {
            int length = Math.max(0, changesetLength);
            return 40L + 5L * length;
        }

        private static long documentSnapshot(String absolutePointer, long snapshotBytes) {
            return 8L + pointerDepth(absolutePointer) + ceil100(snapshotBytes);
        }
    }
}
