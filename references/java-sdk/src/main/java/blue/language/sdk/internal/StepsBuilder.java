package blue.language.sdk.internal;

import blue.language.Blue;
import blue.language.model.Node;
import blue.language.sdk.AccessConfig;
import blue.language.sdk.AccessSteps;
import blue.language.sdk.AgencyConfig;
import blue.language.sdk.AgencySteps;
import blue.language.sdk.LinkedAccessConfig;
import blue.language.sdk.MyOsPermissions;
import blue.language.sdk.MyOsSteps;
import blue.language.sdk.ai.AIIntegrationConfig;
import blue.language.sdk.ai.AITaskTemplate;
import blue.language.sdk.ai.NamedEventExpectation;
import blue.language.sdk.ai.TypeReference;
import blue.language.types.common.NamedEvent;
import blue.language.types.conversation.DocumentBootstrapRequested;
import blue.language.types.payments.PaymentRequests;
import blue.language.types.payments.fields.AchPaymentFields;
import blue.language.types.payments.fields.CardPaymentFields;
import blue.language.types.payments.fields.CardTokenPaymentFields;
import blue.language.types.payments.fields.CreditLinePaymentFields;
import blue.language.types.payments.fields.CryptoPaymentFields;
import blue.language.types.payments.fields.LedgerPaymentFields;
import blue.language.types.payments.fields.SepaPaymentFields;
import blue.language.types.payments.fields.WirePaymentFields;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;

public final class StepsBuilder {

    private static final Blue BLUE = new Blue();

    private final List<Node> steps = new ArrayList<Node>();
    private final Map<String, AIIntegrationConfig> aiIntegrations;
    private final Map<String, AccessConfig> accessConfigs;
    private final Map<String, LinkedAccessConfig> linkedAccessConfigs;
    private final Map<String, AgencyConfig> agencyConfigs;

    public StepsBuilder() {
        this(null, null, null, null);
    }

    public StepsBuilder(Map<String, AIIntegrationConfig> aiIntegrations) {
        this(aiIntegrations, null, null, null);
    }

    public StepsBuilder(Map<String, AIIntegrationConfig> aiIntegrations,
                        Map<String, AccessConfig> accessConfigs,
                        Map<String, LinkedAccessConfig> linkedAccessConfigs,
                        Map<String, AgencyConfig> agencyConfigs) {
        this.aiIntegrations = new LinkedHashMap<String, AIIntegrationConfig>();
        this.accessConfigs = new LinkedHashMap<String, AccessConfig>();
        this.linkedAccessConfigs = new LinkedHashMap<String, LinkedAccessConfig>();
        this.agencyConfigs = new LinkedHashMap<String, AgencyConfig>();
        if (aiIntegrations != null) {
            for (Map.Entry<String, AIIntegrationConfig> entry : aiIntegrations.entrySet()) {
                String key = entry.getKey();
                AIIntegrationConfig value = entry.getValue();
                if (key == null || value == null) {
                    continue;
                }
                this.aiIntegrations.put(key.trim(), value);
            }
        }
        if (accessConfigs != null) {
            for (Map.Entry<String, AccessConfig> entry : accessConfigs.entrySet()) {
                String key = entry.getKey();
                AccessConfig value = entry.getValue();
                if (key == null || value == null) {
                    continue;
                }
                this.accessConfigs.put(key.trim(), value);
            }
        }
        if (linkedAccessConfigs != null) {
            for (Map.Entry<String, LinkedAccessConfig> entry : linkedAccessConfigs.entrySet()) {
                String key = entry.getKey();
                LinkedAccessConfig value = entry.getValue();
                if (key == null || value == null) {
                    continue;
                }
                this.linkedAccessConfigs.put(key.trim(), value);
            }
        }
        if (agencyConfigs != null) {
            for (Map.Entry<String, AgencyConfig> entry : agencyConfigs.entrySet()) {
                String key = entry.getKey();
                AgencyConfig value = entry.getValue();
                if (key == null || value == null) {
                    continue;
                }
                this.agencyConfigs.put(key.trim(), value);
            }
        }
    }

    public StepsBuilder jsRaw(String name, String code) {
        Node step = new Node().type(TypeAliases.CONVERSATION_JAVASCRIPT_CODE);
        if (name != null) {
            step.name(name);
        }
        step.properties("code", new Node().value(code));
        steps.add(step);
        return this;
    }

    public StepsBuilder updateDocument(String name, Consumer<ChangesetBuilder> customizer) {
        ChangesetBuilder changesetBuilder = new ChangesetBuilder();
        customizer.accept(changesetBuilder);

        Node step = new Node().type(TypeAliases.CONVERSATION_UPDATE_DOCUMENT);
        if (name != null) {
            step.name(name);
        }
        step.properties("changeset", new Node().items(changesetBuilder.build()));
        steps.add(step);
        return this;
    }

    public StepsBuilder updateDocumentFromExpression(String name, String expression) {
        Node step = new Node().type(TypeAliases.CONVERSATION_UPDATE_DOCUMENT);
        if (name != null) {
            step.name(name);
        }
        step.properties("changeset", new Node().value(expr(expression)));
        steps.add(step);
        return this;
    }

    public StepsBuilder triggerEvent(String name, Node event) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("step name is required");
        }
        if (event == null) {
            throw new IllegalArgumentException("event cannot be null");
        }
        Node step = new Node().type(TypeAliases.CONVERSATION_TRIGGER_EVENT);
        step.name(name.trim());
        step.properties("event", event);
        steps.add(step);
        return this;
    }

    public StepsBuilder emit(String name, Object typedEvent) {
        if (typedEvent == null) {
            throw new IllegalArgumentException("typedEvent cannot be null");
        }
        return triggerEvent(name, BLUE.objectToNode(typedEvent));
    }

    public StepsBuilder emitType(String name, Class<?> eventTypeClass) {
        return emitType(name, eventTypeClass, null);
    }

    public StepsBuilder emitType(String name, Class<?> eventTypeClass, Consumer<NodeObjectBuilder> payloadCustomizer) {
        if (eventTypeClass == null) {
            throw new IllegalArgumentException("eventTypeClass cannot be null");
        }
        Node event = new Node().type(TypeRef.of(eventTypeClass).asTypeNode());
        if (payloadCustomizer != null) {
            NodeObjectBuilder builder = NodeObjectBuilder.create();
            payloadCustomizer.accept(builder);
            Node payload = builder.build();
            if (payload.getProperties() != null) {
                for (Map.Entry<String, Node> entry : payload.getProperties().entrySet()) {
                    event.properties(entry.getKey(), entry.getValue());
                }
            }
        }
        return triggerEvent(name, event);
    }

    public StepsBuilder namedEvent(String name, String eventName, Consumer<NodeObjectBuilder> payloadCustomizer) {
        if (eventName == null || eventName.trim().isEmpty()) {
            throw new IllegalArgumentException("eventName cannot be blank");
        }
        Node event = new Node().type(TypeRef.of(NamedEvent.class).asTypeNode());
        event.properties("name", new Node().value(eventName.trim()));
        if (payloadCustomizer != null) {
            NodeObjectBuilder payloadBuilder = NodeObjectBuilder.create();
            payloadCustomizer.accept(payloadBuilder);
            event.properties("payload", payloadBuilder.build());
        }
        return triggerEvent(name, event);
    }

    public StepsBuilder namedEvent(String name, String eventName) {
        return namedEvent(name, eventName, null);
    }

    public StepsBuilder triggerPayment(String name,
                                       Class<?> paymentEventTypeClass,
                                       Consumer<PaymentRequestPayloadBuilder> payloadCustomizer) {
        return emitPaymentRequest(name, paymentEventTypeClass, payloadCustomizer);
    }

    public StepsBuilder triggerPayment(Class<?> paymentEventTypeClass,
                                       Consumer<PaymentRequestPayloadBuilder> payloadCustomizer) {
        return triggerPayment("TriggerPayment", paymentEventTypeClass, payloadCustomizer);
    }

    public StepsBuilder bootstrapDocument(String stepName,
                                          Node document,
                                          Map<String, String> channelBindings) {
        return bootstrapDocument(stepName, document, channelBindings, null);
    }

    public StepsBuilder bootstrapDocument(String stepName,
                                          Node document,
                                          Map<String, String> channelBindings,
                                          Consumer<BootstrapOptionsBuilder> options) {
        if (document == null) {
            throw new IllegalArgumentException("document cannot be null");
        }
        return emitType(stepName, DocumentBootstrapRequested.class, payload -> {
            payload.putNode("document", document);
            payload.putStringMap("channelBindings", channelBindings);
            applyBootstrapOptions(payload, options);
        });
    }

    public StepsBuilder bootstrapDocumentExpr(String stepName,
                                              String documentExpression,
                                              Map<String, String> channelBindings,
                                              Consumer<BootstrapOptionsBuilder> options) {
        if (documentExpression == null || documentExpression.trim().isEmpty()) {
            throw new IllegalArgumentException("documentExpression cannot be blank");
        }
        return emitType(stepName, DocumentBootstrapRequested.class, payload -> {
            payload.putExpression("document", documentExpression);
            payload.putStringMap("channelBindings", channelBindings);
            applyBootstrapOptions(payload, options);
        });
    }

    public StepsBuilder requestBackwardPayment(String name,
                                               Consumer<PaymentRequestPayloadBuilder> payloadCustomizer) {
        return emitPaymentRequest(name, PaymentRequests.BackwardPaymentRequested.class, payloadCustomizer);
    }

    public StepsBuilder requestBackwardPayment(Consumer<PaymentRequestPayloadBuilder> payloadCustomizer) {
        return requestBackwardPayment("RequestBackwardPayment", payloadCustomizer);
    }

    public StepsBuilder askAI(String aiName,
                              String stepName,
                              Consumer<AskAIBuilder> askCustomizer) {
        AskAIBuilder askBuilder = new AskAIBuilder(this, requireAiIntegration(aiName), stepName);
        if (askCustomizer != null) {
            askCustomizer.accept(askBuilder);
        }
        return askBuilder.build();
    }

    public StepsBuilder askAI(String aiName,
                              Consumer<AskAIBuilder> askCustomizer) {
        return askAI(aiName, "AskAI", askCustomizer);
    }

    public AISteps ai(String aiName) {
        return new AISteps(this, requireAiIntegration(aiName));
    }

    public AccessSteps access(String accessName) {
        if (accessName == null || accessName.trim().isEmpty()) {
            throw new IllegalArgumentException("access name is required");
        }
        AccessConfig config = accessConfigs.get(accessName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown access: '" + accessName
                    + "'. Define it with .access(\"" + accessName + "\")...done().");
        }
        return new AccessSteps(this, config);
    }

    public AgencySteps viaAgency(String agencyName) {
        if (agencyName == null || agencyName.trim().isEmpty()) {
            throw new IllegalArgumentException("agency name is required");
        }
        AgencyConfig config = agencyConfigs.get(agencyName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown agency: '" + agencyName
                    + "'. Define it with .agency(\"" + agencyName + "\")...done().");
        }
        return new AgencySteps(this, config);
    }

    public StepsBuilder replaceValue(String name, String path, Object value) {
        return updateDocument(name, changeset -> changeset.replaceValue(path, value));
    }

    public StepsBuilder replaceExpression(String name, String path, String expression) {
        return updateDocument(name, changeset -> changeset.replaceExpression(path, expression));
    }

    public StepsBuilder raw(Node step) {
        steps.add(step);
        return this;
    }

    public CaptureStepBuilder capture() {
        return new CaptureStepBuilder(this);
    }

    public <E> E ext(Function<StepsBuilder, E> extensionFactory) {
        if (extensionFactory == null) {
            throw new IllegalArgumentException("extensionFactory cannot be null");
        }
        E extension = extensionFactory.apply(this);
        if (extension == null) {
            throw new IllegalArgumentException("extensionFactory cannot return null");
        }
        return extension;
    }

    public MyOsSteps myOs() {
        return ext(steps -> new MyOsSteps(steps, "myOsAdminChannel"));
    }

    public MyOsSteps myOs(String adminChannelKey) {
        return ext(steps -> new MyOsSteps(steps, adminChannelKey));
    }

    private StepsBuilder emitPaymentRequest(String name,
                                            Class<?> paymentEventTypeClass,
                                            Consumer<PaymentRequestPayloadBuilder> payloadCustomizer) {
        Node event = new Node().type(TypeRef.of(paymentEventTypeClass).asTypeNode());
        PaymentRequestPayloadBuilder payloadBuilder = new PaymentRequestPayloadBuilder();
        if (payloadCustomizer != null) {
            payloadCustomizer.accept(payloadBuilder);
            Node payload = payloadBuilder.build();
            if (payload.getProperties() != null) {
                for (Map.Entry<String, Node> entry : payload.getProperties().entrySet()) {
                    event.properties(entry.getKey(), entry.getValue());
                }
            }
        }

        String processor = payloadBuilder.processor();
        if (processor == null || processor.trim().isEmpty()) {
            throw new IllegalArgumentException("triggerPayment requires non-empty processor field");
        }
        return triggerEvent(name, event);
    }

    private static void applyBootstrapOptions(NodeObjectBuilder payload,
                                              Consumer<BootstrapOptionsBuilder> options) {
        if (options == null) {
            return;
        }
        BootstrapOptionsBuilder bootstrapOptions = new BootstrapOptionsBuilder();
        options.accept(bootstrapOptions);
        bootstrapOptions.applyTo(payload);
    }

    private AIIntegrationConfig requireAiIntegration(String aiName) {
        if (aiName == null || aiName.trim().isEmpty()) {
            throw new IllegalArgumentException("ai name is required");
        }
        AIIntegrationConfig config = aiIntegrations.get(aiName.trim());
        if (config == null) {
            throw new IllegalArgumentException("Unknown AI integration: " + aiName);
        }
        return config;
    }

    private StepsBuilder emitCallOperationRequested(String stepName,
                                                    AIIntegrationConfig integration,
                                                    Node requestPayload) {
        return emitType(stepName, blue.language.types.myos.CallOperationRequested.class, payload -> payload
                .put("onBehalfOf", integration.permissionFromChannel())
                .put("targetSessionId", integration.sessionIdExpression())
                .put("operation", "provideInstructions")
                .putNode("request", requestPayload));
    }

    private static String escapeSingleQuoted(String text) {
        if (text == null) {
            return "";
        }
        return text
                .replace("\\", "\\\\")
                .replace("'", "\\'");
    }

    public Node subscriptionSpec(String subscriptionId) {
        Node subscription = new Node().properties(new LinkedHashMap<String, Node>());
        subscription.properties("id", new Node().value(subscriptionId));
        subscription.properties("events", new Node().items(new ArrayList<Node>()));
        return subscription;
    }

    List<Node> build() {
        return steps;
    }

    public static final class PaymentRequestPayloadBuilder {
        private final Node payload = new Node();
        private String processor;

        public PaymentRequestPayloadBuilder processor(String processor) {
            this.processor = processor;
            payload.properties("processor", new Node().value(processor));
            return this;
        }

        public PaymentRequestPayloadBuilder payer(String payerReference) {
            payload.properties("payer", new Node().value(payerReference));
            return this;
        }

        public PaymentRequestPayloadBuilder payer(Node payer) {
            payload.properties("payer", payer);
            return this;
        }

        public PaymentRequestPayloadBuilder payee(String payeeReference) {
            payload.properties("payee", new Node().value(payeeReference));
            return this;
        }

        public PaymentRequestPayloadBuilder payee(Node payee) {
            payload.properties("payee", payee);
            return this;
        }

        public PaymentRequestPayloadBuilder from(String fromReference) {
            payload.properties("from", new Node().value(fromReference));
            return this;
        }

        public PaymentRequestPayloadBuilder from(Node from) {
            payload.properties("from", from);
            return this;
        }

        public PaymentRequestPayloadBuilder to(String toReference) {
            payload.properties("to", new Node().value(toReference));
            return this;
        }

        public PaymentRequestPayloadBuilder to(Node to) {
            payload.properties("to", to);
            return this;
        }

        public PaymentRequestPayloadBuilder currency(String currency) {
            payload.properties("currency", new Node().value(currency));
            return this;
        }

        public PaymentRequestPayloadBuilder amountMinor(long amountMinor) {
            payload.properties("amountMinor", new Node().value(amountMinor));
            return this;
        }

        public PaymentRequestPayloadBuilder amountMinorExpression(String amountMinorExpression) {
            payload.properties("amountMinor", new Node().value(expr(amountMinorExpression)));
            return this;
        }

        public PaymentRequestPayloadBuilder attachPayNote(Node payNote) {
            payload.properties("attachedPayNote", payNote);
            return this;
        }

        public PaymentRequestPayloadBuilder reason(String reason) {
            payload.properties("reason", new Node().value(reason));
            return this;
        }

        public AchRailBuilder viaAch() {
            return new AchRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaAch(AchPaymentFields fields) {
            return rail(fields);
        }

        public SepaRailBuilder viaSepa() {
            return new SepaRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaSepa(SepaPaymentFields fields) {
            return rail(fields);
        }

        public WireRailBuilder viaWire() {
            return new WireRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaWire(WirePaymentFields fields) {
            return rail(fields);
        }

        public CardRailBuilder viaCard() {
            return new CardRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaCard(CardPaymentFields fields) {
            return rail(fields);
        }

        public CardTokenRailBuilder viaTokenizedCard() {
            return new CardTokenRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaTokenizedCard(CardTokenPaymentFields fields) {
            return rail(fields);
        }

        public CreditLineRailBuilder viaCreditLine() {
            return new CreditLineRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaCreditLine(CreditLinePaymentFields fields) {
            return rail(fields);
        }

        public LedgerRailBuilder viaLedger() {
            return new LedgerRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaLedger(LedgerPaymentFields fields) {
            return rail(fields);
        }

        public CryptoRailBuilder viaCrypto() {
            return new CryptoRailBuilder(this);
        }

        public PaymentRequestPayloadBuilder viaCrypto(CryptoPaymentFields fields) {
            return rail(fields);
        }

        public PaymentRequestPayloadBuilder rail(Object railFieldsBean) {
            if (railFieldsBean == null) {
                throw new IllegalArgumentException("railFieldsBean cannot be null");
            }
            Node railNode = BLUE.objectToNode(railFieldsBean);
            if (railNode.getProperties() == null) {
                return this;
            }
            for (Map.Entry<String, Node> entry : railNode.getProperties().entrySet()) {
                String key = entry.getKey();
                if ("type".equals(key)) {
                    continue;
                }
                if ("processor".equals(key)) {
                    throw new IllegalArgumentException("Use processor(...) to set processor");
                }
                payload.properties(key, entry.getValue());
            }
            return this;
        }

        public <E> E ext(Function<PaymentRequestPayloadBuilder, E> extensionFactory) {
            if (extensionFactory == null) {
                throw new IllegalArgumentException("extensionFactory cannot be null");
            }
            E extension = extensionFactory.apply(this);
            if (extension == null) {
                throw new IllegalArgumentException("extensionFactory cannot return null");
            }
            return extension;
        }

        public PaymentRequestPayloadBuilder putCustom(String key, Object value) {
            if ("processor".equals(key)) {
                throw new IllegalArgumentException("Use processor(...) to set processor");
            }
            if (value instanceof Node) {
                payload.properties(key, (Node) value);
            } else {
                payload.properties(key, new Node().value(value));
            }
            return this;
        }

        public PaymentRequestPayloadBuilder putCustomExpression(String key, String expression) {
            if ("processor".equals(key)) {
                throw new IllegalArgumentException("Use processor(...) to set processor");
            }
            payload.properties(key, new Node().value(expr(expression)));
            return this;
        }

        private Node build() {
            return payload;
        }

        private String processor() {
            return processor;
        }

        public static final class AchRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private AchRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public AchRailBuilder routingNumber(String value) {
                parent.putCustom("routingNumber", value);
                return this;
            }

            public AchRailBuilder accountNumber(String value) {
                parent.putCustom("accountNumber", value);
                return this;
            }

            public AchRailBuilder accountType(String value) {
                parent.putCustom("accountType", value);
                return this;
            }

            public AchRailBuilder network(String value) {
                parent.putCustom("network", value);
                return this;
            }

            public AchRailBuilder companyEntryDescription(String value) {
                parent.putCustom("companyEntryDescription", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class SepaRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private SepaRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public SepaRailBuilder ibanFrom(String value) {
                parent.putCustom("ibanFrom", value);
                return this;
            }

            public SepaRailBuilder ibanTo(String value) {
                parent.putCustom("ibanTo", value);
                return this;
            }

            public SepaRailBuilder bicTo(String value) {
                parent.putCustom("bicTo", value);
                return this;
            }

            public SepaRailBuilder remittanceInformation(String value) {
                parent.putCustom("remittanceInformation", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class WireRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private WireRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public WireRailBuilder bankSwift(String value) {
                parent.putCustom("bankSwift", value);
                return this;
            }

            public WireRailBuilder bankName(String value) {
                parent.putCustom("bankName", value);
                return this;
            }

            public WireRailBuilder accountNumber(String value) {
                parent.putCustom("accountNumber", value);
                return this;
            }

            public WireRailBuilder beneficiaryName(String value) {
                parent.putCustom("beneficiaryName", value);
                return this;
            }

            public WireRailBuilder beneficiaryAddress(String value) {
                parent.putCustom("beneficiaryAddress", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class CardRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private CardRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public CardRailBuilder cardOnFileRef(String value) {
                parent.putCustom("cardOnFileRef", value);
                return this;
            }

            public CardRailBuilder merchantDescriptor(String value) {
                parent.putCustom("merchantDescriptor", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class CardTokenRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private CardTokenRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public CardTokenRailBuilder networkToken(String value) {
                parent.putCustom("networkToken", value);
                return this;
            }

            public CardTokenRailBuilder tokenProvider(String value) {
                parent.putCustom("tokenProvider", value);
                return this;
            }

            public CardTokenRailBuilder cryptogram(String value) {
                parent.putCustom("cryptogram", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class CreditLineRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private CreditLineRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public CreditLineRailBuilder creditLineId(String value) {
                parent.putCustom("creditLineId", value);
                return this;
            }

            public CreditLineRailBuilder merchantAccountId(String value) {
                parent.putCustom("merchantAccountId", value);
                return this;
            }

            public CreditLineRailBuilder cardholderAccountId(String value) {
                parent.putCustom("cardholderAccountId", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class LedgerRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private LedgerRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public LedgerRailBuilder ledgerAccountFrom(String value) {
                parent.putCustom("ledgerAccountFrom", value);
                return this;
            }

            public LedgerRailBuilder ledgerAccountTo(String value) {
                parent.putCustom("ledgerAccountTo", value);
                return this;
            }

            public LedgerRailBuilder memo(String value) {
                parent.putCustom("memo", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }

        public static final class CryptoRailBuilder {
            private final PaymentRequestPayloadBuilder parent;

            private CryptoRailBuilder(PaymentRequestPayloadBuilder parent) {
                this.parent = parent;
            }

            public CryptoRailBuilder asset(String value) {
                parent.putCustom("asset", value);
                return this;
            }

            public CryptoRailBuilder chain(String value) {
                parent.putCustom("chain", value);
                return this;
            }

            public CryptoRailBuilder fromWalletRef(String value) {
                parent.putCustom("fromWalletRef", value);
                return this;
            }

            public CryptoRailBuilder toAddress(String value) {
                parent.putCustom("toAddress", value);
                return this;
            }

            public CryptoRailBuilder txPolicy(String value) {
                parent.putCustom("txPolicy", value);
                return this;
            }

            public PaymentRequestPayloadBuilder done() {
                return parent;
            }
        }
    }

    public static final class AskAIBuilder {
        private final StepsBuilder parent;
        private final AIIntegrationConfig integration;
        private final String stepName;
        private final PromptExpressionBuilder prompt = new PromptExpressionBuilder();
        private final List<TypeReference> inlineExpectedResponses = new ArrayList<TypeReference>();
        private final List<NamedEventExpectation> inlineNamedExpectedResponses = new ArrayList<NamedEventExpectation>();
        private String taskName;

        private AskAIBuilder(StepsBuilder parent, AIIntegrationConfig integration, String stepName) {
            this.parent = parent;
            this.integration = integration;
            this.stepName = stepName;
        }

        public AskAIBuilder task(String taskName) {
            if (taskName == null || taskName.trim().isEmpty()) {
                throw new IllegalArgumentException("taskName is required");
            }
            this.taskName = taskName.trim();
            return this;
        }

        public AskAIBuilder instruction(String text) {
            prompt.text(text);
            return this;
        }

        public AskAIBuilder expects(Class<?> eventTypeClass) {
            inlineExpectedResponses.add(TypeReference.of(eventTypeClass));
            return this;
        }

        public AskAIBuilder expects(Node eventTypeNode) {
            inlineExpectedResponses.add(TypeReference.of(eventTypeNode));
            return this;
        }

        public AskAIBuilder expectsNamed(String eventName) {
            inlineNamedExpectedResponses.add(NamedEventExpectation.named(eventName).build());
            return this;
        }

        public AskAIBuilder expectsNamed(String eventName,
                                         Consumer<NamedEventExpectation.Builder> fieldsCustomizer) {
            NamedEventExpectation.Builder builder = NamedEventExpectation.named(eventName);
            if (fieldsCustomizer != null) {
                fieldsCustomizer.accept(builder);
            }
            inlineNamedExpectedResponses.add(builder.build());
            return this;
        }

        public AskAIBuilder expectsNamed(String eventName, String... fieldNames) {
            NamedEventExpectation.Builder builder = NamedEventExpectation.named(eventName);
            if (fieldNames != null) {
                for (String fieldName : fieldNames) {
                    builder.field(fieldName);
                }
            }
            inlineNamedExpectedResponses.add(builder.build());
            return this;
        }

        @Deprecated
        public AskAIBuilder text(String value) {
            return instruction(value);
        }

        @Deprecated
        public AskAIBuilder expression(String expression) {
            prompt.expression(expression);
            return this;
        }

        private StepsBuilder build() {
            PromptExpressionBuilder merged = new PromptExpressionBuilder();
            List<TypeReference> mergedExpectedResponses = new ArrayList<TypeReference>();
            List<NamedEventExpectation> mergedNamedExpectedResponses =
                    new ArrayList<NamedEventExpectation>();

            if (taskName != null) {
                AITaskTemplate task = integration.task(taskName);
                if (task == null) {
                    throw new IllegalStateException("Unknown task '" + taskName
                            + "' for AI integration '" + integration.name() + "'");
                }
                for (String instruction : task.instructions()) {
                    merged.text(instruction);
                }
                mergedExpectedResponses.addAll(task.expectedResponses());
                mergedNamedExpectedResponses.addAll(task.expectedNamedEvents());
            }

            merged.append(prompt);
            mergedExpectedResponses.addAll(inlineExpectedResponses);
            mergedNamedExpectedResponses.addAll(inlineNamedExpectedResponses);

            if (merged.isEmpty()) {
                throw new IllegalStateException("askAI('" + integration.name() + "', '" + stepName
                        + "'): at least one instruction is required");
            }

            Node request = new Node().properties(new LinkedHashMap<String, Node>());
            request.properties("requester", new Node().value(integration.requesterId()));
            request.properties("instructions", new Node().value(expr(merged.toExpression())));
            request.properties("context", new Node().value(expr("document('"
                    + escapeSingleQuoted(integration.contextPath()) + "')")));
            if (taskName != null) {
                request.properties("taskName", new Node().value(taskName));
            }

            Node expectedResponsesNode = expectedResponsesNode(mergedExpectedResponses, mergedNamedExpectedResponses);
            if (expectedResponsesNode != null) {
                request.properties("expectedResponses", expectedResponsesNode);
            }

            return parent.emitCallOperationRequested(stepName, integration, request);
        }

        private static Node expectedResponsesNode(List<TypeReference> references,
                                                  List<NamedEventExpectation> namedExpectations) {
            boolean noTypeReferences = references == null || references.isEmpty();
            boolean noNamed = namedExpectations == null || namedExpectations.isEmpty();
            if (noTypeReferences && noNamed) {
                return null;
            }
            Set<String> dedup = new LinkedHashSet<String>();
            List<Node> items = new ArrayList<Node>();
            if (references != null) {
                for (TypeReference reference : references) {
                    if (reference == null) {
                        continue;
                    }
                    String key = reference.dedupKey();
                    if (!dedup.add(key)) {
                        continue;
                    }
                    Node node = reference.toNode();
                    if (node != null) {
                        items.add(node);
                    }
                }
            }
            if (namedExpectations != null) {
                for (NamedEventExpectation named : namedExpectations) {
                    if (named == null) {
                        continue;
                    }
                    String key = named.dedupKey();
                    if (!dedup.add(key)) {
                        continue;
                    }
                    items.add(namedEventExpectationNode(named));
                }
            }
            if (items.isEmpty()) {
                return null;
            }
            return new Node().items(items);
        }

        private static Node namedEventExpectationNode(NamedEventExpectation named) {
            Node event = new Node().type(TypeRef.of(NamedEvent.class).asTypeNode());
            event.properties("name", new Node().value(named.eventName()));
            if (named.fields() != null && !named.fields().isEmpty()) {
                Node payload = new Node().properties(new LinkedHashMap<String, Node>());
                for (NamedEventExpectation.FieldExpectation field : named.fields()) {
                    Node descriptor = new Node().properties(new LinkedHashMap<String, Node>());
                    if (field.description() != null && !field.description().isEmpty()) {
                        descriptor.properties("description", new Node().value(field.description()));
                    }
                    payload.properties(field.name(), descriptor);
                }
                event.properties("payload", payload);
            }
            return event;
        }
    }

    public static final class AISteps {
        private final StepsBuilder parent;
        private final AIIntegrationConfig integration;

        private AISteps(StepsBuilder parent, AIIntegrationConfig integration) {
            this.parent = parent;
            this.integration = integration;
        }

        public StepsBuilder requestPermission() {
            return requestPermission("RequestPermission");
        }

        public StepsBuilder requestPermission(String stepName) {
            return parent.emitType(stepName,
                    blue.language.types.myos.SingleDocumentPermissionGrantRequested.class,
                    payload -> payload
                            .put("onBehalfOf", integration.permissionFromChannel())
                            .put("requestId", integration.requestId())
                            .put("targetSessionId", integration.sessionIdExpression())
                            .putNode("permissions",
                                    MyOsPermissions.create().read(true).singleOps("provideInstructions").build()));
        }

        public StepsBuilder subscribe() {
            return subscribe("Subscribe");
        }

        public StepsBuilder subscribe(String stepName) {
            Node subscription = new Node().properties(new LinkedHashMap<String, Node>());
            subscription.properties("id", new Node().value(integration.subscriptionId()));
            subscription.properties("events", new Node().items(new ArrayList<Node>()));
            return parent.emitType(stepName,
                    blue.language.types.myos.SubscribeToSessionRequested.class,
                    payload -> payload
                            .put("onBehalfOf", integration.permissionFromChannel())
                            .put("targetSessionId", integration.sessionIdExpression())
                            .putNode("subscription", subscription));
        }
    }

    private static final class PromptExpressionBuilder {
        private final List<PromptSegment> segments = new ArrayList<PromptSegment>();

        private void append(PromptExpressionBuilder other) {
            if (other == null || other.segments.isEmpty()) {
                return;
            }
            if (!segments.isEmpty()) {
                segments.add(PromptSegment.literal("\n"));
            }
            for (PromptSegment segment : other.segments) {
                segments.add(segment);
            }
        }

        private void text(String value) {
            if (value == null) {
                return;
            }
            if (!segments.isEmpty()) {
                segments.add(PromptSegment.literal("\n"));
            }
            parseInterpolatedText(value);
        }

        private void expression(String expression) {
            if (expression == null || expression.trim().isEmpty()) {
                return;
            }
            if (!segments.isEmpty()) {
                segments.add(PromptSegment.literal("\n"));
            }
            segments.add(PromptSegment.expression(unwrapExpression(expression.trim())));
        }

        private boolean isEmpty() {
            return segments.isEmpty();
        }

        private String toExpression() {
            if (segments.isEmpty()) {
                return "''";
            }
            StringBuilder expression = new StringBuilder();
            for (int i = 0; i < segments.size(); i++) {
                PromptSegment segment = segments.get(i);
                if (i > 0) {
                    expression.append(" + ");
                }
                if (segment.expression) {
                    expression.append("(").append(segment.value).append(")");
                } else {
                    expression.append("'")
                            .append(segment.value
                                    .replace("\\", "\\\\")
                                    .replace("'", "\\'")
                                    .replace("\n", "\\n"))
                            .append("'");
                }
            }
            return expression.toString();
        }

        private void parseInterpolatedText(String rawText) {
            int index = 0;
            while (index < rawText.length()) {
                int start = rawText.indexOf("${", index);
                if (start < 0) {
                    String literal = rawText.substring(index);
                    if (!literal.isEmpty()) {
                        segments.add(PromptSegment.literal(literal));
                    }
                    return;
                }
                if (start > index) {
                    segments.add(PromptSegment.literal(rawText.substring(index, start)));
                }
                int end = rawText.indexOf('}', start + 2);
                if (end < 0) {
                    segments.add(PromptSegment.literal(rawText.substring(start)));
                    return;
                }
                String expression = rawText.substring(start + 2, end).trim();
                if (!expression.isEmpty()) {
                    segments.add(PromptSegment.expression(expression));
                }
                index = end + 1;
            }
        }

        private static String unwrapExpression(String expression) {
            if (expression.startsWith("${") && expression.endsWith("}")) {
                return expression.substring(2, expression.length() - 1).trim();
            }
            return expression;
        }
    }

    private static final class PromptSegment {
        private final boolean expression;
        private final String value;

        private PromptSegment(boolean expression, String value) {
            this.expression = expression;
            this.value = value;
        }

        private static PromptSegment literal(String value) {
            return new PromptSegment(false, value);
        }

        private static PromptSegment expression(String value) {
            return new PromptSegment(true, value);
        }
    }

    public static final class CaptureStepBuilder {
        private final StepsBuilder parent;

        private CaptureStepBuilder(StepsBuilder parent) {
            this.parent = parent;
        }

        public StepsBuilder lock() {
            return parent.triggerEvent("RequestCaptureLock", PayNoteEvents.captureLockRequested());
        }

        public StepsBuilder unlock() {
            return parent.triggerEvent("RequestCaptureUnlock", PayNoteEvents.captureUnlockRequested());
        }

        public StepsBuilder markLocked() {
            return parent.triggerEvent("CaptureLocked", PayNoteEvents.captureLocked());
        }

        public StepsBuilder markUnlocked() {
            return parent.triggerEvent("CaptureUnlocked", PayNoteEvents.captureUnlocked());
        }

        public StepsBuilder requestNow() {
            return parent.triggerEvent(
                    "RequestCapture",
                    PayNoteEvents.captureFundsRequested(new Node().value(expr("document('/amount/total')"))));
        }

        public StepsBuilder requestPartial(String amountExpression) {
            return parent.triggerEvent(
                    "RequestCapture",
                    PayNoteEvents.captureFundsRequested(new Node().value(expr(amountExpression))));
        }

        public StepsBuilder releaseFull() {
            return parent.triggerEvent(
                    "RequestRelease",
                    PayNoteEvents.reservationReleaseRequested(new Node().value(expr("document('/amount/total')"))));
        }
    }

    private static String expr(String expression) {
        if (expression == null) {
            return null;
        }
        String trimmed = expression.trim();
        if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
            return trimmed;
        }
        return "${" + trimmed + "}";
    }
}
