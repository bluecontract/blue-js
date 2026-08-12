import languageManifestSource from './resources/blue-language-1.0/manifest.yaml?raw';
import contractsManifestSource from './resources/blue-contracts-1.0/manifest.yaml?raw';
import languageBooleanSource from './resources/blue-language-1.0/Boolean.blue?raw';
import languageDictionarySource from './resources/blue-language-1.0/Dictionary.blue?raw';
import languageDoubleSource from './resources/blue-language-1.0/Double.blue?raw';
import languageIntegerSource from './resources/blue-language-1.0/Integer.blue?raw';
import languageListSource from './resources/blue-language-1.0/List.blue?raw';
import languageTextSource from './resources/blue-language-1.0/Text.blue?raw';
import contractsChannelSource from './resources/blue-contracts-1.0/Channel.blue?raw';
import contractsChannelEventCheckpointSource from './resources/blue-contracts-1.0/ChannelEventCheckpoint.blue?raw';
import contractsCheckpointEntrySource from './resources/blue-contracts-1.0/CheckpointEntry.blue?raw';
import contractsContractSource from './resources/blue-contracts-1.0/Contract.blue?raw';
import contractsContractExecutionResultSource from './resources/blue-contracts-1.0/ContractExecutionResult.blue?raw';
import contractsDocumentProcessingInitiatedSource from './resources/blue-contracts-1.0/DocumentProcessingInitiated.blue?raw';
import contractsDocumentProcessingTerminatedSource from './resources/blue-contracts-1.0/DocumentProcessingTerminated.blue?raw';
import contractsDocumentUpdateSource from './resources/blue-contracts-1.0/DocumentUpdate.blue?raw';
import contractsDocumentUpdateChannelSource from './resources/blue-contracts-1.0/DocumentUpdateChannel.blue?raw';
import contractsEmbeddedEventDeliverySource from './resources/blue-contracts-1.0/EmbeddedEventDelivery.blue?raw';
import contractsEmbeddedNodeChannelSource from './resources/blue-contracts-1.0/EmbeddedNodeChannel.blue?raw';
import contractsExternalChannelSource from './resources/blue-contracts-1.0/ExternalChannel.blue?raw';
import contractsFixtureEventSource from './resources/blue-contracts-1.0/FixtureEvent.blue?raw';
import contractsHandlerSource from './resources/blue-contracts-1.0/Handler.blue?raw';
import contractsJsonPatchEntrySource from './resources/blue-contracts-1.0/JsonPatchEntry.blue?raw';
import contractsLifecycleEventChannelSource from './resources/blue-contracts-1.0/LifecycleEventChannel.blue?raw';
import contractsMarkerSource from './resources/blue-contracts-1.0/Marker.blue?raw';
import contractsProcessEmbeddedSource from './resources/blue-contracts-1.0/ProcessEmbedded.blue?raw';
import contractsProcessingInitializedMarkerSource from './resources/blue-contracts-1.0/ProcessingInitializedMarker.blue?raw';
import contractsProcessingTerminatedMarkerSource from './resources/blue-contracts-1.0/ProcessingTerminatedMarker.blue?raw';
import contractsRuntimeCounterEntrySource from './resources/blue-contracts-1.0/RuntimeCounterEntry.blue?raw';
import contractsRuntimeLedgerSource from './resources/blue-contracts-1.0/RuntimeLedger.blue?raw';
import contractsScriptedExternalChannelSource from './resources/blue-contracts-1.0/ScriptedExternalChannel.blue?raw';
import contractsScriptedHandlerSource from './resources/blue-contracts-1.0/ScriptedHandler.blue?raw';
import contractsTriggeredEventChannelSource from './resources/blue-contracts-1.0/TriggeredEventChannel.blue?raw';
import contractsTypeGeneralizationPolicySource from './resources/blue-contracts-1.0/TypeGeneralizationPolicy.blue?raw';
import contractsTypeGeneralizationRuleSource from './resources/blue-contracts-1.0/TypeGeneralizationRule.blue?raw';

export interface BundledRegistrySource {
  readonly manifestSource: string;
  readonly entrySources: Readonly<Record<string, string>>;
}

export const BUNDLED_LANGUAGE_CORE_REGISTRY_SOURCE: BundledRegistrySource =
  Object.freeze({
    manifestSource: languageManifestSource,
    entrySources: Object.freeze({
      'Boolean.blue': languageBooleanSource,
      'Dictionary.blue': languageDictionarySource,
      'Double.blue': languageDoubleSource,
      'Integer.blue': languageIntegerSource,
      'List.blue': languageListSource,
      'Text.blue': languageTextSource,
    }),
  });

export const BUNDLED_CONTRACTS_RUNTIME_REGISTRY_SOURCE: BundledRegistrySource =
  Object.freeze({
    manifestSource: contractsManifestSource,
    entrySources: Object.freeze({
      'Channel.blue': contractsChannelSource,
      'ChannelEventCheckpoint.blue': contractsChannelEventCheckpointSource,
      'CheckpointEntry.blue': contractsCheckpointEntrySource,
      'Contract.blue': contractsContractSource,
      'ContractExecutionResult.blue': contractsContractExecutionResultSource,
      'DocumentProcessingInitiated.blue':
        contractsDocumentProcessingInitiatedSource,
      'DocumentProcessingTerminated.blue':
        contractsDocumentProcessingTerminatedSource,
      'DocumentUpdate.blue': contractsDocumentUpdateSource,
      'DocumentUpdateChannel.blue': contractsDocumentUpdateChannelSource,
      'EmbeddedEventDelivery.blue': contractsEmbeddedEventDeliverySource,
      'EmbeddedNodeChannel.blue': contractsEmbeddedNodeChannelSource,
      'ExternalChannel.blue': contractsExternalChannelSource,
      'FixtureEvent.blue': contractsFixtureEventSource,
      'Handler.blue': contractsHandlerSource,
      'JsonPatchEntry.blue': contractsJsonPatchEntrySource,
      'LifecycleEventChannel.blue': contractsLifecycleEventChannelSource,
      'Marker.blue': contractsMarkerSource,
      'ProcessEmbedded.blue': contractsProcessEmbeddedSource,
      'ProcessingInitializedMarker.blue':
        contractsProcessingInitializedMarkerSource,
      'ProcessingTerminatedMarker.blue':
        contractsProcessingTerminatedMarkerSource,
      'RuntimeCounterEntry.blue': contractsRuntimeCounterEntrySource,
      'RuntimeLedger.blue': contractsRuntimeLedgerSource,
      'ScriptedExternalChannel.blue': contractsScriptedExternalChannelSource,
      'ScriptedHandler.blue': contractsScriptedHandlerSource,
      'TriggeredEventChannel.blue': contractsTriggeredEventChannelSource,
      'TypeGeneralizationPolicy.blue': contractsTypeGeneralizationPolicySource,
      'TypeGeneralizationRule.blue': contractsTypeGeneralizationRuleSource,
    }),
  });
