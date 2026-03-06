package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.types.TypeAlias;

@TypeAlias("Document Update Channel")
@TypeBlueId({
        "6H1iGrDAcqtFE1qv3iyMTj79jCZsMUMxsNUzqYSJNbyR",
        "Document Update Channel",
        "Core/Document Update Channel",
        "DocumentUpdateChannel"
})
public class DocumentUpdateChannel extends ChannelContract {

    private String path;

    public String getPath() {
        return path;
    }

    public DocumentUpdateChannel setPath(String path) {
        this.path = path;
        return this;
    }

    public DocumentUpdateChannel path(String path) {
        return setPath(path);
    }
}
