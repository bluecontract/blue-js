package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class UpdateDocumentStepExecutorIntegrationParityTest {

    @Test
    void appliesDocumentMutationsDuringInitializationWorkflows() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Update Document Workflow\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: SeedStatus\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: ADD\n" +
                "            path: /status\n" +
                "            val: created\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        assertEquals("created", result.document().getProperties().get("status").getValue());
    }

    @Test
    void usesPreviousStepResultsAndDocumentBinding() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Update Counter Workflow\n" +
                "counter: 5\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: Compute\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          return { increment: 4 };\n" +
                "      - name: Apply\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset:\n" +
                "          - op: REPLACE\n" +
                "            path: /counter\n" +
                "            val: \"${document('/counter') + steps.Compute.increment}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        assertEquals(new BigInteger("9"), result.document().getProperties().get("counter").getValue());
    }

    @Test
    void supportsExpressionChangesetsThatProduceMultiplePatches() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Update History Workflow\n" +
                "history: []\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: Apply\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset: \"${[{ op: 'REPLACE', path: '/status', val: 'ready' }, { op: 'ADD', path: '/history/-', val: 'booted' }]}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        assertEquals("ready", result.document().getProperties().get("status").getValue());
        assertEquals("booted", result.document().getProperties().get("history").getItems().get(0).getValue());
    }

    @Test
    void appliesChangesetsReturnedFromJavaScriptStepOutput() {
        Blue blue = new Blue();
        Node document = blue.yamlToNode("name: Changeset Step Output Workflow\n" +
                "contracts:\n" +
                "  life:\n" +
                "    type:\n" +
                "      blueId: Lifecycle Event Channel\n" +
                "  handler:\n" +
                "    type:\n" +
                "      blueId: Conversation/Sequential Workflow\n" +
                "    channel: life\n" +
                "    event:\n" +
                "      type:\n" +
                "        blueId: Document Processing Initiated\n" +
                "    steps:\n" +
                "      - name: Prepare\n" +
                "        type:\n" +
                "          blueId: Conversation/JavaScript Code\n" +
                "        code: |\n" +
                "          const changeset = [\n" +
                "            { op: 'add', path: '/test', val: 'test' },\n" +
                "            { op: 'add', path: '/test2', val: 'test2' }\n" +
                "          ];\n" +
                "          return { changeset };\n" +
                "      - name: Apply\n" +
                "        type:\n" +
                "          blueId: Conversation/Update Document\n" +
                "        changeset: \"${steps.Prepare.changeset}\"\n");

        DocumentProcessingResult result = blue.initializeDocument(document);

        assertFalse(result.capabilityFailure());
        assertEquals("test", result.document().getProperties().get("test").getValue());
        assertEquals("test2", result.document().getProperties().get("test2").getValue());
    }
}
