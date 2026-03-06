package blue.language.model;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NodeValueCoercionTest {

    @Test
    void valueObjectConvertsLongToBigInteger() {
        Node node = new Node().value(Long.MAX_VALUE);

        assertTrue(node.getValue() instanceof BigInteger);
        assertEquals(BigInteger.valueOf(Long.MAX_VALUE), node.getValue());
    }

    @Test
    void valueObjectConvertsFloatToBigDecimal() {
        Node node = new Node().value(1.5f);

        assertTrue(node.getValue() instanceof BigDecimal);
        assertEquals(BigDecimal.valueOf(1.5d), node.getValue());
    }

    @Test
    void valueObjectConvertsGenericNumberToBigInteger() {
        Node node = new Node().value(new AtomicLong(42L));

        assertTrue(node.getValue() instanceof BigInteger);
        assertEquals(BigInteger.valueOf(42L), node.getValue());
    }

    @Test
    void valueObjectRejectsNonFiniteFloatingPointNumbers() {
        assertThrows(IllegalArgumentException.class, () -> new Node().value(Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> new Node().value(Double.POSITIVE_INFINITY));
        assertThrows(IllegalArgumentException.class, () -> new Node().value(Float.NEGATIVE_INFINITY));
    }

    @Test
    void valuePrimitiveDoubleRejectsNonFiniteNumbers() {
        assertThrows(IllegalArgumentException.class, () -> new Node().value(Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> new Node().value(Double.NEGATIVE_INFINITY));
    }
}
