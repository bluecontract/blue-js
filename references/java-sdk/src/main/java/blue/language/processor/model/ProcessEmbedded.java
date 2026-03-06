package blue.language.processor.model;

import blue.language.model.TypeBlueId;
import blue.language.processor.util.PointerUtils;
import blue.language.types.TypeAlias;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@TypeAlias("Process Embedded")
@TypeBlueId({
        "Hu4XkfvyXLSdfFNUwuXebEu3oJeWcMyhBTcRV9AQyKPC",
        "Process Embedded",
        "Core/Process Embedded",
        "ProcessEmbedded"
})
public class ProcessEmbedded extends MarkerContract {

    private final List<String> paths = new ArrayList<>();

    public List<String> getPaths() {
        return Collections.unmodifiableList(paths);
    }

    public ProcessEmbedded setPaths(List<String> newPaths) {
        List<String> normalizedPaths = new ArrayList<>();
        if (newPaths != null) {
            for (String path : newPaths) {
                String normalized = normalizePath(path);
                if (normalized != null) {
                    normalizedPaths.add(normalized);
                }
            }
        }
        paths.clear();
        paths.addAll(normalizedPaths);
        return this;
    }

    public ProcessEmbedded addPath(String path) {
        String normalized = normalizePath(path);
        if (normalized != null) {
            paths.add(normalized);
        }
        return this;
    }

    private String normalizePath(String path) {
        if (path == null) {
            return null;
        }
        String trimmed = path.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return PointerUtils.normalizeRequiredPointer(trimmed, "ProcessEmbedded path");
    }
}
