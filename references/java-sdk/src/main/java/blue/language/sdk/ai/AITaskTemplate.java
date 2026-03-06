package blue.language.sdk.ai;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class AITaskTemplate {

    private final String name;
    private final List<String> instructions;
    private final List<TypeReference> expectedResponses;
    private final List<NamedEventExpectation> expectedNamedEvents;

    public AITaskTemplate(String name,
                          List<String> instructions,
                          List<TypeReference> expectedResponses,
                          List<NamedEventExpectation> expectedNamedEvents) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("task name is required");
        }
        this.name = name.trim();
        this.instructions = immutableInstructions(instructions);
        this.expectedResponses = immutableExpectedResponses(expectedResponses);
        this.expectedNamedEvents = immutableExpectedNamedEvents(expectedNamedEvents);
    }

    public String name() {
        return name;
    }

    public List<String> instructions() {
        return instructions;
    }

    public List<TypeReference> expectedResponses() {
        return expectedResponses;
    }

    public List<NamedEventExpectation> expectedNamedEvents() {
        return expectedNamedEvents;
    }

    private static List<String> immutableInstructions(List<String> instructions) {
        List<String> result = new ArrayList<String>();
        if (instructions != null) {
            for (String instruction : instructions) {
                if (instruction == null) {
                    continue;
                }
                String normalized = instruction.trim();
                if (!normalized.isEmpty()) {
                    result.add(normalized);
                }
            }
        }
        return Collections.unmodifiableList(result);
    }

    private static List<TypeReference> immutableExpectedResponses(List<TypeReference> expectedResponses) {
        List<TypeReference> result = new ArrayList<TypeReference>();
        if (expectedResponses != null) {
            for (TypeReference expected : expectedResponses) {
                if (expected != null) {
                    result.add(expected);
                }
            }
        }
        return Collections.unmodifiableList(result);
    }

    private static List<NamedEventExpectation> immutableExpectedNamedEvents(
            List<NamedEventExpectation> expectedNamedEvents) {
        List<NamedEventExpectation> result = new ArrayList<NamedEventExpectation>();
        if (expectedNamedEvents != null) {
            for (NamedEventExpectation expected : expectedNamedEvents) {
                if (expected != null) {
                    result.add(expected);
                }
            }
        }
        return Collections.unmodifiableList(result);
    }
}
