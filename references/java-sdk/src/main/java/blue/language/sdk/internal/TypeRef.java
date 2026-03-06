package blue.language.sdk.internal;

import blue.language.model.Node;
import blue.language.model.TypeBlueId;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;

public final class TypeRef {

    private final String alias;
    private final String blueId;

    private TypeRef(String alias, String blueId) {
        this.alias = alias;
        this.blueId = blueId;
    }

    public static TypeRef alias(String alias) {
        return new TypeRef(alias, null);
    }

    public static TypeRef of(Class<?> typeClass) {
        if (typeClass == null) {
            throw new IllegalArgumentException("typeClass cannot be null");
        }

        String alias = findTypeAlias(typeClass);
        if (alias == null || alias.trim().isEmpty()) {
            alias = builtInAlias(typeClass);
        }
        if (alias == null || alias.trim().isEmpty()) {
            alias = typeClass.getSimpleName();
        }

        String blueId = findBlueId(typeClass);
        return new TypeRef(alias, blueId);
    }

    public String alias() {
        return alias;
    }

    public String blueId() {
        return blueId;
    }

    public Node asTypeNode() {
        Node typeNode = new Node();
        if (alias != null) {
            typeNode.value(alias);
        }
        if (blueId != null) {
            typeNode.blueId(blueId);
        }
        return typeNode.inlineValue(true);
    }

    private static String findBlueId(Class<?> typeClass) {
        TypeBlueId blueIdAnnotation = typeClass.getAnnotation(TypeBlueId.class);
        if (blueIdAnnotation == null) {
            return null;
        }
        String[] values = blueIdAnnotation.value();
        if (values != null && values.length > 0) {
            String first = values[0];
            if (first != null && !first.trim().isEmpty()) {
                return first.trim();
            }
        }
        String defaultValue = blueIdAnnotation.defaultValue();
        if (defaultValue != null && !defaultValue.trim().isEmpty()) {
            return defaultValue.trim();
        }
        return null;
    }

    private static String findTypeAlias(Class<?> typeClass) {
        for (Annotation annotation : typeClass.getAnnotations()) {
            Class<? extends Annotation> annotationType = annotation.annotationType();
            if (!annotationType.getSimpleName().equals("TypeAlias")) {
                continue;
            }
            try {
                Method valueMethod = annotationType.getMethod("value");
                Object raw = valueMethod.invoke(annotation);
                if (raw instanceof String) {
                    String alias = ((String) raw).trim();
                    if (!alias.isEmpty()) {
                        return alias;
                    }
                }
            } catch (Exception ignored) {
                // Ignore and continue searching.
            }
        }
        return null;
    }

    private static String builtInAlias(Class<?> typeClass) {
        if (typeClass == Integer.class || typeClass == int.class) {
            return TypeAliases.INTEGER;
        }
        if (typeClass == String.class) {
            return TypeAliases.TEXT;
        }
        return null;
    }
}
