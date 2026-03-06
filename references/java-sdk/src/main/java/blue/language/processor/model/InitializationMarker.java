package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Processing Initialized Marker")
@TypeBlueId({
        "EVguxFmq5iFtMZaBQgHfjWDojaoesQ1vEXCQFZ59yL28",
        "Processing Initialized Marker",
        "Core/Processing Initialized Marker",
        "InitializationMarker"
})
public class InitializationMarker extends MarkerContract {

    private String documentId;

    public String getDocumentId() {
        return documentId;
    }

    public InitializationMarker setDocumentId(String documentId) {
        this.documentId = documentId;
        return this;
    }

    public InitializationMarker documentId(String documentId) {
        return setDocumentId(documentId);
    }
}
