export interface CapabilityFailureError {
  readonly kind: 'CapabilityFailure';
  readonly capability: string;
  readonly reason: string;
  readonly details?: unknown;
}

export interface BoundaryViolationError {
  readonly kind: 'BoundaryViolation';
  readonly pointer: string;
  readonly reason: string;
}

export interface RuntimeFatalError {
  readonly kind: 'RuntimeFatal';
  readonly reason: string;
  readonly cause?: unknown;
}

export interface InvalidContractError {
  readonly kind: 'InvalidContract';
  readonly contractId: string;
  readonly reason: string;
  readonly pointer?: string;
  readonly details?: unknown;
}

export interface IllegalStateError {
  readonly kind: 'IllegalState';
  readonly reason: string;
}

export interface UnsupportedOpError {
  readonly kind: 'UnsupportedOp';
  readonly operation: string;
  readonly reason?: string;
}

export type ProcessorError =
  | CapabilityFailureError
  | BoundaryViolationError
  | RuntimeFatalError
  | InvalidContractError
  | IllegalStateError
  | UnsupportedOpError;

export const ProcessorErrors = {
  capabilityFailure(
    capability: string,
    reason: string,
    details?: unknown,
  ): CapabilityFailureError {
    return { kind: 'CapabilityFailure', capability, reason, details };
  },
  boundaryViolation(pointer: string, reason: string): BoundaryViolationError {
    return { kind: 'BoundaryViolation', pointer, reason };
  },
  runtimeFatal(reason: string, cause?: unknown): RuntimeFatalError {
    return { kind: 'RuntimeFatal', reason, cause };
  },
  invalidContract(
    contractId: string,
    reason: string,
    pointer?: string,
    details?: unknown,
  ): InvalidContractError {
    return { kind: 'InvalidContract', contractId, reason, pointer, details };
  },
  illegalState(reason: string): IllegalStateError {
    return { kind: 'IllegalState', reason };
  },
  unsupported(operation: string, reason?: string): UnsupportedOpError {
    return { kind: 'UnsupportedOp', operation, reason };
  },
} as const;
