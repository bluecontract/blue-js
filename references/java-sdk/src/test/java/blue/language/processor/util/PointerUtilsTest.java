package blue.language.processor.util;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PointerUtilsTest {

    @Test
    void relativizePointerRequiresSegmentBoundaryForScopePrefix() {
        assertEquals("/foobar/value", PointerUtils.relativizePointer("/foo", "/foobar/value"));
    }

    @Test
    void relativizePointerReturnsDescendantSuffixWhenInsideScope() {
        assertEquals("/bar/baz", PointerUtils.relativizePointer("/foo", "/foo/bar/baz"));
        assertEquals("/", PointerUtils.relativizePointer("/foo", "/foo"));
    }

    @Test
    void relativizePointerKeepsAbsoluteWhenScopeIsSameLengthButDifferent() {
        assertEquals("/bar", PointerUtils.relativizePointer("/foo", "/bar"));
    }

    @Test
    void relativizePointerPreservesTrailingEmptyDescendantAbsolutePath() {
        assertEquals("/foo/", PointerUtils.relativizePointer("/foo", "/foo/"));
    }

    @Test
    void relativizePointerKeepsNestedEmptySegmentsRelative() {
        assertEquals("//", PointerUtils.relativizePointer("/scope", "/scope//"));
        assertEquals("/a//", PointerUtils.relativizePointer("/scope", "/scope/a//"));
    }

    @Test
    void normalizePointerRejectsMalformedEscapes() {
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizePointer("/x~"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizePointer("/x~2"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizePointer("x~"));
    }

    @Test
    void normalizeRequiredPointerRejectsMissingPathAndNormalizesValidPointer() {
        assertEquals("/scope", PointerUtils.normalizeRequiredPointer("/scope", "Patch path"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizeRequiredPointer(null, "Patch path"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizeRequiredPointer("", "Patch path"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.normalizeRequiredPointer("scope", "Patch path"));
    }

    @Test
    void normalizePointerAddsLeadingSlashForNonPointerPaths() {
        assertEquals("/x", PointerUtils.normalizePointer("x"));
        assertEquals("/scope", PointerUtils.normalizeScope("scope"));
    }

    @Test
    void resolvePointerRejectsMalformedEscapes() {
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.resolvePointer("/scope", "/x~"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.resolvePointer("/scope", "/x~2"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.resolvePointer("/scope", "x~"));
    }

    @Test
    void resolvePointerTreatsNullAndEmptyAsRootWithinScope() {
        assertEquals("/scope", PointerUtils.resolvePointer("/scope", null));
        assertEquals("/scope", PointerUtils.resolvePointer("/scope", ""));
        assertEquals("/x", PointerUtils.resolvePointer(null, "/x"));
    }

    @Test
    void relativizePointerRejectsMalformedEscapes() {
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.relativizePointer("/scope", "/x~"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.relativizePointer("/scope", "/x~2"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.relativizePointer("/scope~", "/scope/value"));
    }

    @Test
    void splitPointerSegmentsUnescapesAndPreservesEmptySegments() {
        assertEquals(0, PointerUtils.splitPointerSegments("/").length);
        assertEquals("", PointerUtils.splitPointerSegments("//")[0]);
        assertEquals("a/b", PointerUtils.splitPointerSegments("/a~1b//")[0]);
        assertEquals("", PointerUtils.splitPointerSegments("/a~1b//")[1]);
        assertEquals("", PointerUtils.splitPointerSegments("/a~1b//")[2]);
    }

    @Test
    void splitPointerSegmentsListMirrorsArrayFormAndIsMutableCopy() {
        List<String> segments = PointerUtils.splitPointerSegmentsList("/a~1b//");
        assertEquals(Arrays.asList("a/b", "", ""), segments);
        segments.add("x");
        assertEquals(3, PointerUtils.splitPointerSegments("/a~1b//").length);
    }

    @Test
    void arrayIndexHelpersApplyStrictJsonPointerArrayRules() {
        assertEquals(0, PointerUtils.parseArrayIndex("0"));
        assertEquals(12, PointerUtils.parseArrayIndex("12"));
        assertEquals(-1, PointerUtils.parseArrayIndex("01"));
        assertEquals(-1, PointerUtils.parseArrayIndex("x"));
        assertEquals(-1, PointerUtils.parseArrayIndex("999999999999999999999"));
        assertEquals(4, PointerUtils.parseArrayIndexOrThrow("4", "/list/4"));
        assertThrows(IllegalStateException.class, () -> PointerUtils.parseArrayIndexOrThrow("01", "/list/01"));
        assertThrows(IllegalStateException.class,
                () -> PointerUtils.parseArrayIndexOrThrow("999999999999999999999", "/list/999999999999999999999"));
    }

    @Test
    void validatePointerEscapesSupportsRelativeSegmentsAndRejectsMalformedOnes() {
        PointerUtils.validatePointerEscapes("a~1b");
        PointerUtils.validatePointerEscapes("/a~1b");
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.validatePointerEscapes("a~"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.validatePointerEscapes("/a~2"));
    }

    @Test
    void escapePointerSegmentEncodesSlashAndTildeAndRejectsNull() {
        assertEquals("a~1b", PointerUtils.escapePointerSegment("a/b"));
        assertEquals("a~0b", PointerUtils.escapePointerSegment("a~b"));
        assertThrows(IllegalArgumentException.class, () -> PointerUtils.escapePointerSegment(null));
    }

    @Test
    void escapeRequiredPointerSegmentRejectsNullOrEmpty() {
        assertEquals("a~1b", PointerUtils.escapeRequiredPointerSegment("a/b", "segment"));
        assertThrows(IllegalArgumentException.class,
                () -> PointerUtils.escapeRequiredPointerSegment(null, "segment"));
        assertThrows(IllegalArgumentException.class,
                () -> PointerUtils.escapeRequiredPointerSegment("", "segment"));
    }

    @Test
    void pointerFromSegmentsBuildsEscapedPointersForArraysAndLists() {
        String[] segments = new String[]{"a/b", "", "c~d"};
        assertEquals("/a~1b//c~0d", PointerUtils.pointerFromSegments(segments, 3));
        assertEquals("/a~1b/", PointerUtils.pointerFromSegments(segments, 2));
        assertEquals("/", PointerUtils.pointerFromSegments(segments, 0));

        assertEquals("/a~1b//c~0d", PointerUtils.pointerFromSegments(Arrays.asList("a/b", "", "c~d"), 3));
        assertEquals("/", PointerUtils.pointerFromSegments(Arrays.asList("a/b"), -1));
    }

    @Test
    void ancestorPointersPreserveEscapedAndTrailingEmptySegments() {
        List<String> includeSelf = PointerUtils.ancestorPointers("/a~1b//c", true);
        assertEquals(Arrays.asList("/a~1b//c", "/a~1b/", "/a~1b", "/"), includeSelf);

        List<String> parentsOnly = PointerUtils.ancestorPointers("/a~1b//c", false);
        assertEquals(Arrays.asList("/a~1b/", "/a~1b", "/"), parentsOnly);

        assertEquals(Arrays.asList("/"), PointerUtils.ancestorPointers("/", true));
        assertEquals(Arrays.asList("/"), PointerUtils.ancestorPointers("/", false));
    }

    @Test
    void appendPointerSegmentComposesEscapedChildPointers() {
        assertEquals("/a~1b", PointerUtils.appendPointerSegment("/", "a/b"));
        assertEquals("/scope/a~0b", PointerUtils.appendPointerSegment("/scope", "a~b"));
        assertEquals("/scope/value", PointerUtils.appendEscapedPointerSegment("/scope", "value"));
        assertThrows(IllegalArgumentException.class,
                () -> PointerUtils.appendEscapedPointerSegment("/scope", null));
    }

    @Test
    void stripSlashesNormalizesNullBlankAndTrimmedSlashWrappedValues() {
        assertEquals("", PointerUtils.stripSlashes(null));
        assertEquals("", PointerUtils.stripSlashes("   "));
        assertEquals("foo/bar", PointerUtils.stripSlashes(" /foo/bar/ "));
        assertEquals("foo", PointerUtils.stripSlashes("///foo///"));
    }

    @Test
    void joinRelativePointersBuildsNormalizedRelativePointers() {
        assertEquals("/foo/bar", PointerUtils.joinRelativePointers("foo", "bar"));
        assertEquals("/bar", PointerUtils.joinRelativePointers("", "bar"));
        assertEquals("/foo", PointerUtils.joinRelativePointers("foo", ""));
        assertEquals("/", PointerUtils.joinRelativePointers("", ""));
    }
}
