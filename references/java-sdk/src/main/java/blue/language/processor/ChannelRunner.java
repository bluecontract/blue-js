package blue.language.processor;

import blue.language.model.Node;
import blue.language.processor.model.ChannelContract;

import java.util.List;
import java.util.Objects;

/**
 * Executes channel matching and handler invocation for a scope.
 *
 * <p>Applies checkpoint gating for external channels and feeds successful
 * matches into the registered handler processors.</p>
 */
final class ChannelRunner {

    private final DocumentProcessor owner;
    private final ProcessorEngine.Execution execution;
    private final DocumentProcessingRuntime runtime;
    private final CheckpointManager checkpointManager;

    ChannelRunner(DocumentProcessor owner,
                  ProcessorEngine.Execution execution,
                  DocumentProcessingRuntime runtime,
                  CheckpointManager checkpointManager) {
        this.owner = Objects.requireNonNull(owner, "owner");
        this.execution = Objects.requireNonNull(execution, "execution");
        this.runtime = Objects.requireNonNull(runtime, "runtime");
        this.checkpointManager = Objects.requireNonNull(checkpointManager, "checkpointManager");
    }

    void runExternalChannel(String scopePath,
                            ContractBundle bundle,
                            ContractBundle.ChannelBinding channel,
                            Node event) {
        if (execution.isScopeInactive(scopePath)) {
            return;
        }
        runtime.chargeChannelMatchAttempt();
        ChannelContract contract = channel.contract();
        ProcessorEngine.ChannelMatch match = ProcessorEngine.evaluateChannel(
                owner,
                channel.key(),
                contract,
                bundle,
                scopePath,
                event);
        if (!match.matches) {
            return;
        }
        List<ChannelProcessorEvaluation.ChannelDelivery> deliveries = match.deliveries;
        if (deliveries != null && !deliveries.isEmpty()) {
            for (ChannelProcessorEvaluation.ChannelDelivery delivery : deliveries) {
                if (delivery != null && Boolean.FALSE.equals(delivery.shouldProcess())) {
                    continue;
                }
                String checkpointKey = delivery != null && delivery.checkpointKey() != null
                        ? delivery.checkpointKey()
                        : channel.key();
                Node eventForHandlers = delivery != null && delivery.eventNode() != null
                        ? delivery.eventNode()
                        : (match.eventNode() != null ? match.eventNode() : event);
                if (!processSingleDelivery(scopePath, bundle, channel.key(), checkpointKey, contract, match, eventForHandlers,
                        delivery != null ? delivery.eventId() : null, event)) {
                    continue;
                }
            }
            return;
        }
        Node eventForHandlers = match.eventNode() != null ? match.eventNode() : event;
        processSingleDelivery(scopePath, bundle, channel.key(), channel.key(), contract, match, eventForHandlers, match.eventId, event);
    }

    void runHandlers(String scopePath,
                     ContractBundle bundle,
                     String channelKey,
                     Node event,
                     boolean allowTerminatedWork) {
        List<ContractBundle.HandlerBinding> handlers = bundle.handlersFor(channelKey);
        if (handlers.isEmpty()) {
            return;
        }
        for (ContractBundle.HandlerBinding handler : handlers) {
            if (!allowTerminatedWork && execution.isScopeInactive(scopePath)) {
                break;
            }
            runtime.chargeHandlerOverhead();
            ProcessorExecutionContext context = execution.createContext(scopePath, bundle, event, allowTerminatedWork);
            try {
                ProcessorEngine.executeHandler(owner, handler.contract(), context);
            } catch (ProcessorFatalException ex) {
                execution.enterFatalTermination(scopePath, bundle, execution.fatalReason(ex, "Processor fatal"));
                break;
            } catch (RuntimeException ex) {
                execution.enterFatalTermination(scopePath, bundle, execution.fatalReason(ex, "Runtime fatal"));
                break;
            }
            if (execution.isScopeInactive(scopePath) && !allowTerminatedWork) {
                break;
            }
        }
    }

    private boolean processSingleDelivery(String scopePath,
                                          ContractBundle bundle,
                                          String handlerChannelKey,
                                          String checkpointChannelKey,
                                          ChannelContract contract,
                                          ProcessorEngine.ChannelMatch match,
                                          Node eventForHandlers,
                                          String explicitEventId,
                                          Node originalEventNode) {
        if (execution.isScopeInactive(scopePath)) {
            return false;
        }
        checkpointManager.ensureCheckpointMarker(scopePath, bundle);
        CheckpointManager.CheckpointRecord checkpoint = checkpointManager.findCheckpoint(bundle, checkpointChannelKey);
        String eventSignature = explicitEventId != null
                ? explicitEventId
                : (match.eventId != null ? match.eventId : ProcessorEngine.canonicalSignature(
                        originalEventNode != null ? originalEventNode : eventForHandlers));
        if (checkpointManager.isDuplicate(checkpoint, eventSignature)) {
            return false;
        }
        if (checkpoint != null
                && checkpoint.lastEventNode != null
                && match.processor != null
                && match.context != null
                && !match.processor.isNewerEvent(contract, match.context, checkpoint.lastEventNode.clone())) {
            return false;
        }
        runHandlers(scopePath, bundle, handlerChannelKey, eventForHandlers, false);
        if (execution.isScopeInactive(scopePath)) {
            return false;
        }
        checkpointManager.persist(scopePath, bundle, checkpoint, eventSignature,
                originalEventNode != null ? originalEventNode : eventForHandlers);
        return true;
    }
}
