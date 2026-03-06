package blue.language.processor.types;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

class ProcessorErrorsTest {

    @Test
    void capabilityFailureFactoryBuildsExpectedShape() {
        Object details = new Object();
        CapabilityFailureError error = ProcessorErrors.capabilityFailure("channel", "missing", details);
        assertEquals("CapabilityFailure", error.kind());
        assertEquals("channel", error.capability());
        assertEquals("missing", error.reason());
        assertSame(details, error.details());
    }

    @Test
    void boundaryViolationFactoryBuildsExpectedShape() {
        BoundaryViolationError error = ProcessorErrors.boundaryViolation("/scope/path", "outside boundary");
        assertEquals("BoundaryViolation", error.kind());
        assertEquals("/scope/path", error.pointer());
        assertEquals("outside boundary", error.reason());
    }

    @Test
    void runtimeFatalFactoryBuildsExpectedShape() {
        Exception cause = new RuntimeException("boom");
        RuntimeFatalError error = ProcessorErrors.runtimeFatal("fatal", cause);
        assertEquals("RuntimeFatal", error.kind());
        assertEquals("fatal", error.reason());
        assertSame(cause, error.cause());
    }

    @Test
    void invalidContractFactoryBuildsExpectedShape() {
        InvalidContractError error = ProcessorErrors.invalidContract("contract.id", "bad contract", "/contracts/a", "details");
        assertEquals("InvalidContract", error.kind());
        assertEquals("contract.id", error.contractId());
        assertEquals("bad contract", error.reason());
        assertEquals("/contracts/a", error.pointer());
        assertEquals("details", error.details());
    }

    @Test
    void illegalStateFactoryBuildsExpectedShape() {
        ProcessorIllegalStateError error = ProcessorErrors.illegalState("illegal");
        assertEquals("IllegalState", error.kind());
        assertEquals("illegal", error.reason());
    }

    @Test
    void unsupportedFactoryBuildsExpectedShape() {
        UnsupportedOpError error = ProcessorErrors.unsupported("UPSERT");
        assertEquals("UnsupportedOp", error.kind());
        assertEquals("UPSERT", error.operation());
        assertNull(error.reason());
    }
}
