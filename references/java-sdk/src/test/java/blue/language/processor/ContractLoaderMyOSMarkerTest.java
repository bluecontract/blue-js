package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.DocumentAnchorsMarker;
import blue.language.processor.model.DocumentLinksMarker;
import blue.language.processor.model.MyOSParticipantsOrchestrationMarker;
import blue.language.processor.model.MyOSSessionInteractionMarker;
import blue.language.processor.model.MyOSWorkerAgencyMarker;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ContractLoaderMyOSMarkerTest {

    @Test
    void loadsBuiltInMyosMarkerContracts() {
        Blue blue = new Blue();
        ContractLoader loader = blue.getDocumentProcessor().contractLoader();
        Node scope = blue.yamlToNode("contracts:\n" +
                "  anchors:\n" +
                "    type:\n" +
                "      blueId: MyOS/Document Anchors\n" +
                "  links:\n" +
                "    type:\n" +
                "      blueId: MyOS/Document Links\n" +
                "  participants:\n" +
                "    type:\n" +
                "      blueId: MyOS/MyOS Participants Orchestration\n" +
                "  session:\n" +
                "    type:\n" +
                "      blueId: MyOS/MyOS Session Interaction\n" +
                "  worker:\n" +
                "    type:\n" +
                "      blueId: MyOS/MyOS Worker Agency\n");

        ContractBundle bundle = loader.load(scope, "/");

        assertTrue(bundle.marker("anchors") instanceof DocumentAnchorsMarker);
        assertTrue(bundle.marker("links") instanceof DocumentLinksMarker);
        assertTrue(bundle.marker("participants") instanceof MyOSParticipantsOrchestrationMarker);
        assertTrue(bundle.marker("session") instanceof MyOSSessionInteractionMarker);
        assertTrue(bundle.marker("worker") instanceof MyOSWorkerAgencyMarker);
    }
}
