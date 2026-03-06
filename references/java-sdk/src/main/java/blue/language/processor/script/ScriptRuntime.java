package blue.language.processor.script;

public interface ScriptRuntime extends AutoCloseable {

    ScriptRuntimeResult evaluate(ScriptRuntimeRequest request);

    @Override
    void close();
}
