package blue.language.sdk;

import blue.language.model.Node;

public final class SimpleDocBuilder extends DocBuilder<SimpleDocBuilder> {

    private SimpleDocBuilder() {
        super();
    }

    private SimpleDocBuilder(Node existingDocument) {
        super(existingDocument);
    }

    public static SimpleDocBuilder doc() {
        return new SimpleDocBuilder();
    }

    public static SimpleDocBuilder edit(Node existingDocument) {
        return new SimpleDocBuilder(existingDocument);
    }

    public static SimpleDocBuilder from(Node existingDocument) {
        if (existingDocument == null) {
            throw new IllegalArgumentException("existing document is required");
        }
        return new SimpleDocBuilder(existingDocument.clone());
    }
}
