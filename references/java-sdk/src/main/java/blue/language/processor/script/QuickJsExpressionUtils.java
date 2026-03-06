package blue.language.processor.script;

import blue.language.model.Node;
import blue.language.processor.ProcessorGasSchedule;
import blue.language.processor.ProcessorExecutionContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.function.Consumer;

public final class QuickJsExpressionUtils {

    private static final Pattern STANDALONE_EXPRESSION_PATTERN = Pattern.compile("^\\$\\{([\\s\\S]*)}$");
    private static final Pattern SINGLE_EXPRESSION_PATTERN = Pattern.compile("\\$\\{([\\s\\S]+?)}");
    private static final Pattern TEMPLATE_EXPRESSION_PATTERN = Pattern.compile("\\$\\{([\\s\\S]+?)}");

    public interface PointerPredicate {
        boolean test(String pointer, Node node);
    }

    public static final class PathMatchOptions {
        private final boolean dot;
        private final boolean nocase;
        private final boolean noglobstar;

        public PathMatchOptions() {
            this(true, false, false);
        }

        public PathMatchOptions(boolean dot, boolean nocase, boolean noglobstar) {
            this.dot = dot;
            this.nocase = nocase;
            this.noglobstar = noglobstar;
        }

        public boolean dot() {
            return dot;
        }

        public boolean nocase() {
            return nocase;
        }

        public boolean noglobstar() {
            return noglobstar;
        }
    }

    private QuickJsExpressionUtils() {
    }

    public static boolean isExpression(Object value) {
        if (!(value instanceof String)) {
            return false;
        }
        String text = (String) value;
        if (!STANDALONE_EXPRESSION_PATTERN.matcher(text).matches()) {
            return false;
        }
        int first = text.indexOf("${");
        int last = text.lastIndexOf("${");
        return first >= 0 && first == last;
    }

    public static boolean containsExpression(Object value) {
        if (!(value instanceof String)) {
            return false;
        }
        String text = (String) value;
        if (STANDALONE_EXPRESSION_PATTERN.matcher(text).matches()) {
            return true;
        }
        return SINGLE_EXPRESSION_PATTERN.matcher(text).find();
    }

    public static String extractExpressionContent(String expression) {
        if (!isExpression(expression)) {
            throw new IllegalArgumentException("Invalid expression: " + expression);
        }
        String text = expression.trim();
        return text.substring(2, text.length() - 1);
    }

    public static PointerPredicate createPathPredicate(List<String> includePatterns, List<String> excludePatterns) {
        return createPathPredicate(includePatterns, excludePatterns, new PathMatchOptions());
    }

    public static PointerPredicate createPathPredicate(List<String> includePatterns,
                                                       List<String> excludePatterns,
                                                       PathMatchOptions options) {
        final List<String> includes = includePatterns == null || includePatterns.isEmpty()
                ? Collections.singletonList("/**")
                : includePatterns;
        final List<String> excludes = excludePatterns == null ? Collections.<String>emptyList() : excludePatterns;
        final PathMatchOptions effectiveOptions = options == null ? new PathMatchOptions() : options;
        return new PointerPredicate() {
            @Override
            public boolean test(String pointer, Node node) {
                String normalized = normalizePointer(pointer);
                boolean included = false;
                for (String pattern : includes) {
                    if (matchesPattern(normalized, pattern, effectiveOptions)) {
                        included = true;
                        break;
                    }
                }
                if (!included) {
                    return false;
                }
                for (String pattern : excludes) {
                    if (matchesPattern(normalized, pattern, effectiveOptions)) {
                        return false;
                    }
                }
                return true;
            }
        };
    }

    public static Node resolveExpressions(Node node,
                                          QuickJSEvaluator evaluator,
                                          Map<String, Object> bindings,
                                          ProcessorExecutionContext context,
                                          PointerPredicate shouldResolve,
                                          PointerPredicate shouldDescend) {
        return resolveExpressions(node, evaluator, bindings, context, shouldResolve, shouldDescend, new Consumer<java.math.BigInteger>() {
            @Override
            public void accept(java.math.BigInteger amount) {
                context.chargeWasmGas(amount);
            }
        });
    }

    public static Node resolveExpressions(Node node,
                                          QuickJSEvaluator evaluator,
                                          Map<String, Object> bindings,
                                          ProcessorExecutionContext context,
                                          PointerPredicate shouldResolve,
                                          PointerPredicate shouldDescend,
                                          Consumer<java.math.BigInteger> wasmGasConsumer) {
        if (node == null) {
            return null;
        }
        return resolveRecursive(node, "/", evaluator, bindings, context, shouldResolve, shouldDescend, wasmGasConsumer);
    }

    private static Node resolveRecursive(Node node,
                                         String pointer,
                                         QuickJSEvaluator evaluator,
                                         Map<String, Object> bindings,
                                         ProcessorExecutionContext context,
                                         PointerPredicate shouldResolve,
                                         PointerPredicate shouldDescend,
                                         Consumer<java.math.BigInteger> wasmGasConsumer) {
        Node cloned = node.clone();
        if (shouldDescend != null && !shouldDescend.test(pointer, cloned)) {
            return cloned;
        }
        Object value = cloned.getValue();
        if (shouldResolve == null || shouldResolve.test(pointer, cloned)) {
            if (isExpression(value)) {
                Object evaluated = evaluateQuickJsExpression(
                        evaluator,
                        extractExpressionContent(String.valueOf(value)),
                        bindings,
                        wasmGasConsumer);
                return toNode(evaluated);
            }
            if (containsExpression(value)) {
                String rendered = resolveTemplateString(
                        evaluator,
                        String.valueOf(value),
                        bindings,
                        wasmGasConsumer);
                return new Node().value(rendered);
            }
        }

        if (cloned.getProperties() != null) {
            for (Map.Entry<String, Node> entry : cloned.getProperties().entrySet()) {
                String childPointer = appendPointerSegment(pointer, escapeSegment(entry.getKey()));
                if (shouldDescend != null && !shouldDescend.test(childPointer, entry.getValue())) {
                    continue;
                }
                entry.setValue(resolveRecursive(entry.getValue(), childPointer, evaluator, bindings, context, shouldResolve, shouldDescend, wasmGasConsumer));
            }
        }
        if (cloned.getItems() != null) {
            List<Node> updatedItems = new ArrayList<>();
            List<Node> items = cloned.getItems();
            for (int i = 0; i < items.size(); i++) {
                Node child = items.get(i);
                String childPointer = appendPointerSegment(pointer, String.valueOf(i));
                if (shouldDescend != null && !shouldDescend.test(childPointer, child)) {
                    updatedItems.add(child);
                    continue;
                }
                updatedItems.add(resolveRecursive(child, childPointer, evaluator, bindings, context, shouldResolve, shouldDescend, wasmGasConsumer));
            }
            cloned.items(updatedItems);
        }
        return cloned;
    }

    public static Object evaluateQuickJsExpression(QuickJSEvaluator evaluator,
                                                   String code,
                                                   Map<String, Object> bindings,
                                                   Consumer<java.math.BigInteger> wasmGasConsumer) {
        String wrappedCode = "return (" + code + ");";
        try {
            ScriptRuntimeResult runtimeResult = evaluator.evaluate(
                    wrappedCode,
                    bindings,
                    ProcessorGasSchedule.DEFAULT_EXPRESSION_WASM_GAS_LIMIT);
            if (wasmGasConsumer != null && runtimeResult.wasmGasUsed() != null) {
                wasmGasConsumer.accept(runtimeResult.wasmGasUsed());
            }
            return runtimeResult.value();
        } catch (CodeBlockEvaluationError ex) {
            throw new CodeBlockEvaluationError(code, ex);
        }
    }

    public static String resolveTemplateString(QuickJSEvaluator evaluator,
                                               String template,
                                               Map<String, Object> bindings,
                                               Consumer<java.math.BigInteger> wasmGasConsumer) {
        Matcher matcher = TEMPLATE_EXPRESSION_PATTERN.matcher(template);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String expression = matcher.group(1);
            Object value = evaluateQuickJsExpression(evaluator, expression, bindings, wasmGasConsumer);
            String replacement = value == null ? "" : String.valueOf(value);
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    private static Node toNode(Object value) {
        if (value instanceof Node) {
            return ((Node) value).clone();
        }
        if (value instanceof Map) {
            Node node = new Node();
            @SuppressWarnings("unchecked")
            Map<Object, Object> map = (Map<Object, Object>) value;
            for (Map.Entry<Object, Object> entry : map.entrySet()) {
                if (entry.getKey() != null) {
                    node.properties(String.valueOf(entry.getKey()), toNode(entry.getValue()));
                }
            }
            return node;
        }
        if (value instanceof List) {
            @SuppressWarnings("unchecked")
            List<Object> list = (List<Object>) value;
            List<Node> items = new ArrayList<>();
            for (Object element : list) {
                items.add(toNode(element));
            }
            return new Node().items(items);
        }
        return new Node().value(value);
    }

    private static String escapeSegment(String segment) {
        return segment.replace("~", "~0").replace("/", "~1");
    }

    private static String appendPointerSegment(String pointer, String segment) {
        String normalized = normalizePointer(pointer);
        if ("/".equals(normalized)) {
            return "/" + segment;
        }
        return normalized + "/" + segment;
    }

    private static boolean matchesPattern(String pointer, String pattern, PathMatchOptions options) {
        String normalizedPattern = normalizePointer(pattern);
        String pointerToMatch = pointer;
        if (options.nocase()) {
            normalizedPattern = normalizedPattern.toLowerCase(java.util.Locale.ROOT);
            pointerToMatch = pointerToMatch.toLowerCase(java.util.Locale.ROOT);
        }
        List<String> expandedPatterns = new ArrayList<>();
        expandedPatterns.addAll(expandBraces(normalizedPattern));

        for (String expandedPattern : expandedPatterns) {
            String effectivePattern = options.noglobstar()
                    ? expandedPattern.replace("**", "*")
                    : expandedPattern;
            if (matchesSinglePattern(pointerToMatch, effectivePattern, options.dot())) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesSinglePattern(String pointerToMatch, String normalizedPattern, boolean dot) {
        String regexPattern = buildPatternRegex(normalizedPattern, dot, true);
        return pointerToMatch.matches(regexPattern);
    }

    private static String buildPatternRegex(String normalizedPattern, boolean dot, boolean anchored) {
        StringBuilder regex = new StringBuilder();
        if (anchored) {
            regex.append("^");
        }
        for (int i = 0; i < normalizedPattern.length(); i++) {
            char ch = normalizedPattern.charAt(i);
            boolean segmentStart = i == 0 || normalizedPattern.charAt(i - 1) == '/';
            if (ch == '\\' && i + 1 < normalizedPattern.length()) {
                char escaped = normalizedPattern.charAt(i + 1);
                regex.append(Pattern.quote(String.valueOf(escaped)));
                i++;
                continue;
            }
            if (isExtglobMarker(ch) && i + 1 < normalizedPattern.length() && normalizedPattern.charAt(i + 1) == '(') {
                int closingParenthesis = findClosingParenthesis(normalizedPattern, i + 1);
                if (closingParenthesis > i + 1) {
                    String body = normalizedPattern.substring(i + 2, closingParenthesis);
                    if (segmentStart && !dot) {
                        regex.append("(?!\\.)");
                    }
                    regex.append(toExtglobRegex(ch, body, dot));
                    i = closingParenthesis;
                    continue;
                }
            }
            if (ch == '*') {
                boolean isDoubleStar = (i + 1 < normalizedPattern.length() && normalizedPattern.charAt(i + 1) == '*');
                if (isDoubleStar) {
                    regex.append(dot ? ".*" : "(?:(?!\\.)[^/]+/)*(?:(?!\\.)[^/]*)?");
                    i++;
                    continue;
                }
                regex.append(segmentStart && !dot ? "(?!\\.)[^/]*" : "[^/]*");
                continue;
            }
            if (ch == '?') {
                regex.append(segmentStart && !dot ? "(?!\\.)[^/]" : "[^/]");
                continue;
            }
            if (ch == '[') {
                int closingBracket = findClosingBracket(normalizedPattern, i + 1);
                if (closingBracket > i + 1) {
                    String classBody = normalizedPattern.substring(i + 1, closingBracket);
                    if (segmentStart && !dot && !characterClassExplicitlyMatchesDot(classBody)) {
                        regex.append("(?!\\.)");
                    }
                    regex.append(toCharacterClassRegex(classBody));
                    i = closingBracket;
                    continue;
                }
            }
            if ("\\.[]{}()+-^$|".indexOf(ch) >= 0) {
                regex.append('\\');
            }
            regex.append(ch);
        }
        if (anchored) {
            regex.append("$");
        }
        return regex.toString();
    }

    private static boolean isExtglobMarker(char ch) {
        return ch == '@' || ch == '?' || ch == '+' || ch == '*' || ch == '!';
    }

    private static String toExtglobRegex(char marker, String body, boolean dot) {
        List<String> options = splitPipeOptions(body);
        List<String> optionRegexes = new ArrayList<>();
        for (String option : options) {
            optionRegexes.add(buildPatternRegex(option, dot, false));
        }
        if (optionRegexes.isEmpty()) {
            optionRegexes.add("");
        }
        String union = "(?:" + String.join("|", optionRegexes) + ")";
        switch (marker) {
            case '@':
                return union;
            case '?':
                return "(?:" + union + ")?";
            case '+':
                return "(?:" + union + ")+";
            case '*':
                return "(?:" + union + ")*";
            case '!':
                return "(?:(?!" + union + "(?:/|$))[^/]+)";
            default:
                return Pattern.quote(String.valueOf(marker) + "(" + body + ")");
        }
    }

    private static List<String> expandBraces(String pattern) {
        if (pattern == null || pattern.indexOf('{') < 0) {
            return Collections.singletonList(pattern);
        }
        int open = -1;
        int depth = 0;
        int bracketDepth = 0;
        boolean escaping = false;
        for (int i = 0; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (escaping) {
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                escaping = true;
                continue;
            }
            if (ch == '[') {
                bracketDepth++;
                continue;
            }
            if (ch == ']' && bracketDepth > 0) {
                bracketDepth--;
                continue;
            }
            if (bracketDepth > 0) {
                continue;
            }
            if (ch == '{') {
                if (depth == 0) {
                    open = i;
                }
                depth++;
            } else if (ch == '}') {
                if (depth == 0) {
                    continue;
                }
                depth--;
                if (depth == 0 && open >= 0) {
                    String prefix = pattern.substring(0, open);
                    String body = pattern.substring(open + 1, i);
                    String suffix = pattern.substring(i + 1);
                    List<String> expanded = new ArrayList<>();
                    for (String option : splitBraceOptions(body)) {
                        for (String expandedOption : expandBraces(option + suffix)) {
                            expanded.add(prefix + expandedOption);
                        }
                    }
                    return expanded;
                }
            }
        }
        return Collections.singletonList(pattern);
    }

    private static List<String> splitBraceOptions(String body) {
        List<String> options = new ArrayList<>();
        if (body == null || body.isEmpty()) {
            options.add("");
            return options;
        }
        List<String> rangeExpansion = expandBraceRange(body);
        if (rangeExpansion != null) {
            return rangeExpansion;
        }
        StringBuilder current = new StringBuilder();
        int braceDepth = 0;
        int parenDepth = 0;
        int bracketDepth = 0;
        boolean escaping = false;
        for (int i = 0; i < body.length(); i++) {
            char ch = body.charAt(i);
            if (escaping) {
                current.append(ch);
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                current.append(ch);
                escaping = true;
                continue;
            }
            if (ch == ',' && braceDepth == 0 && parenDepth == 0 && bracketDepth == 0) {
                options.add(current.toString());
                current.setLength(0);
                continue;
            }
            if (ch == '[') {
                bracketDepth++;
            } else if (ch == ']' && bracketDepth > 0) {
                bracketDepth--;
            } else if (bracketDepth == 0 && ch == '{') {
                braceDepth++;
            } else if (bracketDepth == 0 && ch == '}' && braceDepth > 0) {
                braceDepth--;
            } else if (bracketDepth == 0 && ch == '(') {
                parenDepth++;
            } else if (bracketDepth == 0 && ch == ')' && parenDepth > 0) {
                parenDepth--;
            }
            current.append(ch);
        }
        options.add(current.toString());
        return options;
    }

    private static List<String> expandBraceRange(String body) {
        if (body == null || body.indexOf(',') >= 0) {
            return null;
        }
        Matcher numericMatcher = Pattern.compile("^(-?(?:0|[1-9][0-9]*))\\.\\.(-?(?:0|[1-9][0-9]*))(?:\\.\\.(-?(?:0|[1-9][0-9]*)))?$").matcher(body);
        if (numericMatcher.matches()) {
            int left = Integer.parseInt(numericMatcher.group(1));
            int right = Integer.parseInt(numericMatcher.group(2));
            int step = parseBraceRangeStep(numericMatcher.group(3));
            if (step <= 0) {
                return null;
            }
            int direction = left <= right ? 1 : -1;
            List<String> expanded = new ArrayList<>();
            for (int value = left;
                 direction > 0 ? value <= right : value >= right;
                 value += direction * step) {
                expanded.add(String.valueOf(value));
            }
            return expanded;
        }
        Matcher alphaMatcher = Pattern.compile("^([A-Za-z])\\.\\.([A-Za-z])(?:\\.\\.(-?(?:0|[1-9][0-9]*)))?$").matcher(body);
        if (alphaMatcher.matches()) {
            char left = alphaMatcher.group(1).charAt(0);
            char right = alphaMatcher.group(2).charAt(0);
            int step = parseBraceRangeStep(alphaMatcher.group(3));
            if (step <= 0) {
                return null;
            }
            int direction = left <= right ? 1 : -1;
            List<String> expanded = new ArrayList<>();
            for (int value = left;
                 direction > 0 ? value <= right : value >= right;
                 value += direction * step) {
                expanded.add(String.valueOf((char) value));
            }
            return expanded;
        }
        return null;
    }

    private static int parseBraceRangeStep(String rawStep) {
        if (rawStep == null || rawStep.isEmpty()) {
            return 1;
        }
        int parsed = Integer.parseInt(rawStep);
        if (parsed == Integer.MIN_VALUE) {
            return -1;
        }
        return Math.abs(parsed);
    }

    private static int findClosingParenthesis(String pattern, int openIndex) {
        int depth = 0;
        int bracketDepth = 0;
        boolean escaping = false;
        for (int i = openIndex; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (escaping) {
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                escaping = true;
                continue;
            }
            if (ch == '[') {
                bracketDepth++;
                continue;
            }
            if (ch == ']' && bracketDepth > 0) {
                bracketDepth--;
                continue;
            }
            if (bracketDepth > 0) {
                continue;
            }
            if (ch == '(') {
                depth++;
                continue;
            }
            if (ch == ')') {
                depth--;
                if (depth == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static List<String> splitPipeOptions(String body) {
        List<String> options = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int parenDepth = 0;
        int braceDepth = 0;
        int bracketDepth = 0;
        boolean escaping = false;
        for (int i = 0; i < body.length(); i++) {
            char ch = body.charAt(i);
            if (escaping) {
                current.append(ch);
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                current.append(ch);
                escaping = true;
                continue;
            }
            if (ch == '|' && parenDepth == 0 && braceDepth == 0 && bracketDepth == 0) {
                options.add(current.toString());
                current.setLength(0);
                continue;
            }
            if (ch == '[') {
                bracketDepth++;
            } else if (ch == ']' && bracketDepth > 0) {
                bracketDepth--;
            } else if (bracketDepth == 0 && ch == '(') {
                parenDepth++;
            } else if (bracketDepth == 0 && ch == ')' && parenDepth > 0) {
                parenDepth--;
            } else if (bracketDepth == 0 && ch == '{') {
                braceDepth++;
            } else if (bracketDepth == 0 && ch == '}' && braceDepth > 0) {
                braceDepth--;
            }
            current.append(ch);
        }
        options.add(current.toString());
        return options;
    }

    private static int findClosingBracket(String pattern, int start) {
        boolean escaping = false;
        char posixDelimiter = 0;
        for (int i = start; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (escaping) {
                escaping = false;
                continue;
            }
            if (ch == '\\') {
                escaping = true;
                continue;
            }
            if (posixDelimiter != 0) {
                if (ch == posixDelimiter && i + 1 < pattern.length() && pattern.charAt(i + 1) == ']') {
                    posixDelimiter = 0;
                    i++;
                }
                continue;
            }
            if (ch == '[' && i + 1 < pattern.length() && isPosixCharacterClassDelimiter(pattern.charAt(i + 1))) {
                posixDelimiter = pattern.charAt(i + 1);
                i++;
                continue;
            }
            if (ch == ']') {
                return i;
            }
        }
        return -1;
    }

    private static boolean isPosixCharacterClassDelimiter(char ch) {
        return ch == ':' || ch == '=' || ch == '.';
    }

    private static String toCharacterClassRegex(String classBody) {
        if (classBody == null || classBody.isEmpty()) {
            return "\\[\\]";
        }
        StringBuilder builder = new StringBuilder();
        builder.append('[');
        int index = 0;
        char first = classBody.charAt(0);
        if (first == '!' || first == '^') {
            builder.append('^');
            index = 1;
        }
        boolean escaping = false;
        for (int i = index; i < classBody.length(); i++) {
            char ch = classBody.charAt(i);
            if (escaping) {
                appendEscapedCharacterClassLiteral(builder, ch);
                escaping = false;
                continue;
            }
            PosixCharacterClassToken posixToken = tryParsePosixCharacterClass(classBody, i);
            if (posixToken != null) {
                builder.append(posixToken.regexToken);
                i = posixToken.endIndex;
                continue;
            }
            if (ch == '\\') {
                escaping = true;
                continue;
            }
            if (ch == '[' || ch == ']' || ch == '^') {
                builder.append('\\');
            }
            builder.append(ch);
        }
        if (escaping) {
            builder.append("\\\\");
        }
        builder.append(']');
        return builder.toString();
    }

    private static void appendEscapedCharacterClassLiteral(StringBuilder builder, char ch) {
        if (ch == '\\' || ch == '[' || ch == ']' || ch == '^' || ch == '-') {
            builder.append('\\');
        }
        builder.append(ch);
    }

    private static PosixCharacterClassToken tryParsePosixCharacterClass(String classBody, int startIndex) {
        if (classBody == null || startIndex < 0 || startIndex >= classBody.length()) {
            return null;
        }
        if (classBody.charAt(startIndex) != '[' || startIndex + 1 >= classBody.length()
                || classBody.charAt(startIndex + 1) != ':') {
            return null;
        }
        int tokenClose = classBody.indexOf(":]", startIndex + 2);
        if (tokenClose < 0) {
            return null;
        }
        String tokenName = classBody.substring(startIndex + 2, tokenClose).toLowerCase(java.util.Locale.ROOT);
        String mapped = mapPosixCharacterClass(tokenName);
        if (mapped == null) {
            return null;
        }
        return new PosixCharacterClassToken(mapped, tokenClose + 1);
    }

    private static String mapPosixCharacterClass(String tokenName) {
        if ("alnum".equals(tokenName)) {
            return "A-Za-z0-9";
        }
        if ("alpha".equals(tokenName)) {
            return "A-Za-z";
        }
        if ("blank".equals(tokenName)) {
            return " \\t";
        }
        if ("cntrl".equals(tokenName)) {
            return "\\x00-\\x1F\\x7F";
        }
        if ("digit".equals(tokenName)) {
            return "0-9";
        }
        if ("graph".equals(tokenName)) {
            return "!-~";
        }
        if ("lower".equals(tokenName)) {
            return "a-z";
        }
        if ("print".equals(tokenName)) {
            return " -~";
        }
        if ("punct".equals(tokenName)) {
            return "!-/:-@\\[-`\\{-~";
        }
        if ("space".equals(tokenName)) {
            return "\\s";
        }
        if ("upper".equals(tokenName)) {
            return "A-Z";
        }
        if ("word".equals(tokenName)) {
            return "\\w";
        }
        if ("xdigit".equals(tokenName)) {
            return "A-Fa-f0-9";
        }
        return null;
    }

    private static final class PosixCharacterClassToken {
        private final String regexToken;
        private final int endIndex;

        private PosixCharacterClassToken(String regexToken, int endIndex) {
            this.regexToken = regexToken;
            this.endIndex = endIndex;
        }
    }

    private static boolean characterClassExplicitlyMatchesDot(String classBody) {
        if (classBody == null || classBody.isEmpty()) {
            return false;
        }
        char first = classBody.charAt(0);
        if (first == '!' || first == '^') {
            return false;
        }
        boolean escaping = false;
        for (int i = 0; i < classBody.length(); i++) {
            char ch = classBody.charAt(i);
            if (escaping) {
                escaping = false;
                if (ch == '.') {
                    return true;
                }
                continue;
            }
            if (ch == '\\') {
                escaping = true;
                continue;
            }
            if (ch == '.') {
                return true;
            }
        }
        return false;
    }

    private static String normalizePointer(String pointer) {
        if (pointer == null || pointer.trim().isEmpty()) {
            return "/";
        }
        String trimmed = pointer.trim();
        return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
    }
}
