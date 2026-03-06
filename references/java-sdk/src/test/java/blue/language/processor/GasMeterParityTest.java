package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.util.NodeCanonicalizer;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GasMeterParityTest {

    @Test
    void chargesInitializationAndScopeDepth() {
        GasMeter meter = new GasMeter();

        meter.chargeInitialization();
        meter.chargeScopeEntry("/child/grandchild");
        meter.chargeScopeEntry("nested/scope");

        assertEquals(1_140L, meter.totalGas());
    }

    @Test
    void chargesPatchAddOrReplaceProportionalToCanonicalSize() {
        GasMeter meter = new GasMeter();
        Node valueNode = new Node().properties("payload", new Node().properties("answer", new Node().value(42)));
        long expectedSizeCharge = (NodeCanonicalizer.canonicalSize(valueNode) + 99L) / 100L;

        meter.chargePatchAddOrReplace(valueNode);

        assertEquals(20L + expectedSizeCharge, meter.totalGas());
    }

    @Test
    void chargesEventEmissionAndCascadeRouting() {
        GasMeter meter = new GasMeter();
        Node event = new Node().properties("eventType", new Node().value("Lifecycle"))
                .properties("data", new Node().properties("id", new Node().value("evt-1")));
        long sizeCharge = (NodeCanonicalizer.canonicalSize(event) + 99L) / 100L;

        meter.chargeEmitEvent(event);
        meter.chargeCascadeRouting(3);
        meter.chargeCascadeRouting(0);

        assertEquals(20L + sizeCharge + 30L, meter.totalGas());
    }

    @Test
    void chargesTriggerEventBaseAndUpdateDocumentBase() {
        GasMeter meter = new GasMeter();

        meter.chargeTriggerEventBase();
        meter.chargeUpdateDocumentBase(0);
        meter.chargeUpdateDocumentBase(3);

        assertEquals(30L + 40L + 55L, meter.totalGas());
    }

    @Test
    void chargesDocumentSnapshotByPointerDepthAndPayloadSize() {
        GasMeter meter = new GasMeter();
        Node snapshot = new Node().properties("profile", new Node().properties("name", new Node().value("Ada")));
        long bytes = NodeCanonicalizer.canonicalSize(snapshot);
        long sizeCharge = (bytes + 99L) / 100L;

        meter.chargeDocumentSnapshot("/", snapshot);
        meter.chargeDocumentSnapshot("/a/b", null);

        long expected = (8L + 0L + sizeCharge) + (8L + 2L + 0L);
        assertEquals(expected, meter.totalGas());
    }

    @Test
    void chargesWasmFuelUsingScheduleConversion() {
        GasMeter meter = new GasMeter();

        meter.chargeWasmGas(BigInteger.valueOf(1_701L));
        meter.chargeWasmGas(3_400L);

        assertEquals(2L + 2L, meter.totalGas());
    }
}
