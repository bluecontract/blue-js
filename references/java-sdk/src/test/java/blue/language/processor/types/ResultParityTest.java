package blue.language.processor.types;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResultParityTest {

    @Test
    void createsOkResults() {
        Result<Integer, String> value = Result.ok(42);

        assertTrue(value.isOk());
        assertFalse(value.isErr());
        assertEquals(42, value.value().intValue());
    }

    @Test
    void createsErrResults() {
        Result<Integer, String> value = Result.err("nope");

        assertFalse(value.isOk());
        assertTrue(value.isErr());
        assertEquals("nope", value.error());
    }

    @Test
    void mapsOkResults() {
        Result<Integer, String> mapped = Result.<Integer, String>ok(21).map(new java.util.function.Function<Integer, Integer>() {
            @Override
            public Integer apply(Integer n) {
                return n * 2;
            }
        });
        assertTrue(mapped.isOk());
        assertEquals(42, mapped.value().intValue());
    }

    @Test
    void doesNotMapErrResults() {
        Result<Integer, String> original = Result.err("fail");
        Result<Integer, String> mapped = original.map(new java.util.function.Function<Integer, Integer>() {
            @Override
            public Integer apply(Integer n) {
                return n;
            }
        });

        assertSame(original, mapped);
    }

    @Test
    void mapsErrors() {
        Result<Integer, String> original = Result.err("fail");
        Result<Integer, Integer> mapped = original.mapErr(new java.util.function.Function<String, Integer>() {
            @Override
            public Integer apply(String reason) {
                return reason.length();
            }
        });
        assertTrue(mapped.isErr());
        assertEquals(4, mapped.error().intValue());
    }

    @Test
    void mapErrDoesNotRunOnOk() {
        Result<Integer, String> original = Result.ok(7);
        Result<Integer, Integer> mapped = original.mapErr(new java.util.function.Function<String, Integer>() {
            @Override
            public Integer apply(String reason) {
                return reason.length();
            }
        });
        assertSame(original, mapped);
    }

    @Test
    void chainsOkValues() {
        Result<Integer, String> chained = Result.<Integer, String>ok(21).andThen(new java.util.function.Function<Integer, Result<Integer, String>>() {
            @Override
            public Result<Integer, String> apply(Integer n) {
                return Result.ok(n * 2);
            }
        });
        assertTrue(chained.isOk());
        assertEquals(42, chained.value().intValue());
    }

    @Test
    void bailsEarlyOnErr() {
        Result<Integer, String> original = Result.err("fail");
        Result<Integer, String> chained = original.andThen(new java.util.function.Function<Integer, Result<Integer, String>>() {
            @Override
            public Result<Integer, String> apply(Integer n) {
                return Result.ok(42);
            }
        });

        assertSame(original, chained);
    }

    @Test
    void unwrapsWithFallbacks() {
        assertEquals(42, Result.<Integer, String>ok(42).unwrapOr(0).intValue());
        assertEquals(0, Result.<Integer, String>err("fail").unwrapOr(0).intValue());
    }

    @Test
    void unwrapsLazily() {
        Integer lazy = Result.<Integer, String>err("fail").unwrapOrElse(new java.util.function.Function<String, Integer>() {
            @Override
            public Integer apply(String reason) {
                return reason.length();
            }
        });
        assertEquals(4, lazy.intValue());
    }

    @Test
    void matchesResults() {
        Integer okMatch = Result.<Integer, String>ok(42).match(
                new java.util.function.Function<Integer, Integer>() {
                    @Override
                    public Integer apply(Integer value) {
                        return value;
                    }
                },
                new java.util.function.Function<String, Integer>() {
                    @Override
                    public Integer apply(String reason) {
                        return 0;
                    }
                });
        Integer errMatch = Result.<Integer, String>err("fail").match(
                new java.util.function.Function<Integer, Integer>() {
                    @Override
                    public Integer apply(Integer value) {
                        return 0;
                    }
                },
                new java.util.function.Function<String, Integer>() {
                    @Override
                    public Integer apply(String reason) {
                        return reason.length();
                    }
                });

        assertEquals(42, okMatch.intValue());
        assertEquals(4, errMatch.intValue());
    }
}
