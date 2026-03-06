package blue.language.processor;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.processor.model.ChannelContract;
import blue.language.processor.model.TestEvent;
import blue.language.processor.model.ChannelEventCheckpoint;
import blue.language.processor.util.ProcessorContractConstants;
import blue.language.processor.contracts.IncrementPropertyContractProcessor;
import blue.language.processor.contracts.NormalizingTestEventChannelProcessor;
import blue.language.processor.contracts.RecencyTestChannelProcessor;
import blue.language.processor.contracts.SetPropertyContractProcessor;
import blue.language.processor.contracts.SetPropertyOnEventContractProcessor;
import blue.language.processor.contracts.StaleBlockingTestEventChannelProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.processor.contracts.TerminateScopeContractProcessor;
import blue.language.processor.model.SetProperty;
import java.math.BigInteger;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertSame;
import static blue.language.processor.registry.processors.CompositeTimelineChannelProcessor.compositeCheckpointKey;

/**
 * Verifies checkpoint behaviour for the {@link ChannelRunner} in isolation.
 */
final class ChannelRunnerTest {

    @Test
    void skipsDuplicateEventsUsingCheckpoint() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);

        List<ContractBundle.ChannelBinding> bindings = bundle.channelsOfType(ChannelContract.class);
        ContractBundle.ChannelBinding channelBinding = bindings.get(0);

        Node event = blue.objectToNode(new TestEvent().eventId("evt-1").kind("original"));

        runner.runExternalChannel("/", bundle, channelBinding, event);

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(BigInteger.ONE, counterNode.getValue());
        assertNotNull(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT));

        runner.runExternalChannel("/", bundle, channelBinding, event);
        BigInteger afterDuplicate = (BigInteger) execution.runtime().document().getProperties().get("counter").getValue();
        assertEquals(BigInteger.ONE, afterDuplicate);

        Node secondEvent = blue.objectToNode(new TestEvent().eventId("evt-2").kind("original"));
        runner.runExternalChannel("/", bundle, channelBinding, secondEvent);
        BigInteger afterNewEvent = (BigInteger) execution.runtime().document().getProperties().get("counter").getValue();
        assertEquals(new BigInteger("2"), afterNewEvent);
    }

    @Test
    void runsHandlersInOrderAndPersistsCheckpointOnFirstDelivery() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  setA:\n" +
                "    channel: testChannel\n" +
                "    order: 0\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /a\n" +
                "    propertyValue: 1\n" +
                "  setB:\n" +
                "    channel: testChannel\n" +
                "    order: 1\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /b\n" +
                "    propertyValue: 2\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-first").kind("alpha")));

        assertEquals(new BigInteger("1"), execution.runtime().document().getProperties().get("a").getValue());
        assertEquals(new BigInteger("2"), execution.runtime().document().getProperties().get("b").getValue());
        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        assertEquals("evt-first", checkpoint.lastSignature(channelBinding.key()));
        assertNotNull(checkpoint.lastEvent(channelBinding.key()));
    }

    @Test
    void duplicateSignaturesSkipAllHandlersAcrossMultiHandlerChannels() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  incrementA:\n" +
                "    channel: testChannel\n" +
                "    order: 0\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n" +
                "  incrementB:\n" +
                "    channel: testChannel\n" +
                "    order: 1\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-dup")));
        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-dup")));

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(new BigInteger("2"), counterNode.getValue(),
                "Duplicate delivery should skip all handlers after first successful run");
    }

    @Test
    void skipsDuplicateEventsByEventIdEvenIfPayloadChanges() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);

        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        Node first = blue.objectToNode(new TestEvent().eventId("evt-1").kind("original"));
        Node sameIdDifferentPayload = blue.objectToNode(new TestEvent().eventId("evt-1").kind("mutated"));
        Node newId = blue.objectToNode(new TestEvent().eventId("evt-2").kind("mutated"));

        runner.runExternalChannel("/", bundle, channelBinding, first);
        runner.runExternalChannel("/", bundle, channelBinding, sameIdDifferentPayload);
        runner.runExternalChannel("/", bundle, channelBinding, sameIdDifferentPayload);
        runner.runExternalChannel("/", bundle, channelBinding, newId);

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(new BigInteger("2"), counterNode.getValue());
    }

    @Test
    void skipsDuplicateEventsByCanonicalPayloadWhenNoEventIdPresent() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);

        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        Node first = blue.objectToNode(new TestEvent().kind("original"));
        Node duplicate = blue.objectToNode(new TestEvent().kind("original"));
        Node different = blue.objectToNode(new TestEvent().kind("other"));

        runner.runExternalChannel("/", bundle, channelBinding, first);
        runner.runExternalChannel("/", bundle, channelBinding, duplicate);
        runner.runExternalChannel("/", bundle, channelBinding, different);

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(new BigInteger("2"), counterNode.getValue());
    }

    @Test
    void usesOriginalPayloadForCheckpointSignatureWhenChannelizedEventDiffers() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new NormalizingTestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().kind("alpha")));
        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().kind("beta")));

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(new BigInteger("2"), counterNode.getValue(),
                "Distinct external payloads must not be collapsed by channelized checkpoint signatures");

        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        Node storedEvent = checkpoint.lastEvent(channelBinding.key());
        assertNotNull(storedEvent);
        assertEquals("beta", String.valueOf(storedEvent.getProperties().get("kind").getValue()));
    }

    @Test
    void deliversChannelizedEventToHandlersAndCheckpoint() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new NormalizingTestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyOnEventContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  setFlag:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: SetPropertyOnEvent\n" +
                "    expectedKind: " + NormalizingTestEventChannelProcessor.NORMALIZED_KIND + "\n" +
                "    propertyKey: /flag\n" +
                "    propertyValue: 7\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        assertNull(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT));

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);

        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);
        Node event = blue.objectToNode(new TestEvent().eventId("evt-1").kind("original"));

        runner.runExternalChannel("/", bundle, channelBinding, event);

        assertEquals("original", String.valueOf(event.getProperties().get("kind").getValue()),
                "Channelized delivery must not mutate caller-owned external event node");
        Node flagNode = execution.runtime().document().getProperties().get("flag");
        assertNotNull(flagNode);
        assertEquals(7, ((Number) flagNode.getValue()).intValue());

        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        Node storedEvent = checkpoint.lastEvent(channelBinding.key());
        assertNotNull(storedEvent);
        Node kindNode = storedEvent.getProperties().get("kind");
        assertNotNull(kindNode);
        assertEquals("original", kindNode.getValue());

        event.properties("kind", new Node().value("mutated-after-delivery"));
        Node storedAfterMutation = checkpoint.lastEvent(channelBinding.key());
        assertNotNull(storedAfterMutation);
        assertEquals("original", storedAfterMutation.getProperties().get("kind").getValue(),
                "Checkpoint must keep an immutable snapshot of delivered external event");
    }

    @Test
    void skipsEventsWhenChannelProcessorMarksEventAsNotNewer() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new StaleBlockingTestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-1").kind("one")));
        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-2").kind("two")));

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(BigInteger.ONE, counterNode.getValue());
    }

    @Test
    void deliversCompositeChannelPerChildAndHonorsChildRecencyCheckpoints() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new RecencyTestChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  childA:\n" +
                "    type:\n" +
                "      blueId: RecencyTestChannel\n" +
                "    minDelta: 0\n" +
                "  childB:\n" +
                "    type:\n" +
                "      blueId: RecencyTestChannel\n" +
                "    minDelta: 5\n" +
                "  compositeChannel:\n" +
                "    type:\n" +
                "      blueId: Conversation/Composite Timeline Channel\n" +
                "    channels: [childA, childB]\n" +
                "  increment:\n" +
                "    channel: compositeChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding compositeBinding = bundle.channel("compositeChannel");
        assertNotNull(compositeBinding);
        ContractBundle.ChannelBinding childA = bundle.channel("childA");
        ContractBundle.ChannelBinding childB = bundle.channel("childB");
        assertNotNull(childA);
        assertNotNull(childB);
        assertSame(blue.language.processor.model.RecencyTestChannel.class, childA.contract().getClass());
        assertSame(blue.language.processor.model.RecencyTestChannel.class, childB.contract().getClass());

        runner.runExternalChannel("/", bundle, compositeBinding,
                blue.yamlToNode("type:\n  blueId: TestEvent\nvalue: 5\n"));
        Node counterAfterFirst = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterAfterFirst);
        assertEquals(new BigInteger("2"), counterAfterFirst.getValue());

        runner.runExternalChannel("/", bundle, compositeBinding,
                blue.yamlToNode("type:\n  blueId: TestEvent\nvalue: 8\n"));
        Node counterAfterSecond = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterAfterSecond);
        assertEquals(new BigInteger("3"), counterAfterSecond.getValue());

        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        Node storedA = checkpoint.lastEvent(compositeCheckpointKey("compositeChannel", "childA"));
        Node storedB = checkpoint.lastEvent(compositeCheckpointKey("compositeChannel", "childB"));
        assertNotNull(storedA);
        assertNotNull(storedB);
        Node storedAValueNode = storedA.getProperties() != null && storedA.getProperties().get("value") != null
                ? storedA.getProperties().get("value")
                : storedA;
        Node storedBValueNode = storedB.getProperties() != null && storedB.getProperties().get("value") != null
                ? storedB.getProperties().get("value")
                : storedB;
        assertEquals(new BigInteger("8"), storedAValueNode.getValue());
        assertEquals(new BigInteger("5"), storedBValueNode.getValue());
    }

    @Test
    void allowsHandlersToRunWhenScopeInactiveOnlyIfAllowTerminatedWorkIsTrue() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        Node event = blue.objectToNode(new TestEvent().eventId("evt-allow-terminated").kind("any"));

        execution.markCutOff("/");
        runner.runHandlers("/", bundle, "testChannel", event, false);
        assertNull(execution.runtime().document().getProperties().get("counter"));

        runner.runHandlers("/", bundle, "testChannel", event, true);
        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNotNull(counterNode);
        assertEquals(BigInteger.ONE, counterNode.getValue());
    }

    @Test
    void doesNotProcessExternalEventsWhenScopeIsInactive() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");
        execution.markCutOff("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-inactive")));

        assertNull(execution.runtime().document().getProperties().get("counter"));
        assertNull(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT));
    }

    @Test
    void stopsProcessingHandlersWhenScopeBecomesInactiveMidRun() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new TerminateScopeContractProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  terminateFirst:\n" +
                "    channel: testChannel\n" +
                "    order: 0\n" +
                "    type:\n" +
                "      blueId: TerminateScope\n" +
                "    mode: graceful\n" +
                "    reason: stop now\n" +
                "  incrementSecond:\n" +
                "    channel: testChannel\n" +
                "    order: 1\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-stop")));

        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertNull(counterNode, "Second handler must not run once scope becomes inactive");
        Node terminatedMarker = ProcessorEngine.nodeAt(execution.runtime().document(), "/contracts/terminated");
        assertNotNull(terminatedMarker);
        assertEquals("graceful", String.valueOf(ProcessorEngine.nodeAt(execution.runtime().document(), "/contracts/terminated/cause").getValue()));
    }

    @Test
    void entersFatalTerminationWhenHandlerThrowsRuntimeException() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new ThrowingSetPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  badHandler:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /counter\n" +
                "    propertyValue: 1\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        assertThrows(RunTerminationException.class,
                () -> runner.runExternalChannel(
                        "/",
                        bundle,
                        channelBinding,
                        blue.objectToNode(new TestEvent().eventId("evt-fatal").kind("any"))));

        Node terminated = execution.runtime().document()
                .getProperties().get("contracts")
                .getProperties().get("terminated");
        assertNotNull(terminated);
        assertEquals("fatal", String.valueOf(terminated.getProperties().get("cause").getValue()));
        ChannelEventCheckpoint checkpoint = (ChannelEventCheckpoint) bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT);
        assertNotNull(checkpoint);
        assertNull(checkpoint.lastEvent(channelBinding.key()));
    }

    @Test
    void doesNothingWhenExternalChannelDoesNotMatch() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new IncrementPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  increment:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: IncrementProperty\n" +
                "    propertyKey: /counter\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        Node nonMatchingEvent = new Node()
                .type(new Node().blueId("OtherEvent"))
                .properties("eventId", new Node().value("evt-non-match"));
        runner.runExternalChannel("/", bundle, channelBinding, nonMatchingEvent);

        assertTrue(execution.runtime().document().getProperties().get("counter") == null
                        || execution.runtime().document().getProperties().get("counter").getValue() == null,
                "Counter should remain untouched when channel does not match");
        assertNull(bundle.marker(ProcessorContractConstants.KEY_CHECKPOINT));
    }

    @Test
    void skipsHandlersWhoseMatchesPredicateReturnsFalse() {
        Blue blue = new Blue();
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SelectiveSetPropertyContractProcessor());

        String yaml = "contracts:\n" +
                "  testChannel:\n" +
                "    type:\n" +
                "      blueId: TestEventChannel\n" +
                "  skipHandler:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /skip\n" +
                "    propertyValue: 1\n" +
                "  applyHandler:\n" +
                "    channel: testChannel\n" +
                "    type:\n" +
                "      blueId: SetProperty\n" +
                "    propertyKey: /counter\n" +
                "    propertyValue: 2\n";

        Node document = blue.yamlToNode(yaml);
        DocumentProcessor owner = blue.getDocumentProcessor();
        ProcessorEngine.Execution execution = new ProcessorEngine.Execution(owner, document.clone());
        execution.loadBundles("/");
        ContractBundle bundle = execution.bundleForScope("/");

        CheckpointManager checkpointManager = new CheckpointManager(execution.runtime(), ProcessorEngine::canonicalSignature);
        ChannelRunner runner = new ChannelRunner(owner, execution, execution.runtime(), checkpointManager);
        ContractBundle.ChannelBinding channelBinding = bundle.channelsOfType(ChannelContract.class).get(0);

        runner.runExternalChannel("/", bundle, channelBinding, blue.objectToNode(new TestEvent().eventId("evt-match").kind("any")));

        Node skipNode = execution.runtime().document().getProperties().get("skip");
        Node counterNode = execution.runtime().document().getProperties().get("counter");
        assertTrue(skipNode == null || skipNode.getValue() == null, "Skipped handler must not mutate document");
        assertNotNull(counterNode);
        assertEquals(new BigInteger("2"), counterNode.getValue());
    }

    private static final class ThrowingSetPropertyContractProcessor implements HandlerProcessor<SetProperty> {

        @Override
        public Class<SetProperty> contractType() {
            return SetProperty.class;
        }

        @Override
        public void execute(SetProperty contract, ProcessorExecutionContext context) {
            throw new RuntimeException("boom from handler");
        }
    }

    private static final class SelectiveSetPropertyContractProcessor implements HandlerProcessor<SetProperty> {

        @Override
        public Class<SetProperty> contractType() {
            return SetProperty.class;
        }

        @Override
        public boolean matches(SetProperty contract, ProcessorExecutionContext context) {
            return contract != null && !"/skip".equals(contract.getPropertyKey());
        }

        @Override
        public void execute(SetProperty contract, ProcessorExecutionContext context) {
            if (contract == null || contract.getPropertyKey() == null) {
                return;
            }
            context.applyPatch(blue.language.processor.model.JsonPatch.add(
                    contract.getPropertyKey(),
                    new Node().value(contract.getPropertyValue())));
        }
    }
}
