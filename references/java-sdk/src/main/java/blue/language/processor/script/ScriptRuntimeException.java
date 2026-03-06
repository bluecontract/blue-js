package blue.language.processor.script;

public class ScriptRuntimeException extends RuntimeException {
    private final String errorName;
    private final String runtimeMessage;
    private final boolean stackAvailable;
    private final String runtimeStack;

    public ScriptRuntimeException(String message) {
        this(message, null, null, false, null);
    }

    public ScriptRuntimeException(String message, Throwable cause) {
        this(message, null, null, false, null, cause);
    }

    public ScriptRuntimeException(String message,
                                  String errorName,
                                  String runtimeMessage,
                                  boolean stackAvailable) {
        this(message, errorName, runtimeMessage, stackAvailable, null, null);
    }

    public ScriptRuntimeException(String message,
                                  String errorName,
                                  String runtimeMessage,
                                  boolean stackAvailable,
                                  String runtimeStack) {
        this(message, errorName, runtimeMessage, stackAvailable, runtimeStack, null);
    }

    public ScriptRuntimeException(String message,
                                  String errorName,
                                  String runtimeMessage,
                                  boolean stackAvailable,
                                  String runtimeStack,
                                  Throwable cause) {
        super(message, cause);
        this.errorName = errorName;
        this.runtimeMessage = runtimeMessage;
        this.stackAvailable = stackAvailable;
        this.runtimeStack = runtimeStack;
    }

    public String errorName() {
        return errorName;
    }

    public String runtimeMessage() {
        return runtimeMessage;
    }

    public boolean stackAvailable() {
        return stackAvailable;
    }

    public String runtimeStack() {
        return runtimeStack;
    }
}
