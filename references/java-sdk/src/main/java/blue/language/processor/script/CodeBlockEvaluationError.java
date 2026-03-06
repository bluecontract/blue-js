package blue.language.processor.script;

public class CodeBlockEvaluationError extends RuntimeException {

    private static final int MAX_SNIPPET_LENGTH = 120;
    private final String code;
    private final String runtimeErrorName;
    private final String runtimeErrorMessage;
    private final boolean runtimeStackAvailable;
    private final String runtimeStack;

    public CodeBlockEvaluationError(String code, Throwable cause) {
        super("Failed to evaluate code block: " + truncate(code), cause);
        this.code = code;
        if (cause instanceof ScriptRuntimeException) {
            ScriptRuntimeException runtimeException = (ScriptRuntimeException) cause;
            this.runtimeErrorName = runtimeException.errorName();
            this.runtimeErrorMessage = runtimeException.runtimeMessage();
            this.runtimeStackAvailable = runtimeException.stackAvailable();
            this.runtimeStack = runtimeException.runtimeStack();
        } else {
            this.runtimeErrorName = null;
            this.runtimeErrorMessage = null;
            this.runtimeStackAvailable = false;
            this.runtimeStack = null;
        }
    }

    public String code() {
        return code;
    }

    public String runtimeErrorName() {
        return runtimeErrorName;
    }

    public String runtimeErrorMessage() {
        return runtimeErrorMessage;
    }

    public boolean runtimeStackAvailable() {
        return runtimeStackAvailable;
    }

    public String runtimeStack() {
        return runtimeStack;
    }

    private static String truncate(String code) {
        if (code == null) {
            return "";
        }
        if (code.length() <= MAX_SNIPPET_LENGTH) {
            return code;
        }
        return code.substring(0, MAX_SNIPPET_LENGTH - 3) + "...";
    }
}
