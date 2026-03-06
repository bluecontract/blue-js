package blue.language.snapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class PatchReport {

    private final List<String> appliedPaths;
    private final GeneralizationReport generalizationReport;

    public PatchReport(List<String> appliedPaths, GeneralizationReport generalizationReport) {
        if (appliedPaths == null || appliedPaths.isEmpty()) {
            this.appliedPaths = Collections.emptyList();
        } else {
            this.appliedPaths = Collections.unmodifiableList(new ArrayList<String>(appliedPaths));
        }
        this.generalizationReport = generalizationReport != null ? generalizationReport : GeneralizationReport.none();
    }

    public static PatchReport none() {
        return new PatchReport(Collections.<String>emptyList(), GeneralizationReport.none());
    }

    public List<String> appliedPaths() {
        return appliedPaths;
    }

    public GeneralizationReport generalizationReport() {
        return generalizationReport;
    }

    public boolean changed() {
        return !appliedPaths.isEmpty();
    }
}
