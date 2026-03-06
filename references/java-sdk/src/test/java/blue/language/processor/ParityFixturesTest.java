package blue.language.processor;

import blue.language.Blue;
import blue.language.NodeProvider;
import blue.language.model.Node;
import blue.language.processor.contracts.SetPropertyOnEventContractProcessor;
import blue.language.processor.contracts.TestEventChannelProcessor;
import blue.language.utils.UncheckedObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ParityFixturesTest {

    @Test
    void parityFixturesProduceExpectedDocumentAndEmissions() throws IOException {
        List<Path> fixtures = fixtureFiles();
        assertNotNull(fixtures, "Fixture file list must not be null");

        for (Path fixturePath : fixtures) {
            runFixture(fixturePath);
        }
    }

    @SuppressWarnings("unchecked")
    private void runFixture(Path fixturePath) throws IOException {
        Map<String, Object> fixture = readFixture(fixturePath);
        String fixtureName = stringValue(fixture.get("name"), fixturePath.getFileName().toString());
        String documentYaml = stringValue(fixture.get("document"), null);
        String eventYaml = stringValue(fixture.get("event"), null);
        List<String> eventYamls = listOfStrings(fixture.get("events"));
        Map<String, Object> expected = mapValue(fixture.get("expected"));
        Map<String, Object> expectedPaths = mapValue(expected.get("paths"));
        Map<String, Object> expectedTriggeredPathValues = mapValue(expected.get("triggeredPathValues"));
        Map<String, Object> expectedTriggeredPathValuesAny = mapValue(expected.get("triggeredPathValuesAny"));
        List<String> expectedPresentPaths = listOfStrings(expected.get("presentPaths"));
        List<String> expectedAbsentPaths = listOfStrings(expected.get("absentPaths"));
        List<String> expectedNotNullPaths = listOfStrings(expected.get("notNullPaths"));
        List<String> expectedTriggeredKinds = listOfStrings(expected.get("triggeredKinds"));
        int expectedTriggeredEvents = intValue(expected.get("triggeredEventsCount"), 0);
        boolean expectedCapabilityFailure = boolValue(expected.get("capabilityFailure"), false);
        String expectedFailureReasonContains = stringValue(expected.get("failureReasonContains"), null);
        Long expectedTotalGas = nullableLongValue(expected.get("totalGas"));
        Long expectedTotalGasMin = nullableLongValue(expected.get("totalGasMin"));
        Long expectedTotalGasMax = nullableLongValue(expected.get("totalGasMax"));
        boolean expectedInitFailure = boolValue(expected.get("initFailure"), false);
        String initFailureMessageContains = stringValue(expected.get("initFailureMessageContains"), null);

        Blue blue = createBlue(fixture);
        blue.registerContractProcessor(new TestEventChannelProcessor());
        blue.registerContractProcessor(new SetPropertyOnEventContractProcessor());

        Node document = blue.yamlToNode(documentYaml);
        if (expectedInitFailure) {
            Throwable thrown = assertThrows(RuntimeException.class, () -> blue.initializeDocument(document));
            if (initFailureMessageContains != null && !initFailureMessageContains.trim().isEmpty()) {
                String actualMessage = thrown.getMessage() != null ? thrown.getMessage() : String.valueOf(thrown);
                assertTrue(actualMessage.contains(initFailureMessageContains),
                        fixtureName + " expected init failure containing: " + initFailureMessageContains
                                + " but got: " + actualMessage);
            }
            return;
        }

        DocumentProcessingResult initialized = blue.initializeDocument(document);
        DocumentProcessingResult result = initialized;
        if (!eventYamls.isEmpty()) {
            for (String eventEntry : eventYamls) {
                if (eventEntry == null || eventEntry.trim().isEmpty()) {
                    continue;
                }
                Node event = blue.yamlToNode(eventEntry);
                result = blue.processDocument(result.document(), event);
            }
        } else if (eventYaml != null && !eventYaml.trim().isEmpty()) {
            Node event = blue.yamlToNode(eventYaml);
            result = blue.processDocument(initialized.document(), event);
        }

        for (Map.Entry<String, Object> entry : expectedPaths.entrySet()) {
            String pointer = entry.getKey();
            Node actualNode = ProcessorEngine.nodeAt(result.document(), pointer);
            assertNotNull(actualNode, fixtureName + " expected node missing at " + pointer);
            assertEquals(String.valueOf(entry.getValue()),
                    String.valueOf(actualNode.getValue()),
                    fixtureName + " value mismatch at " + pointer);
        }
        for (String pointer : expectedPresentPaths) {
            Node actualNode = ProcessorEngine.nodeAt(result.document(), pointer);
            assertNotNull(actualNode, fixtureName + " expected present node missing at " + pointer);
        }
        for (String pointer : expectedAbsentPaths) {
            Node actualNode = ProcessorEngine.nodeAt(result.document(), pointer);
            assertTrue(actualNode == null, fixtureName + " expected node to be absent at " + pointer);
        }
        for (String pointer : expectedNotNullPaths) {
            Node actualNode = ProcessorEngine.nodeAt(result.document(), pointer);
            assertNotNull(actualNode, fixtureName + " expected non-null node missing at " + pointer);
            assertNotNull(actualNode.getValue(), fixtureName + " expected non-null value at " + pointer);
        }
        assertEquals(expectedTriggeredEvents,
                result.triggeredEvents().size(),
                fixtureName + " unexpected triggered events count");
        for (Map.Entry<String, Object> entry : expectedTriggeredPathValues.entrySet()) {
            String key = entry.getKey();
            int separator = key != null ? key.indexOf(':') : -1;
            assertTrue(separator > 0,
                    fixtureName + " invalid triggeredPathValues key format, expected '<index>:<pointer>': " + key);
            int eventIndex;
            try {
                eventIndex = Integer.parseInt(key.substring(0, separator));
            } catch (NumberFormatException ex) {
                throw new AssertionError(fixtureName + " invalid triggeredPathValues event index: " + key, ex);
            }
            String pointer = key.substring(separator + 1);
            assertTrue(eventIndex >= 0 && eventIndex < result.triggeredEvents().size(),
                    fixtureName + " triggered event index out of range for key " + key);
            Node triggeredNode = result.triggeredEvents().get(eventIndex);
            Node actualNode = ProcessorEngine.nodeAt(triggeredNode, pointer);
            assertNotNull(actualNode,
                    fixtureName + " expected triggered node missing at " + key);
            assertEquals(String.valueOf(entry.getValue()),
                    String.valueOf(actualNode.getValue()),
                    fixtureName + " triggered value mismatch at " + key);
        }
        for (Map.Entry<String, Object> entry : expectedTriggeredPathValuesAny.entrySet()) {
            String pointer = entry.getKey();
            Object expectedValue = entry.getValue();
            boolean matched = false;
            for (Node emitted : result.triggeredEvents()) {
                Node actualNode = ProcessorEngine.nodeAt(emitted, pointer);
                if (actualNode == null) {
                    continue;
                }
                if (String.valueOf(expectedValue).equals(String.valueOf(actualNode.getValue()))) {
                    matched = true;
                    break;
                }
            }
            assertTrue(matched,
                    fixtureName + " expected triggered value not found at any event for pointer "
                            + pointer + " value " + expectedValue);
        }
        for (String expectedKind : expectedTriggeredKinds) {
            boolean present = false;
            for (Node emitted : result.triggeredEvents()) {
                if (emitted == null || emitted.getProperties() == null) {
                    continue;
                }
                Node kindNode = emitted.getProperties().get("kind");
                if (kindNode == null || kindNode.getValue() == null) {
                    continue;
                }
                if (expectedKind.equals(String.valueOf(kindNode.getValue()))) {
                    present = true;
                    break;
                }
            }
            assertTrue(present, fixtureName + " expected triggered kind not found: " + expectedKind);
        }
        assertEquals(expectedCapabilityFailure,
                result.capabilityFailure(),
                fixtureName + " unexpected capabilityFailure flag");
        if (expectedFailureReasonContains != null && !expectedFailureReasonContains.trim().isEmpty()) {
            String reason = result.failureReason() != null ? result.failureReason() : "";
            assertTrue(reason.contains(expectedFailureReasonContains),
                    fixtureName + " expected failure reason containing: " + expectedFailureReasonContains
                            + " but got: " + reason);
        }
        if (expectedTotalGas != null) {
            assertEquals(expectedTotalGas.longValue(),
                    result.totalGas(),
                    fixtureName + " unexpected totalGas value");
        }
        if (expectedTotalGasMin != null) {
            assertTrue(result.totalGas() >= expectedTotalGasMin.longValue(),
                    fixtureName + " totalGas below expected minimum: " + expectedTotalGasMin);
        }
        if (expectedTotalGasMax != null) {
            assertTrue(result.totalGas() <= expectedTotalGasMax.longValue(),
                    fixtureName + " totalGas above expected maximum: " + expectedTotalGasMax);
        }
    }

    private List<Path> fixtureFiles() throws IOException {
        Path fixtureDir = Paths.get("parity-fixtures");
        List<Path> paths = new ArrayList<>();
        try (java.util.stream.Stream<Path> stream = Files.list(fixtureDir)) {
            stream.filter(path -> path.getFileName().toString().endsWith(".yaml"))
                    .sorted(Comparator.comparing(Path::toString))
                    .forEach(paths::add);
        }
        return paths;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readFixture(Path fixturePath) throws IOException {
        try (InputStream input = Files.newInputStream(fixturePath)) {
            Object parsed = UncheckedObjectMapper.YAML_MAPPER.readValue(input, Map.class);
            if (parsed instanceof Map) {
                return new LinkedHashMap<>((Map<String, Object>) parsed);
            }
            return new LinkedHashMap<>();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        if (value instanceof Map) {
            return new LinkedHashMap<>((Map<String, Object>) value);
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<String> listOfStrings(Object value) {
        if (!(value instanceof List)) {
            return new ArrayList<>();
        }
        List<String> result = new ArrayList<>();
        for (Object item : (List<Object>) value) {
            if (item != null) {
                result.add(String.valueOf(item));
            }
        }
        return result;
    }

    private String stringValue(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        return String.valueOf(value);
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private boolean boolValue(Object value, boolean fallback) {
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            return Boolean.parseBoolean((String) value);
        }
        return fallback;
    }

    private Long nullableLongValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            String text = ((String) value).trim();
            if (text.isEmpty()) {
                return null;
            }
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Blue createBlue(Map<String, Object> fixture) {
        List<ProviderNodeEntry> providerEntries = listProviderEntries(fixture.get("providerNodes"));
        if (providerEntries.isEmpty()) {
            return new Blue();
        }
        final Map<String, List<Node>> nodesByBlueId = new HashMap<>();
        for (ProviderNodeEntry entry : providerEntries) {
            if (entry == null || entry.lookupBlueId == null || entry.definition == null) {
                continue;
            }
            String normalizedBlueId = entry.lookupBlueId.trim();
            List<Node> variants = nodesByBlueId.get(normalizedBlueId);
            if (variants == null) {
                variants = new ArrayList<>();
                nodesByBlueId.put(normalizedBlueId, variants);
            }
            variants.add(entry.definition.clone());
        }
        NodeProvider provider = new NodeProvider() {
            @Override
            public List<Node> fetchByBlueId(String blueId) {
                if (blueId == null || blueId.trim().isEmpty()) {
                    return Collections.emptyList();
                }
                List<Node> nodes = nodesByBlueId.get(blueId.trim());
                if (nodes == null || nodes.isEmpty()) {
                    return Collections.emptyList();
                }
                List<Node> cloned = new ArrayList<>();
                for (Node node : nodes) {
                    cloned.add(node.clone());
                }
                return cloned;
            }
        };
        return new Blue(provider);
    }

    @SuppressWarnings("unchecked")
    private List<ProviderNodeEntry> listProviderEntries(Object value) {
        if (!(value instanceof List)) {
            return new ArrayList<>();
        }
        List<ProviderNodeEntry> entries = new ArrayList<>();
        List<Object> raw = (List<Object>) value;
        for (Object item : raw) {
            if (item == null) {
                continue;
            }
            if (item instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) item;
                String explicitLookupBlueId = optionalString(map.get("lookupBlueId"));
                if (explicitLookupBlueId == null) {
                    explicitLookupBlueId = optionalString(map.get("blueId"));
                }
                Object definitionRaw = map.get("definition");
                String propertyBlueId = optionalString(map.get("propertyBlueId"));
                if (definitionRaw != null || propertyBlueId != null) {
                    Node definition = definitionRaw != null
                            ? UncheckedObjectMapper.JSON_MAPPER.convertValue(definitionRaw, Node.class)
                            : new Node();
                    if (definition == null) {
                        continue;
                    }
                    if (propertyBlueId != null) {
                        definition.properties("blueId", new Node().value(propertyBlueId));
                    }
                    String lookupBlueId = explicitLookupBlueId;
                    if ((lookupBlueId == null || lookupBlueId.trim().isEmpty())
                            && definition.getBlueId() != null
                            && !definition.getBlueId().trim().isEmpty()) {
                        lookupBlueId = definition.getBlueId().trim();
                    }
                    if (lookupBlueId == null || lookupBlueId.trim().isEmpty()) {
                        continue;
                    }
                    entries.add(new ProviderNodeEntry(lookupBlueId.trim(), definition));
                    continue;
                }
            }
            Node node = UncheckedObjectMapper.JSON_MAPPER.convertValue(item, Node.class);
            if (node == null || node.getBlueId() == null || node.getBlueId().trim().isEmpty()) {
                continue;
            }
            entries.add(new ProviderNodeEntry(node.getBlueId().trim(), node));
        }
        return entries;
    }

    private String optionalString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static final class ProviderNodeEntry {
        private final String lookupBlueId;
        private final Node definition;

        private ProviderNodeEntry(String lookupBlueId, Node definition) {
            this.lookupBlueId = lookupBlueId;
            this.definition = definition;
        }
    }
}
