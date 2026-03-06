package blue.language.processor.types;

/**
 * Marker interface for processor error payloads mirroring JS error shapes.
 */
public interface ProcessorError {
    String kind();
}
