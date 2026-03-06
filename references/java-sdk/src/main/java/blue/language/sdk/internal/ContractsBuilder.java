package blue.language.sdk.internal;

import blue.language.model.Node;
import blue.language.sdk.AccessConfig;
import blue.language.sdk.AgencyConfig;
import blue.language.sdk.LinkedAccessConfig;
import blue.language.sdk.ai.AIIntegrationConfig;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

public final class ContractsBuilder {

    private final Map<String, Node> contracts;
    private final Map<String, AIIntegrationConfig> aiIntegrations;
    private final Map<String, AccessConfig> accessConfigs;
    private final Map<String, LinkedAccessConfig> linkedAccessConfigs;
    private final Map<String, AgencyConfig> agencyConfigs;

    public ContractsBuilder(Map<String, Node> contracts) {
        this(contracts, null, null, null, null);
    }

    public ContractsBuilder(Map<String, Node> contracts,
                            Map<String, AIIntegrationConfig> aiIntegrations) {
        this(contracts, aiIntegrations, null, null, null);
    }

    public ContractsBuilder(Map<String, Node> contracts,
                            Map<String, AIIntegrationConfig> aiIntegrations,
                            Map<String, AccessConfig> accessConfigs,
                            Map<String, LinkedAccessConfig> linkedAccessConfigs,
                            Map<String, AgencyConfig> agencyConfigs) {
        this.contracts = contracts;
        this.aiIntegrations = new LinkedHashMap<String, AIIntegrationConfig>();
        this.accessConfigs = new LinkedHashMap<String, AccessConfig>();
        this.linkedAccessConfigs = new LinkedHashMap<String, LinkedAccessConfig>();
        this.agencyConfigs = new LinkedHashMap<String, AgencyConfig>();
        if (aiIntegrations != null) {
            this.aiIntegrations.putAll(aiIntegrations);
        }
        if (accessConfigs != null) {
            this.accessConfigs.putAll(accessConfigs);
        }
        if (linkedAccessConfigs != null) {
            this.linkedAccessConfigs.putAll(linkedAccessConfigs);
        }
        if (agencyConfigs != null) {
            this.agencyConfigs.putAll(agencyConfigs);
        }
    }

    public ContractsBuilder putRaw(String key, Node contract) {
        contracts.put(key, contract);
        return this;
    }

    public ContractsBuilder timelineChannel(String key) {
        contracts.put(key, new Node().type(TypeAliases.CORE_CHANNEL));
        return this;
    }

    public ContractsBuilder compositeTimelineChannel(String key, String... channelKeys) {
        Node composite = new Node().type(TypeAliases.CONVERSATION_COMPOSITE_TIMELINE_CHANNEL);
        if (channelKeys != null) {
            List<Node> items = new ArrayList<Node>();
            for (String channelKey : channelKeys) {
                items.add(new Node().value(channelKey));
            }
            composite.properties("channels", new Node().items(items));
        }
        contracts.put(key, composite);
        return this;
    }

    public ContractsBuilder operation(String key, String channel, String description) {
        Node operation = new Node().type(TypeAliases.CONVERSATION_OPERATION);
        if (description != null) {
            operation.properties("description", new Node().value(description));
        }
        operation.properties("channel", new Node().value(channel));
        contracts.put(key, operation);
        return this;
    }

    public ContractsBuilder operation(String key,
                                      String channel,
                                      Class<?> requestTypeClass,
                                      String description) {
        operation(key, channel, description);
        if (requestTypeClass != null) {
            Node request = new Node().type(TypeRef.of(requestTypeClass).asTypeNode());
            contracts.get(key).properties("request", request);
        }
        return this;
    }

    public ContractsBuilder operation(String key,
                                      String channel,
                                      Node request,
                                      String description) {
        operation(key, channel, description);
        if (request != null) {
            contracts.get(key).properties("request", request);
        }
        return this;
    }

    public ContractsBuilder operationRequestDescription(String key, String requestDescription) {
        Node operation = contracts.get(key);
        if (operation == null) {
            return this;
        }
        Node request = operation.getProperties() == null ? null : operation.getProperties().get("request");
        if (request == null) {
            request = new Node();
            operation.properties("request", request);
        }
        request.properties("description", new Node().value(requestDescription));
        return this;
    }

    public ContractsBuilder sequentialWorkflowOperation(String key,
                                                        String operationName,
                                                        Consumer<StepsBuilder> customizer) {
        if (customizer == null) {
            return this;
        }
        StepsBuilder stepsBuilder = new StepsBuilder(
                aiIntegrations, accessConfigs, linkedAccessConfigs, agencyConfigs);
        customizer.accept(stepsBuilder);

        Node workflow = new Node().type(TypeAliases.CONVERSATION_SEQUENTIAL_WORKFLOW_OPERATION);
        workflow.properties("operation", new Node().value(operationName));
        workflow.properties("steps", new Node().items(stepsBuilder.build()));
        contracts.put(key, workflow);
        return this;
    }

    public ContractsBuilder appendOperationImplementation(String key,
                                                          String operationName,
                                                          Consumer<StepsBuilder> customizer) {
        if (customizer == null) {
            return this;
        }

        StepsBuilder stepsBuilder = new StepsBuilder(
                aiIntegrations, accessConfigs, linkedAccessConfigs, agencyConfigs);
        customizer.accept(stepsBuilder);
        List<Node> nextSteps = stepsBuilder.build();

        Node workflow = contracts.get(key);
        if (workflow == null) {
            return sequentialWorkflowOperation(key, operationName, customizer);
        }

        workflow.type(TypeAliases.CONVERSATION_SEQUENTIAL_WORKFLOW_OPERATION);
        workflow.properties("operation", new Node().value(operationName));

        Node stepsNode = workflow.getProperties() != null ? workflow.getProperties().get("steps") : null;
        if (stepsNode == null || stepsNode.getItems() == null) {
            stepsNode = new Node().items(new ArrayList<Node>());
            workflow.properties("steps", stepsNode);
        }
        for (Node step : nextSteps) {
            stepsNode.getItems().add(step);
        }
        contracts.put(key, workflow);
        return this;
    }

    public ContractsBuilder implementOperation(String key,
                                               String operationName,
                                               Consumer<StepsBuilder> customizer) {
        return appendOperationImplementation(key, operationName, customizer);
    }

    public ContractsBuilder sequentialWorkflow(String key,
                                               String channel,
                                               Node event,
                                               Consumer<StepsBuilder> customizer) {
        StepsBuilder stepsBuilder = new StepsBuilder(
                aiIntegrations, accessConfigs, linkedAccessConfigs, agencyConfigs);
        customizer.accept(stepsBuilder);

        Node workflow = new Node().type(TypeAliases.CONVERSATION_SEQUENTIAL_WORKFLOW);
        workflow.properties("channel", new Node().value(channel));
        if (event != null) {
            workflow.properties("event", event);
        }
        workflow.properties("steps", new Node().items(stepsBuilder.build()));
        contracts.put(key, workflow);
        return this;
    }

    public ContractsBuilder onTriggered(String key,
                                        Node event,
                                        Consumer<StepsBuilder> customizer) {
        return sequentialWorkflow(key, "triggeredEventChannel", event, customizer);
    }

    public ContractsBuilder onTriggered(String key,
                                        Class<?> eventTypeClass,
                                        Consumer<StepsBuilder> customizer) {
        return sequentialWorkflow(
                key,
                "triggeredEventChannel",
                new Node().type(TypeRef.of(eventTypeClass).asTypeNode()),
                customizer);
    }

    public ContractsBuilder onLifecycle(String key,
                                        String lifecycleChannelKey,
                                        Consumer<StepsBuilder> customizer) {
        return sequentialWorkflow(key, lifecycleChannelKey, null, customizer);
    }

    public ContractsBuilder onEvent(String key,
                                    String channel,
                                    Class<?> eventTypeClass,
                                    Consumer<StepsBuilder> customizer) {
        return sequentialWorkflow(
                key,
                channel,
                new Node().type(TypeRef.of(eventTypeClass).asTypeNode()),
                customizer);
    }

    public ContractsBuilder triggeredEventChannel(String key) {
        contracts.put(key, new Node().type(TypeAliases.CORE_TRIGGERED_EVENT_CHANNEL));
        return this;
    }

    public ContractsBuilder lifecycleEventChannel(String key, String eventTypeAlias) {
        Node channel = new Node().type(TypeAliases.CORE_LIFECYCLE_EVENT_CHANNEL);
        if (eventTypeAlias != null) {
            channel.properties("event", new Node().type(eventTypeAlias));
        }
        contracts.put(key, channel);
        return this;
    }

    public ContractsBuilder documentUpdateChannel(String key, String path) {
        contracts.put(key, new Node()
                .type(TypeAliases.CORE_DOCUMENT_UPDATE_CHANNEL)
                .properties("path", new Node().value(path)));
        return this;
    }
}
