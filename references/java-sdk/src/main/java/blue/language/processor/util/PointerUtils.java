package blue.language.processor.util;

import java.util.List;
import java.util.ArrayList;

/**
 * Utility helpers for normalising and composing JSON Pointer / scope strings.
 */
public final class PointerUtils {

    private PointerUtils() {
    }

    public static String normalizeScope(String scopePath) {
        return normalizeOptionalPointer(scopePath);
    }

    public static String normalizePointer(String pointer) {
        return normalizeOptionalPointer(pointer);
    }

    public static String normalizeRequiredPointer(String pointer, String argumentName) {
        if (pointer == null || pointer.isEmpty()) {
            throw new IllegalArgumentException(argumentName + " must be a JSON pointer starting with '/': " + pointer);
        }
        if (pointer.charAt(0) != '/') {
            throw new IllegalArgumentException(argumentName + " must be a JSON pointer starting with '/': " + pointer);
        }
        validatePointerEscapes(pointer);
        return pointer;
    }

    public static String stripSlashes(String value) {
        if (value == null) {
            return "";
        }
        String stripped = value.trim();
        if (stripped.isEmpty()) {
            return "";
        }
        while (stripped.startsWith("/")) {
            stripped = stripped.substring(1);
        }
        while (stripped.endsWith("/")) {
            stripped = stripped.substring(0, stripped.length() - 1);
        }
        return stripped;
    }

    public static String joinRelativePointers(String base, String tail) {
        String basePart = stripSlashes(base);
        String tailPart = stripSlashes(tail);
        if (basePart.isEmpty() && tailPart.isEmpty()) {
            return "/";
        }
        if (basePart.isEmpty()) {
            return "/" + tailPart;
        }
        if (tailPart.isEmpty()) {
            return "/" + basePart;
        }
        return "/" + basePart + "/" + tailPart;
    }

    public static String[] splitPointerSegments(String pointer) {
        String normalized = normalizePointer(pointer);
        if ("/".equals(normalized)) {
            return new String[0];
        }
        String[] rawSegments = normalized.substring(1).split("/", -1);
        String[] decoded = new String[rawSegments.length];
        for (int i = 0; i < rawSegments.length; i++) {
            decoded[i] = unescapePointerSegment(rawSegments[i]);
        }
        return decoded;
    }

    public static List<String> splitPointerSegmentsList(String pointer) {
        String[] segments = splitPointerSegments(pointer);
        List<String> list = new ArrayList<String>(segments.length);
        for (String segment : segments) {
            list.add(segment);
        }
        return list;
    }

    public static String unescapePointerSegment(String segment) {
        if (segment == null || segment.isEmpty()) {
            return segment;
        }
        StringBuilder decoded = new StringBuilder(segment.length());
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            if (c != '~') {
                decoded.append(c);
                continue;
            }
            if (i + 1 >= segment.length()) {
                throw new IllegalArgumentException("Invalid JSON pointer escape in segment: " + segment);
            }
            char next = segment.charAt(++i);
            if (next == '0') {
                decoded.append('~');
            } else if (next == '1') {
                decoded.append('/');
            } else {
                throw new IllegalArgumentException("Invalid JSON pointer escape in segment: " + segment);
            }
        }
        return decoded.toString();
    }

    public static String escapePointerSegment(String segment) {
        if (segment == null) {
            throw new IllegalArgumentException("JSON pointer segment cannot be null");
        }
        return segment.replace("~", "~0").replace("/", "~1");
    }

    public static String escapeRequiredPointerSegment(String segment, String argumentName) {
        if (segment == null || segment.isEmpty()) {
            throw new IllegalArgumentException(argumentName + " cannot be null or empty");
        }
        return escapePointerSegment(segment);
    }

    public static boolean isArrayIndexSegment(String segment) {
        if (segment == null || segment.isEmpty()) {
            return false;
        }
        for (int i = 0; i < segment.length(); i++) {
            char c = segment.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return "0".equals(segment) || segment.charAt(0) != '0';
    }

    public static int parseArrayIndex(String segment) {
        if (!isArrayIndexSegment(segment)) {
            return -1;
        }
        try {
            return Integer.parseInt(segment);
        } catch (NumberFormatException ex) {
            return -1;
        }
    }

    public static int parseArrayIndexOrThrow(String segment, String path) {
        int index = parseArrayIndex(segment);
        if (index < 0) {
            throw new IllegalStateException("Expected numeric array index in path: " + path);
        }
        return index;
    }

    public static String pointerFromSegments(String[] segments, int length) {
        if (segments == null || length <= 0) {
            return "/";
        }
        int limit = Math.min(length, segments.length);
        if (limit <= 0) {
            return "/";
        }
        StringBuilder pointer = new StringBuilder();
        for (int i = 0; i < limit; i++) {
            pointer.append('/');
            String segment = segments[i];
            if (segment != null) {
                pointer.append(escapePointerSegment(segment));
            }
        }
        return pointer.toString();
    }

    public static String pointerFromSegments(List<String> segments, int length) {
        if (segments == null || length <= 0) {
            return "/";
        }
        int limit = Math.min(length, segments.size());
        if (limit <= 0) {
            return "/";
        }
        StringBuilder pointer = new StringBuilder();
        for (int i = 0; i < limit; i++) {
            pointer.append('/');
            String segment = segments.get(i);
            if (segment != null) {
                pointer.append(escapePointerSegment(segment));
            }
        }
        return pointer.toString();
    }

    public static List<String> ancestorPointers(String pointer, boolean includeSelf) {
        String[] segments = splitPointerSegments(pointer);
        List<String> pointers = new ArrayList<String>();
        if (segments.length == 0) {
            pointers.add("/");
            return pointers;
        }

        int startLength = includeSelf ? segments.length : segments.length - 1;
        for (int length = startLength; length >= 0; length--) {
            pointers.add(pointerFromSegments(segments, length));
        }
        return pointers;
    }

    public static String appendEscapedPointerSegment(String pointer, String escapedSegment) {
        if (escapedSegment == null) {
            throw new IllegalArgumentException("Escaped JSON pointer segment cannot be null");
        }
        String normalizedPointer = normalizePointer(pointer);
        if ("/".equals(normalizedPointer)) {
            return "/" + escapedSegment;
        }
        return normalizedPointer + "/" + escapedSegment;
    }

    public static String appendPointerSegment(String pointer, String segment) {
        return appendEscapedPointerSegment(pointer, escapePointerSegment(segment));
    }

    public static String resolvePointer(String scopePath, String relativePointer) {
        String normalizedScope = normalizeScope(scopePath);
        String normalizedPointer = normalizePointer(relativePointer);
        if ("/".equals(normalizedScope)) {
            return normalizedPointer;
        }
        if ("/".equals(normalizedPointer)) {
            return normalizedScope;
        }
        return normalizedScope + normalizedPointer;
    }

    public static String relativizePointer(String scopePath, String absolutePath) {
        String normalizedScope = normalizeScope(scopePath);
        String normalizedAbsolute = normalizePointer(absolutePath);
        if ("/".equals(normalizedScope)) {
            return normalizedAbsolute;
        }
        if (normalizedAbsolute.equals(normalizedScope)) {
            return "/";
        }
        String prefix = normalizedScope + "/";
        if (!normalizedAbsolute.startsWith(prefix)) {
            return normalizedAbsolute;
        }
        String remainder = normalizedAbsolute.substring(normalizedScope.length());
        if ("/".equals(remainder)) {
            // Relative "/" already denotes scope root in processor APIs.
            // Preserve absolute path so trailing-empty descendants are not
            // collapsed into ambiguous root markers.
            return normalizedAbsolute;
        }
        return remainder;
    }

    public static void validatePointerEscapes(String pointer) {
        if (pointer == null || pointer.isEmpty()) {
            return;
        }
        int start = pointer.charAt(0) == '/' ? 1 : 0;
        for (int i = start; i < pointer.length(); i++) {
            char c = pointer.charAt(i);
            if (c != '~') {
                continue;
            }
            if (i + 1 >= pointer.length()) {
                throw new IllegalArgumentException("Invalid JSON pointer escape in: " + pointer);
            }
            char next = pointer.charAt(++i);
            if (next != '0' && next != '1') {
                throw new IllegalArgumentException("Invalid JSON pointer escape in: " + pointer);
            }
        }
    }

    private static String normalizeOptionalPointer(String pointer) {
        if (pointer == null || pointer.isEmpty()) {
            return "/";
        }
        String normalized = pointer.charAt(0) == '/' ? pointer : "/" + pointer;
        validatePointerEscapes(normalized);
        return normalized;
    }
}
