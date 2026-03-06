package blue.language.processor;

import blue.language.mapping.NodeToObjectConverter;
import blue.language.model.Node;
import blue.language.processor.model.Contract;
import blue.language.processor.model.MarkerContract;
import blue.language.utils.TypeClassResolver;
import java.util.Map;
import java.util.Objects;

/**
 * Facade over the processor engine; retains public API for Document processing.
 */
public class DocumentProcessor {

    private static final TypeClassResolver CONTRACT_TYPE_RESOLVER =
            new TypeClassResolver("blue.language.processor.model");

    private final ContractProcessorRegistry contractRegistry;
    private final NodeToObjectConverter contractConverter;
    private final ContractLoader contractLoader;
    private final TypeClassResolver contractTypeResolver;

    public DocumentProcessor() {
        this(ContractProcessorRegistryBuilder.create().registerDefaults().build(), CONTRACT_TYPE_RESOLVER);
    }

    public DocumentProcessor(ContractProcessorRegistry registry) {
        this(registry, CONTRACT_TYPE_RESOLVER);
    }

    public DocumentProcessor(ContractProcessorRegistry registry, TypeClassResolver resolver) {
        this.contractRegistry = Objects.requireNonNull(registry, "registry");
        this.contractTypeResolver = resolver != null ? resolver : CONTRACT_TYPE_RESOLVER;
        this.contractRegistry
                .nodeProvider(this.contractTypeResolver.nodeProvider())
                .typeClassResolver(this.contractTypeResolver);
        this.contractConverter = new NodeToObjectConverter(this.contractTypeResolver);
        this.contractLoader = new ContractLoader(contractRegistry, contractConverter);
    }

    private DocumentProcessor(Builder builder) {
        this(builder.contractRegistry, builder.typeClassResolver);
    }

    public DocumentProcessingResult initializeDocument(Node document) {
        return ProcessorEngine.initializeDocument(this, document);
    }

    public DocumentProcessingResult processDocument(Node document, Node event) {
        return ProcessorEngine.processDocument(this, document, event);
    }

    public boolean isInitialized(Node document) {
        return ProcessorEngine.isInitialized(this, document);
    }

    public DocumentProcessor registerContractProcessor(ContractProcessor<? extends Contract> processor) {
        contractRegistry.register(processor);
        return this;
    }

    public ContractProcessorRegistry getContractRegistry() {
        return contractRegistry;
    }

    ContractProcessorRegistry registry() {
        return contractRegistry;
    }

    NodeToObjectConverter contractConverter() {
        return contractConverter;
    }

    ContractLoader contractLoader() {
        return contractLoader;
    }

    public Map<String, MarkerContract> markersFor(Node scopeNode, String scopePath) {
        ContractBundle bundle = contractLoader.load(scopeNode, scopePath);
        return bundle.markers();
    }

    public static Builder builder() {
        return new Builder();
    }

    static final class Builder {
        private ContractProcessorRegistry contractRegistry = ContractProcessorRegistryBuilder.create().registerDefaults().build();
        private TypeClassResolver typeClassResolver = CONTRACT_TYPE_RESOLVER;

        public Builder withRegistry(ContractProcessorRegistry registry) {
            this.contractRegistry = Objects.requireNonNull(registry, "registry");
            return this;
        }

        public Builder withTypeClassResolver(TypeClassResolver resolver) {
            this.typeClassResolver = Objects.requireNonNull(resolver, "resolver");
            return this;
        }

        public DocumentProcessor build() {
            return new DocumentProcessor(this);
        }
    }
}
