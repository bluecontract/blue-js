package blue.language.utils.limits;

import blue.language.model.Node;
import blue.language.processor.util.PointerUtils;

import java.util.HashSet;
import java.util.Set;
import java.util.Stack;

/**
 * Supported features:
 * 1. Exact path matching (e.g., "/a/b/c")
 * 2. Single-level wildcards (e.g., "/a/{wildcard}/c")
 * 3. Maximum depth limitation
 */
public class PathLimits implements Limits {
    private final Set<String> allowedPaths;
    private final int maxDepth;
    private final Stack<String> currentPath;

    public PathLimits(Set<String> allowedPaths, int maxDepth) {
        this.allowedPaths = allowedPaths;
        this.maxDepth = maxDepth;
        this.currentPath = new Stack<>();
    }

    @Override
    public boolean shouldExtendPathSegment(String pathSegment, Node node) {
        if (currentPath.size() >= maxDepth) {
            return false;
        }

        String potentialPath = buildPotentialPath(pathSegment);
        return isAllowedPath(potentialPath);
    }

    @Override
    public boolean shouldMergePathSegment(String pathSegment, Node currentNode) {
        return shouldExtendPathSegment(pathSegment, currentNode);
    }

    private boolean isAllowedPath(String path) {
        for (String allowedPath : allowedPaths) {
            if (matchesAllowedPath(allowedPath, path)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesAllowedPath(String allowedPath, String path) {
        String[] allowedParts = PointerUtils.splitPointerSegments(allowedPath);
        String[] pathParts = PointerUtils.splitPointerSegments(path);

        if (pathParts.length > allowedParts.length) {
            return false;
        }

        for (int i = 0; i < pathParts.length; i++) {
            if (!allowedParts[i].equals("*") && !allowedParts[i].equals(pathParts[i])) {
                return false;
            }
        }

        return true;
    }

    @Override
    public void enterPathSegment(String pathSegment, Node noe) {
        String segment = pathSegment == null ? "" : pathSegment;
        if (segment.startsWith("/")) {
            PointerUtils.validatePointerEscapes(segment);
            currentPath.push(segment.substring(1));
            return;
        }
        if (segment.isEmpty() && currentPath.isEmpty()) {
            return;
        }
        currentPath.push(PointerUtils.escapePointerSegment(segment));
    }

    @Override
    public void exitPathSegment() {
        if (!currentPath.isEmpty()) {
            currentPath.pop();
        }
    }

    private String getCurrentFullPath() {
        return "/" + String.join("/", currentPath);
    }

    private String buildPotentialPath(String pathSegment) {
        String segment = pathSegment == null ? "" : pathSegment;
        if (segment.startsWith("/")) {
            return segment;
        }
        return PointerUtils.appendPointerSegment(getCurrentFullPath(), segment);
    }

    public static class Builder {
        private Set<String> allowedPaths = new HashSet<>();
        private int maxDepth = Integer.MAX_VALUE;

        public Builder addPath(String path) {
            allowedPaths.add(normalizeAndValidateAllowedPath(path));
            return this;
        }

        public Builder setMaxDepth(int maxDepth) {
            if (maxDepth < 0) {
                throw new IllegalArgumentException("Max depth cannot be negative: " + maxDepth);
            }
            this.maxDepth = maxDepth;
            return this;
        }

        public PathLimits build() {
            return new PathLimits(allowedPaths, maxDepth);
        }

        private String normalizeAndValidateAllowedPath(String path) {
            if (path == null) {
                throw new IllegalArgumentException("Allowed path cannot be null");
            }
            String normalized = path.trim();
            if (normalized.isEmpty()) {
                throw new IllegalArgumentException("Allowed path cannot be empty");
            }
            try {
                normalized = PointerUtils.normalizePointer(
                        normalized.startsWith("/") ? normalized : "/" + normalized);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Invalid JSON pointer escape in allowed path: " + normalized);
            }
            return normalized;
        }
    }

    public static PathLimits withMaxDepth(int maxDepth) {
        Builder builder = new PathLimits.Builder().setMaxDepth(maxDepth);
        if (maxDepth <= 0) {
            return builder.addPath("/").build();
        }
        StringBuilder wildcardPath = new StringBuilder();
        for (int i = 0; i < maxDepth; i++) {
            wildcardPath.append("/*");
        }
        return builder.addPath(wildcardPath.toString()).build();
    }

    public static PathLimits withSinglePath(String path) {
        return new PathLimits.Builder().addPath(path).build();
    }

    public static PathLimits fromNode(Node node) {
        return NodeToPathLimitsConverter.convert(node);
    }
}