package blue.language.sdk.structure;

import blue.language.model.Node;

public class DslStubGenerator {

    public static String generate(Node document) {
        return DslGenerator.generateInternal(document, false);
    }
}
