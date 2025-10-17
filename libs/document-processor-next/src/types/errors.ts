/**
 * Discriminated error union for the processor. These replace Java exceptions
 * at public API boundaries. Internals may still throw; the facade maps them
 * to one of these shapes.
 */

export type CapabilityFailure = {
  readonly kind: 'CapabilityFailure'; // Java: MustUnderstandFailureException
  readonly message: string;
  /** Optional context about what capability/contract failed. */
  readonly contractType?: string;
  readonly key?: string;
};

export type BoundaryViolation = {
  readonly kind: 'BoundaryViolation';
  readonly message: string;
  /** Absolute JSON pointer that violated the boundary. */
  readonly pointer?: string;
  /** Normalized scope path where violation occurred. */
  readonly scopePath?: string;
  /** If reserved key protection triggered. */
  readonly reservedKey?: string;
};

export type RuntimeFatal = {
  readonly kind: 'RuntimeFatal';
  readonly message: string;
  /** Root-level fatal emits outbox event in engine; include cause if known. */
  readonly cause?: string;
};

export type InvalidContract = {
  readonly kind: 'InvalidContract';
  readonly message: string;
  readonly key?: string;
  /** BlueId(s) or class/type name that could not be mapped. */
  readonly typeRef?: string;
};

export type IllegalState = {
  readonly kind: 'IllegalState';
  readonly message: string;
  /** Optional hint for the illegal state location. */
  readonly pointer?: string;
};

export type UnsupportedOp = {
  readonly kind: 'UnsupportedOp';
  readonly message: string;
  readonly op?: string;
};

export type ProcessorError =
  | CapabilityFailure
  | BoundaryViolation
  | RuntimeFatal
  | InvalidContract
  | IllegalState
  | UnsupportedOp;

/** Type guards */
export const isCapabilityFailure = (
  e: ProcessorError
): e is CapabilityFailure => e.kind === 'CapabilityFailure';
export const isBoundaryViolation = (
  e: ProcessorError
): e is BoundaryViolation => e.kind === 'BoundaryViolation';
export const isRuntimeFatal = (e: ProcessorError): e is RuntimeFatal =>
  e.kind === 'RuntimeFatal';
export const isInvalidContract = (e: ProcessorError): e is InvalidContract =>
  e.kind === 'InvalidContract';
export const isIllegalState = (e: ProcessorError): e is IllegalState =>
  e.kind === 'IllegalState';
export const isUnsupportedOp = (e: ProcessorError): e is UnsupportedOp =>
  e.kind === 'UnsupportedOp';

/** Factories (prefer these to keep shape consistent) */
export const capabilityFailure = (
  message: string,
  extras: Omit<CapabilityFailure, 'kind' | 'message'> = {}
): CapabilityFailure => ({
  kind: 'CapabilityFailure',
  message,
  ...extras,
});

export const boundaryViolation = (
  message: string,
  extras: Omit<BoundaryViolation, 'kind' | 'message'> = {}
): BoundaryViolation => ({
  kind: 'BoundaryViolation',
  message,
  ...extras,
});

export const runtimeFatal = (
  message: string,
  extras: Omit<RuntimeFatal, 'kind' | 'message'> = {}
): RuntimeFatal => ({
  kind: 'RuntimeFatal',
  message,
  ...extras,
});

export const invalidContract = (
  message: string,
  extras: Omit<InvalidContract, 'kind' | 'message'> = {}
): InvalidContract => ({
  kind: 'InvalidContract',
  message,
  ...extras,
});

export const illegalState = (
  message: string,
  extras: Omit<IllegalState, 'kind' | 'message'> = {}
): IllegalState => ({
  kind: 'IllegalState',
  message,
  ...extras,
});

export const unsupportedOp = (
  message: string,
  extras: Omit<UnsupportedOp, 'kind' | 'message'> = {}
): UnsupportedOp => ({
  kind: 'UnsupportedOp',
  message,
  ...extras,
});
