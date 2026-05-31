import type { BlueNode } from '@blue-labs/language';

export const ProcessorStatus = {
  SUCCESS: 'success',
  CAPABILITY_FAILURE: 'capability-failure',
  RUNTIME_FATAL: 'runtime-fatal',
  INVALID_PROCESSING_DOCUMENT: 'invalid-processing-document',
} as const;

export type ProcessorStatus =
  (typeof ProcessorStatus)[keyof typeof ProcessorStatus];

export const ProcessorErrorCategory = {
  InvalidProcessingDocument: 'InvalidProcessingDocument',
  UnsupportedContract: 'UnsupportedContract',
  InvalidReservedMarker: 'InvalidReservedMarker',
  InvalidRuntimePointer: 'InvalidRuntimePointer',
  BoundaryViolation: 'BoundaryViolation',
  ReservedKeyWrite: 'ReservedKeyWrite',
  InvalidPatch: 'InvalidPatch',
  InvalidPatchValue: 'InvalidPatchValue',
  HandlerExecutionError: 'HandlerExecutionError',
  CheckpointError: 'CheckpointError',
  TerminationError: 'TerminationError',
  GasError: 'GasError',
  GeneralizationRejected: 'GeneralizationRejected',
  GeneralizationNoValidType: 'GeneralizationNoValidType',
  TypeSoundnessViolation: 'TypeSoundnessViolation',
  InternalProcessorError: 'InternalProcessorError',
} as const;

export type ProcessorErrorCategory =
  (typeof ProcessorErrorCategory)[keyof typeof ProcessorErrorCategory];

export interface DocumentProcessingResult {
  readonly document: BlueNode;
  readonly triggeredEvents: readonly BlueNode[];
  readonly totalGas: number;
  readonly capabilityFailure: boolean;
  readonly failureReason: string | null;
  readonly status: ProcessorStatus;
  readonly errorCategory: ProcessorErrorCategory | null;
}

function freezeEvents(events: readonly BlueNode[]): readonly BlueNode[] {
  return Object.freeze([...events]);
}

const factories = {
  of(
    document: BlueNode,
    triggeredEvents: readonly BlueNode[],
    totalGas: number,
    status: ProcessorStatus = ProcessorStatus.SUCCESS,
    errorCategory: ProcessorErrorCategory | null = null,
    failureReason: string | null = null,
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: freezeEvents(triggeredEvents),
      totalGas,
      capabilityFailure:
        status === ProcessorStatus.CAPABILITY_FAILURE ||
        status === ProcessorStatus.INVALID_PROCESSING_DOCUMENT,
      failureReason,
      status,
      errorCategory,
    };
  },

  capabilityFailure(
    document: BlueNode,
    reason: string | null,
    errorCategory: ProcessorErrorCategory = ProcessorErrorCategory.UnsupportedContract,
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: Object.freeze([]),
      totalGas: 0,
      capabilityFailure: true,
      failureReason: reason ?? null,
      status: ProcessorStatus.CAPABILITY_FAILURE,
      errorCategory,
    };
  },

  invalidProcessingDocument(
    document: BlueNode,
    reason: string | null,
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: Object.freeze([]),
      totalGas: 0,
      capabilityFailure: true,
      failureReason: reason ?? null,
      status: ProcessorStatus.INVALID_PROCESSING_DOCUMENT,
      errorCategory: ProcessorErrorCategory.InvalidProcessingDocument,
    };
  },

  runtimeFatal(
    document: BlueNode,
    reason: string | null,
    errorCategory: ProcessorErrorCategory = ProcessorErrorCategory.InternalProcessorError,
  ): DocumentProcessingResult {
    return {
      document,
      triggeredEvents: Object.freeze([]),
      totalGas: 0,
      capabilityFailure: false,
      failureReason: reason ?? null,
      status: ProcessorStatus.RUNTIME_FATAL,
      errorCategory,
    };
  },
} as const;

export const DocumentProcessingResult = factories;
