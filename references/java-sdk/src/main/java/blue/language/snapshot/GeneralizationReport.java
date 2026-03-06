package blue.language.snapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class GeneralizationReport {

    private final List<String> generalizations;

    public GeneralizationReport(List<String> generalizations) {
        if (generalizations == null || generalizations.isEmpty()) {
            this.generalizations = Collections.emptyList();
        } else {
            this.generalizations = Collections.unmodifiableList(new ArrayList<String>(generalizations));
        }
    }

    public static GeneralizationReport none() {
        return new GeneralizationReport(Collections.<String>emptyList());
    }

    public List<String> generalizations() {
        return generalizations;
    }

    public boolean hasGeneralizations() {
        return !generalizations.isEmpty();
    }
}
